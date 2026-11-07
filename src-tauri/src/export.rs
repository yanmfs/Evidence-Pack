use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};

use percent_encoding::percent_decode_str;
use serde::Deserialize;
use tauri::ipc::{InvokeBody, Request};
use tauri::AppHandle;

use crate::error::{AppError, Result};
use crate::store::{file_path, projects_root, write_atomic};

// The file travels as the raw request body; the target path goes in a percent-encoded header.
#[tauri::command]
pub fn save_file(request: Request) -> Result<()> {
    let target = request
        .headers()
        .get("x-target")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| {
            percent_decode_str(v)
                .decode_utf8()
                .ok()
                .map(|s| PathBuf::from(s.as_ref()))
        })
        .ok_or(AppError::BadRequest)?;
    let ext = target
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .unwrap_or_default();
    if ext != "pdf" && ext != "zip" {
        return Err(AppError::UnsupportedType);
    }
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(AppError::BadRequest);
    };
    write_atomic(&target, bytes)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZipEntry {
    stored_name: String,
    path: String,
}

fn safe_entry_path(path: &str) -> bool {
    !path.is_empty()
        && !path.starts_with('/')
        && !path.contains('\\')
        && !path.split('/').any(|part| part.is_empty() || part == "..")
}

/// Originals are stored as they are (images and PDFs are already compressed); only the CSV is deflated.
pub fn write_zip(
    root: &Path,
    project_id: &str,
    target: &Path,
    entries: &[ZipEntry],
    csv: &str,
) -> Result<()> {
    use zip::write::SimpleFileOptions;
    use zip::CompressionMethod;

    let mut tmp = target.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    let build = || -> Result<()> {
        let mut zip = zip::ZipWriter::new(File::create(&tmp)?);
        let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        for entry in entries {
            if !safe_entry_path(&entry.path) {
                return Err(AppError::InvalidName);
            }
            let source = file_path(root, project_id, "files", &entry.stored_name)?;
            zip.start_file(entry.path.as_str(), stored)
                .map_err(|e| AppError::Zip(e.to_string()))?;
            zip.write_all(&std::fs::read(source).map_err(|_| AppError::NotFound)?)?;
        }
        let deflated = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        zip.start_file("indice.csv", deflated)
            .map_err(|e| AppError::Zip(e.to_string()))?;
        zip.write_all(csv.as_bytes())?;
        zip.finish().map_err(|e| AppError::Zip(e.to_string()))?;
        Ok(())
    };
    let result = build().and_then(|()| std::fs::rename(&tmp, target).map_err(AppError::from));
    if result.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    result
}

#[tauri::command]
pub async fn export_zip(
    app: AppHandle,
    project_id: String,
    target: PathBuf,
    entries: Vec<ZipEntry>,
    csv: String,
) -> Result<()> {
    if target
        .extension()
        .and_then(|e| e.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
        != Some("zip")
    {
        return Err(AppError::UnsupportedType);
    }
    let root = projects_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        write_zip(&root, &project_id, &target, &entries, &csv)
    })
    .await
    .map_err(|e| AppError::Zip(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn rejects_entry_paths_that_escape_the_archive() {
        assert!(safe_entry_path("01 - A/001 - x.png"));
        assert!(!safe_entry_path("../x.png"));
        assert!(!safe_entry_path("/abs/x.png"));
        assert!(!safe_entry_path("a//b.png"));
        assert!(!safe_entry_path(""));
    }

    #[test]
    fn packs_originals_untouched_with_the_csv() {
        let root = std::env::temp_dir().join(format!("evp-zip-{}", std::process::id()));
        let files = root.join("p1").join("files");
        std::fs::create_dir_all(&files).unwrap();
        std::fs::write(files.join("abc.png"), b"png-bytes").unwrap();
        let target = root.join("out.zip");
        let entries = [ZipEntry {
            stored_name: "abc.png".into(),
            path: "01 - A/001 - x.png".into(),
        }];

        write_zip(&root, "p1", &target, &entries, "\u{FEFF}a;b\r\n").unwrap();

        let mut archive = zip::ZipArchive::new(File::open(&target).unwrap()).unwrap();
        let mut original = Vec::new();
        archive
            .by_name("01 - A/001 - x.png")
            .unwrap()
            .read_to_end(&mut original)
            .unwrap();
        assert_eq!(original, b"png-bytes");
        let mut csv = String::new();
        archive
            .by_name("indice.csv")
            .unwrap()
            .read_to_string(&mut csv)
            .unwrap();
        assert!(csv.starts_with('\u{FEFF}'));
        assert!(!root.join("out.zip.tmp").exists());
    }
}
