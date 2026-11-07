use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use tauri::AppHandle;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::error::{AppError, Result};
use crate::store::{ensure_dirs, project_dir, projects_root, valid_name, write_atomic};

// Only the originals and thumbnails travel; the prepared images are rebuilt on export.
const PACKED_DIRS: [&str; 2] = ["files", "thumbs"];
const MAX_ENTRIES: usize = 20_000;
const MAX_FILE: u64 = 1 << 30;
const MAX_TOTAL: u64 = 8 << 30;
const MAX_PROJECT_JSON: u64 = 32 << 20;

fn zip_err(e: impl std::fmt::Display) -> AppError {
    AppError::Zip(e.to_string())
}

fn has_extension(path: &Path, wanted: &str) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case(wanted))
}

/// Writes `project.json` plus the originals and thumbnails into a `.evpack` (a zip with a fixed layout).
pub fn pack(root: &Path, project_id: &str, target: &Path) -> Result<()> {
    if !has_extension(target, "evpack") {
        return Err(AppError::UnsupportedType);
    }
    let dir = project_dir(root, project_id)?;
    let mut tmp = target.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);

    let build = || -> Result<()> {
        let mut zip = ZipWriter::new(File::create(&tmp)?);
        let deflated = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        zip.start_file("project.json", deflated).map_err(zip_err)?;
        zip.write_all(&fs::read(dir.join("project.json")).map_err(|_| AppError::NotFound)?)?;
        for sub in PACKED_DIRS {
            let Ok(entries) = fs::read_dir(dir.join(sub)) else {
                continue;
            };
            for entry in entries {
                let entry = entry?;
                let name = entry.file_name().to_string_lossy().into_owned();
                if !entry.path().is_file() || !valid_name(&name) {
                    continue;
                }
                zip.start_file(format!("{sub}/{name}"), stored)
                    .map_err(zip_err)?;
                std::io::copy(&mut File::open(entry.path())?, &mut zip)?;
            }
        }
        zip.finish().map_err(zip_err)?;
        Ok(())
    };
    let result = build().and_then(|()| fs::rename(&tmp, target).map_err(AppError::from));
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

/// Unpacks into a new project folder and returns the `project.json` text. Entry names are never
/// used as paths: each one is matched against the fixed layout and rebuilt from a validated name.
pub fn unpack(root: &Path, new_id: &str, source: &Path) -> Result<String> {
    if !has_extension(source, "evpack") {
        return Err(AppError::UnsupportedType);
    }
    let dest = project_dir(root, new_id)?;
    if dest.exists() {
        return Err(AppError::BadRequest);
    }
    let stage = root.join(format!(".import-{new_id}"));
    let _ = fs::remove_dir_all(&stage);
    fs::create_dir_all(&stage)?;

    let run = || -> Result<String> {
        ensure_dirs(&stage)?;
        let mut archive = ZipArchive::new(File::open(source)?).map_err(|_| AppError::BadArchive)?;
        if archive.len() > MAX_ENTRIES {
            return Err(AppError::BadArchive);
        }
        let mut json: Option<String> = None;
        let mut total = 0u64;
        for i in 0..archive.len() {
            let entry = archive.by_index(i).map_err(zip_err)?;
            if entry.is_dir() {
                continue;
            }
            let name = entry.name().map_err(zip_err)?.into_owned();
            let limit = if name == "project.json" {
                MAX_PROJECT_JSON
            } else {
                MAX_FILE
            };
            total += entry.size();
            if entry.size() > limit || total > MAX_TOTAL {
                return Err(AppError::BadArchive);
            }
            // `take` keeps the real size honest even if the header understates it.
            let mut reader = entry.take(limit + 1);
            if name == "project.json" {
                let mut text = String::new();
                reader.read_to_string(&mut text)?;
                json = Some(text);
                continue;
            }
            let Some((sub, file)) = name.split_once('/') else {
                continue;
            };
            if !PACKED_DIRS.contains(&sub) || !valid_name(file) {
                continue;
            }
            let mut bytes = Vec::new();
            reader.read_to_end(&mut bytes)?;
            if bytes.len() as u64 > limit {
                return Err(AppError::BadArchive);
            }
            write_atomic(&stage.join(sub).join(file), &bytes)?;
        }
        json.ok_or(AppError::BadArchive)
    };

    match run() {
        Ok(json) => {
            fs::rename(&stage, &dest).inspect_err(|_| {
                let _ = fs::remove_dir_all(&stage);
            })?;
            Ok(json)
        }
        Err(e) => {
            let _ = fs::remove_dir_all(&stage);
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn export_project(app: AppHandle, project_id: String, target: PathBuf) -> Result<()> {
    let root = projects_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || pack(&root, &project_id, &target))
        .await
        .map_err(zip_err)?
}

#[tauri::command]
pub async fn import_project(app: AppHandle, source: PathBuf, new_id: String) -> Result<String> {
    let root = projects_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || unpack(&root, &new_id, &source))
        .await
        .map_err(zip_err)?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("evp-backup-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn sample_project(root: &Path, id: &str) {
        let dir = root.join(id);
        ensure_dirs(&dir).unwrap();
        fs::write(dir.join("project.json"), br#"{"id":"p1","title":"T"}"#).unwrap();
        fs::write(dir.join("files").join("a.png"), b"original").unwrap();
        fs::write(dir.join("thumbs").join("a.jpg"), b"thumb").unwrap();
        fs::write(dir.join("prepared-mid").join("a.jpg"), b"cache").unwrap();
    }

    #[test]
    fn round_trips_a_project_without_the_caches() {
        let root = scratch("round");
        sample_project(&root, "p1");
        let pack_file = root.join("t.evpack");
        pack(&root, "p1", &pack_file).unwrap();

        let json = unpack(&root, "p2", &pack_file).unwrap();
        assert!(json.contains("\"title\":\"T\""));
        let copy = root.join("p2");
        assert_eq!(fs::read(copy.join("files/a.png")).unwrap(), b"original");
        assert_eq!(fs::read(copy.join("thumbs/a.jpg")).unwrap(), b"thumb");
        assert!(!copy.join("prepared-mid/a.jpg").exists());
        assert!(!root.join(".import-p2").exists());
    }

    #[test]
    fn refuses_an_existing_project_id_and_other_extensions() {
        let root = scratch("existing");
        sample_project(&root, "p1");
        let pack_file = root.join("t.evpack");
        pack(&root, "p1", &pack_file).unwrap();
        assert!(matches!(
            unpack(&root, "p1", &pack_file),
            Err(AppError::BadRequest)
        ));
        assert!(matches!(
            pack(&root, "p1", &root.join("t.zip")),
            Err(AppError::UnsupportedType)
        ));
        assert!(matches!(
            unpack(&root, "p3", &root.join("t.zip")),
            Err(AppError::UnsupportedType)
        ));
    }

    #[test]
    fn ignores_entries_outside_the_layout_and_never_writes_outside() {
        let root = scratch("hostile");
        let evil = root.join("evil.evpack");
        {
            let mut zip = ZipWriter::new(File::create(&evil).unwrap());
            let opt = SimpleFileOptions::default();
            zip.start_file("project.json", opt).unwrap();
            zip.write_all(b"{}").unwrap();
            for name in [
                "../escape.txt",
                "files/../../escape2.txt",
                "/abs.txt",
                "other/x.bin",
                "files/.hidden",
            ] {
                zip.start_file(name, opt).unwrap();
                zip.write_all(b"x").unwrap();
            }
            zip.finish().unwrap();
        }
        unpack(&root, "p9", &evil).unwrap();
        assert!(!root.parent().unwrap().join("escape.txt").exists());
        assert!(!root.join("escape2.txt").exists());
        assert!(!root.join("p9").join("other").exists());
        assert_eq!(fs::read_dir(root.join("p9/files")).unwrap().count(), 0);
    }

    #[test]
    fn rejects_archives_without_a_project_file() {
        let root = scratch("nojson");
        let bad = root.join("bad.evpack");
        {
            let mut zip = ZipWriter::new(File::create(&bad).unwrap());
            zip.start_file("files/a.png", SimpleFileOptions::default())
                .unwrap();
            zip.write_all(b"x").unwrap();
            zip.finish().unwrap();
        }
        assert!(matches!(
            unpack(&root, "p5", &bad),
            Err(AppError::BadArchive)
        ));
        assert!(!root.join("p5").exists());
        assert!(!root.join(".import-p5").exists());
    }
}
