use std::fs;
use std::io::Cursor;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

use image::imageops::FilterType;
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::error::{AppError, Result};
use crate::store::{ensure_dirs, project_dir, projects_root, write_atomic};

const PRINT_MAX_SIDE: u32 = 2500;

#[derive(Default)]
pub struct CancelFlag(AtomicBool);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareItem {
    stored_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Prepared {
    stored_name: String,
    cached_name: String,
    format: &'static str,
    width: u32,
    height: u32,
}

#[derive(Clone, Serialize)]
struct Progress {
    done: usize,
    total: usize,
}

struct Quality {
    dir: &'static str,
    photo_side: u32,
    jpeg: u8,
}

fn quality(name: &str) -> Result<Quality> {
    match name {
        "mid" => Ok(Quality {
            dir: "prepared-mid",
            photo_side: 2000,
            jpeg: 85,
        }),
        "high" => Ok(Quality {
            dir: "prepared-high",
            photo_side: 2800,
            jpeg: 90,
        }),
        _ => Err(AppError::BadRequest),
    }
}

fn fit(img: DynamicImage, max_side: u32) -> DynamicImage {
    if img.width().max(img.height()) <= max_side {
        return img;
    }
    img.resize(max_side, max_side, FilterType::Lanczos3)
}

// Re-encoding from decoded pixels drops every metadata block, GPS included.
fn prepare_bytes(
    bytes: &[u8],
    is_png: bool,
    q: &Quality,
) -> Result<(Vec<u8>, &'static str, u32, u32)> {
    let image_err = |e: image::ImageError| AppError::Image(e.to_string());
    let reader = ImageReader::new(Cursor::new(bytes)).with_guessed_format()?;
    let mut decoder = reader.into_decoder().map_err(image_err)?;
    let orientation = decoder.orientation().map_err(image_err)?;
    let mut img = DynamicImage::from_decoder(decoder).map_err(image_err)?;
    img.apply_orientation(orientation);

    if is_png {
        let img = fit(img, PRINT_MAX_SIDE);
        let mut out = Cursor::new(Vec::new());
        img.write_to(&mut out, ImageFormat::Png)
            .map_err(image_err)?;
        return Ok((out.into_inner(), "png", img.width(), img.height()));
    }
    let rgb = fit(img, q.photo_side).to_rgb8();
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, q.jpeg)
        .encode_image(&rgb)
        .map_err(image_err)?;
    Ok((out, "jpg", rgb.width(), rgb.height()))
}

fn prepare_one(dir: &Path, item: &PrepareItem, q: &Quality) -> Result<Prepared> {
    let source = dir.join("files").join(&item.stored_name);
    let is_png = item.stored_name.to_ascii_lowercase().ends_with(".png");
    let bytes = fs::read(&source).map_err(|_| AppError::NotFound)?;
    let (data, format, width, height) = prepare_bytes(&bytes, is_png, q)?;
    let stem = item
        .stored_name
        .rsplit_once('.')
        .map_or(item.stored_name.as_str(), |(s, _)| s);
    let cached_name = format!("{stem}.{format}");
    write_atomic(&dir.join(q.dir).join(&cached_name), &data)?;
    Ok(Prepared {
        stored_name: item.stored_name.clone(),
        cached_name,
        format,
        width,
        height,
    })
}

#[tauri::command]
pub async fn prepare_images(
    app: AppHandle,
    cancel: State<'_, CancelFlag>,
    project_id: String,
    quality_name: String,
    items: Vec<PrepareItem>,
) -> Result<Vec<Prepared>> {
    let q = quality(&quality_name)?;
    let dir = project_dir(&projects_root(&app)?, &project_id)?;
    ensure_dirs(&dir)?;
    cancel.0.store(false, Ordering::SeqCst);
    let total = items.len();
    let mut out = Vec::with_capacity(total);
    for (done, item) in items.iter().enumerate() {
        if cancel.0.load(Ordering::SeqCst) {
            break;
        }
        let dir = dir.clone();
        let q_dir = q.dir;
        let (photo_side, jpeg) = (q.photo_side, q.jpeg);
        let item = PrepareItem {
            stored_name: item.stored_name.clone(),
        };
        let prepared = tauri::async_runtime::spawn_blocking(move || {
            prepare_one(
                &dir,
                &item,
                &Quality {
                    dir: q_dir,
                    photo_side,
                    jpeg,
                },
            )
        })
        .await
        .map_err(|e| AppError::Image(e.to_string()))??;
        out.push(prepared);
        let _ = app.emit(
            "prepare-progress",
            Progress {
                done: done + 1,
                total,
            },
        );
    }
    Ok(out)
}

#[tauri::command]
pub fn cancel_prepare(cancel: State<'_, CancelFlag>) {
    cancel.0.store(true, Ordering::SeqCst);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn jpeg_with_exif(w: u32, h: u32) -> Vec<u8> {
        let img = image::RgbImage::from_pixel(w, h, image::Rgb([20, 120, 200]));
        let mut jpeg = Vec::new();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, 90)
            .encode_image(&img)
            .unwrap();
        // Minimal APP1 segment: "Exif\0\0" + an empty little-endian TIFF header.
        let tiff: &[u8] = b"Exif\0\0II*\0\x08\0\0\0\0\0\0\0\0\0";
        let mut segment = vec![0xFF, 0xE1];
        segment.extend_from_slice(&((tiff.len() as u16 + 2).to_be_bytes()));
        segment.extend_from_slice(tiff);
        let mut out = jpeg[..2].to_vec();
        out.extend_from_slice(&segment);
        out.extend_from_slice(&jpeg[2..]);
        out
    }

    fn contains(haystack: &[u8], needle: &[u8]) -> bool {
        haystack.windows(needle.len()).any(|w| w == needle)
    }

    #[test]
    fn prepared_photos_carry_no_exif() {
        let source = jpeg_with_exif(300, 200);
        assert!(contains(&source, b"Exif"));
        let q = quality("mid").unwrap();
        let (out, format, w, h) = prepare_bytes(&source, false, &q).unwrap();
        assert_eq!(format, "jpg");
        assert_eq!((w, h), (300, 200));
        assert!(!contains(&out, b"Exif"));
    }

    #[test]
    fn large_photos_are_reduced_to_the_quality_limit() {
        let source = jpeg_with_exif(3000, 1500);
        let (_, _, w, h) = prepare_bytes(&source, false, &quality("mid").unwrap()).unwrap();
        assert_eq!((w, h), (2000, 1000));
        let (_, _, w, _) = prepare_bytes(&source, false, &quality("high").unwrap()).unwrap();
        assert_eq!(w, 2800);
    }

    #[test]
    fn prints_stay_png_and_only_shrink_above_the_limit() {
        let small = image::RgbImage::from_pixel(100, 50, image::Rgb([1, 2, 3]));
        let mut png = Cursor::new(Vec::new());
        small.write_to(&mut png, ImageFormat::Png).unwrap();
        let (_, format, w, h) =
            prepare_bytes(png.get_ref(), true, &quality("mid").unwrap()).unwrap();
        assert_eq!((format, w, h), ("png", 100, 50));
    }

    #[test]
    fn unknown_quality_is_rejected() {
        assert!(quality("ultra").is_err());
    }
}
