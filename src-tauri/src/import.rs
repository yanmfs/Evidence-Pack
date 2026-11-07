use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::process::Command;

use image::ImageReader;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::AppHandle;

use crate::error::Result;
use crate::store::{ensure_dirs, project_dir, projects_root, write_atomic};

const MAX_BYTES: u64 = 120 * 1024 * 1024;
const THUMB_SIZE: u32 = 320;
// Text, spreadsheet and Word files: shown in the report as pages of text.
const DOC_EXTENSIONS: [&str; 3] = ["txt", "csv", "docx"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedFile {
    stored_name: String,
    original_name: String,
    sha256: String,
    kind: &'static str,
    width: Option<u32>,
    height: Option<u32>,
    pages: Option<u32>,
    exif_date: Option<String>,
    modified_ms: Option<u64>,
    thumb_name: Option<String>,
    duplicate: bool,
}

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum ImportResult {
    Ok {
        file: ImportedFile,
    },
    #[serde(rename_all = "camelCase")]
    Failed {
        original_name: String,
        code: &'static str,
    },
}

fn extension(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default()
}

fn hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn convert_heic(path: &Path) -> std::result::Result<Vec<u8>, &'static str> {
    if !cfg!(target_os = "macos") {
        return Err("heic_unsupported");
    }
    let out = std::env::temp_dir().join(format!("evidencepack-{}.jpg", std::process::id()));
    let ran = Command::new("sips")
        .args(["-s", "format", "jpeg"])
        .arg(path)
        .arg("--out")
        .arg(&out)
        .output();
    let bytes = match ran {
        Ok(o) if o.status.success() => fs::read(&out).map_err(|_| "heic_failed"),
        _ => Err("heic_failed"),
    };
    let _ = fs::remove_file(&out);
    bytes
}

pub struct ExifInfo {
    pub date: Option<String>,
    pub orientation: u32,
}

pub fn read_exif(bytes: &[u8]) -> ExifInfo {
    let none = ExifInfo {
        date: None,
        orientation: 1,
    };
    let Ok(exif) = exif::Reader::new().read_from_container(&mut Cursor::new(bytes)) else {
        return none;
    };
    let date = exif
        .get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
        .and_then(|f| match &f.value {
            exif::Value::Ascii(parts) => parts
                .first()
                .map(|p| String::from_utf8_lossy(p).into_owned()),
            _ => None,
        })
        .filter(|d| !d.trim().is_empty());
    let orientation = exif
        .get_field(exif::Tag::Orientation, exif::In::PRIMARY)
        .and_then(|f| f.value.get_uint(0))
        .unwrap_or(1);
    ExifInfo { date, orientation }
}

fn thumbnail(bytes: &[u8]) -> Option<Vec<u8>> {
    let reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .ok()?;
    let mut decoder = reader.into_decoder().ok()?;
    let orientation = image::ImageDecoder::orientation(&mut decoder).ok()?;
    let mut img = image::DynamicImage::from_decoder(decoder).ok()?;
    img.apply_orientation(orientation);
    let small = img.thumbnail(THUMB_SIZE, THUMB_SIZE).to_rgb8();
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 78)
        .encode_image(&small)
        .ok()?;
    Some(out)
}

fn modified_ms(path: &Path) -> Option<u64> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    let since = modified.duration_since(std::time::UNIX_EPOCH).ok()?;
    u64::try_from(since.as_millis()).ok()
}

fn import_one(project: &Path, source: &Path) -> std::result::Result<ImportedFile, &'static str> {
    let original_name = source
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or("unreadable")?;
    let ext = extension(source);
    let is_pdf = ext == "pdf";
    let is_doc = DOC_EXTENSIONS.contains(&ext.as_str());
    let is_heic = ext == "heic" || ext == "heif";
    if !is_pdf
        && !is_doc
        && !is_heic
        && !["png", "jpg", "jpeg", "webp", "gif", "bmp"].contains(&ext.as_str())
    {
        return Err("unsupported");
    }
    let meta = fs::metadata(source).map_err(|_| "unreadable")?;
    if meta.len() > MAX_BYTES {
        return Err("too_large");
    }
    let original = fs::read(source).map_err(|_| "unreadable")?;
    let sha256 = hex(&original);
    let short = sha256[..16].to_string();

    let (bytes, stored_ext) = if is_heic {
        (convert_heic(source)?, "jpg".to_string())
    } else if ext == "jpeg" {
        (original, "jpg".to_string())
    } else {
        (original, ext.clone())
    };
    let stored_name = format!("{short}.{stored_ext}");
    let target = project.join("files").join(&stored_name);
    let duplicate = target.exists();

    let mut file = ImportedFile {
        stored_name: stored_name.clone(),
        original_name,
        sha256,
        kind: if is_pdf {
            "pdf"
        } else if is_doc {
            "doc"
        } else {
            "image"
        },
        width: None,
        height: None,
        pages: None,
        exif_date: None,
        modified_ms: modified_ms(source),
        thumb_name: None,
        duplicate,
    };

    if is_doc {
        // A .docx is a zip; a renamed file would fail much later, when the report is built.
        if ext == "docx" && !bytes.starts_with(b"PK") {
            return Err("doc_unreadable");
        }
        if ext != "docx" && bytes.contains(&0) {
            return Err("doc_unreadable");
        }
    } else if is_pdf {
        let doc = lopdf::Document::load_mem(&bytes).map_err(|_| "pdf_unreadable")?;
        if doc.is_encrypted() {
            return Err("pdf_protected");
        }
        file.pages = u32::try_from(doc.get_pages().len()).ok();
    } else {
        let size = imagesize::blob_size(&bytes).map_err(|_| "unreadable")?;
        let exif = read_exif(&bytes);
        let swap = (5..=8).contains(&exif.orientation);
        let (w, h) = (size.width as u32, size.height as u32);
        (file.width, file.height) = if swap {
            (Some(h), Some(w))
        } else {
            (Some(w), Some(h))
        };
        file.exif_date = exif.date;
        if !duplicate {
            if let Some(thumb) = thumbnail(&bytes) {
                let name = format!("{short}.jpg");
                write_atomic(&project.join("thumbs").join(&name), &thumb)
                    .map_err(|_| "unreadable")?;
                file.thumb_name = Some(name);
            }
        } else {
            file.thumb_name = Some(format!("{short}.jpg"));
        }
    }

    if !duplicate {
        write_atomic(&target, &bytes).map_err(|_| "unreadable")?;
    }
    Ok(file)
}

#[tauri::command]
pub fn import_files(
    app: AppHandle,
    project_id: String,
    paths: Vec<PathBuf>,
) -> Result<Vec<ImportResult>> {
    let project = project_dir(&projects_root(&app)?, &project_id)?;
    ensure_dirs(&project)?;
    Ok(paths
        .iter()
        .map(|path| match import_one(&project, path) {
            Ok(file) => ImportResult::Ok { file },
            Err(code) => ImportResult::Failed {
                original_name: path
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_default(),
                code,
            },
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("evp-import-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("files")).unwrap();
        fs::create_dir_all(dir.join("thumbs")).unwrap();
        dir
    }

    fn png_bytes(w: u32, h: u32) -> Vec<u8> {
        let img = image::RgbImage::from_pixel(w, h, image::Rgb([200, 30, 30]));
        let mut out = Cursor::new(Vec::new());
        img.write_to(&mut out, image::ImageFormat::Png).unwrap();
        out.into_inner()
    }

    #[test]
    fn imports_text_spreadsheet_and_word_files_as_documents() {
        let project = scratch("docs");
        for (name, content) in [
            ("notas.txt", b"09:00 inicio".to_vec()),
            ("lista.csv", "a;b\n1;2".as_bytes().to_vec()),
            ("plano.docx", b"PK\x03\x04rest".to_vec()),
        ] {
            let source = project.join(name);
            fs::write(&source, content).unwrap();
            let file = import_one(&project, &source).unwrap();
            assert_eq!(file.kind, "doc");
            assert_eq!(
                (file.width, file.pages, file.thumb_name.is_none()),
                (None, None, true)
            );
            assert!(project.join("files").join(&file.stored_name).exists());
            assert_eq!(file.original_name, name);
        }
    }

    #[test]
    fn refuses_documents_that_are_not_what_their_name_says() {
        let project = scratch("fake-docs");
        let fake_docx = project.join("falso.docx");
        fs::write(&fake_docx, b"plain text, not a zip").unwrap();
        assert_eq!(
            import_one(&project, &fake_docx).err(),
            Some("doc_unreadable")
        );
        let binary = project.join("binario.txt");
        fs::write(&binary, [b'a', 0, b'b']).unwrap();
        assert_eq!(import_one(&project, &binary).err(), Some("doc_unreadable"));
    }

    #[test]
    fn imports_an_image_and_detects_the_duplicate() {
        let project = scratch("dup");
        let source = project.join("print.png");
        fs::write(&source, png_bytes(40, 20)).unwrap();

        let first = import_one(&project, &source).unwrap();
        assert_eq!((first.width, first.height), (Some(40), Some(20)));
        assert!(!first.duplicate);
        assert!(project.join("files").join(&first.stored_name).exists());
        assert!(first.thumb_name.is_some());

        let second = import_one(&project, &source).unwrap();
        assert!(second.duplicate);
        assert_eq!(first.stored_name, second.stored_name);
    }

    #[test]
    fn rejects_other_file_types() {
        let project = scratch("type");
        let source = project.join("archive.zip");
        fs::write(&source, b"x").unwrap();
        assert_eq!(import_one(&project, &source).err(), Some("unsupported"));
    }

    #[test]
    fn rejects_a_pdf_that_cannot_be_parsed() {
        let project = scratch("pdf");
        let source = project.join("broken.pdf");
        fs::write(&source, b"not a pdf").unwrap();
        assert_eq!(import_one(&project, &source).err(), Some("pdf_unreadable"));
    }

    #[test]
    fn reads_no_exif_from_plain_images() {
        let info = read_exif(&png_bytes(4, 4));
        assert!(info.date.is_none());
        assert_eq!(info.orientation, 1);
    }
}
