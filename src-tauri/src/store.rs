use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::error::{AppError, Result};

const DIRS: [&str; 4] = ["files", "thumbs", "prepared-mid", "prepared-high"];

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

pub(crate) fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 200
        && !name.starts_with('.')
        && !name.contains(['/', '\\', '\0'])
}

pub fn projects_root(app: &AppHandle) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| AppError::NotFound)?
        .join("projects");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn project_dir(root: &Path, id: &str) -> Result<PathBuf> {
    if !valid_id(id) {
        return Err(AppError::InvalidName);
    }
    Ok(root.join(id))
}

pub fn ensure_dirs(dir: &Path) -> Result<()> {
    for sub in DIRS {
        fs::create_dir_all(dir.join(sub))?;
    }
    Ok(())
}

pub fn file_path(root: &Path, id: &str, dir: &str, name: &str) -> Result<PathBuf> {
    if !DIRS.contains(&dir) || !valid_name(name) {
        return Err(AppError::InvalidName);
    }
    Ok(project_dir(root, id)?.join(dir).join(name))
}

// Writes next to the target and renames, so a crash never leaves a half-written project.
pub fn write_atomic(target: &Path, bytes: &[u8]) -> Result<()> {
    let mut tmp = target.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, target).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })?;
    Ok(())
}

#[tauri::command]
pub fn list_projects(app: AppHandle) -> Result<Vec<String>> {
    let root = projects_root(&app)?;
    let mut ids = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if valid_id(&name) && entry.path().join("project.json").is_file() {
            ids.push(name);
        }
    }
    Ok(ids)
}

#[tauri::command]
pub fn read_project(app: AppHandle, id: String) -> Result<String> {
    let path = project_dir(&projects_root(&app)?, &id)?.join("project.json");
    fs::read_to_string(path).map_err(|_| AppError::NotFound)
}

#[tauri::command]
pub fn write_project(app: AppHandle, id: String, json: String) -> Result<()> {
    let dir = project_dir(&projects_root(&app)?, &id)?;
    ensure_dirs(&dir)?;
    write_atomic(&dir.join("project.json"), json.as_bytes())
}

#[tauri::command]
pub fn delete_project(app: AppHandle, id: String) -> Result<()> {
    let dir = project_dir(&projects_root(&app)?, &id)?;
    if dir.exists() {
        fs::remove_dir_all(dir)?;
    }
    Ok(())
}

#[tauri::command]
pub fn read_project_file(
    app: AppHandle,
    id: String,
    dir: String,
    name: String,
) -> Result<tauri::ipc::Response> {
    let path = file_path(&projects_root(&app)?, &id, &dir, &name)?;
    Ok(tauri::ipc::Response::new(
        fs::read(path).map_err(|_| AppError::NotFound)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_ids_and_names_that_escape_the_project() {
        let root = Path::new("/data/projects");
        assert!(project_dir(root, "abc-123_x").is_ok());
        assert!(project_dir(root, "../etc").is_err());
        assert!(project_dir(root, "").is_err());
        assert!(file_path(root, "abc", "files", "a.png").is_ok());
        assert!(file_path(root, "abc", "files", "../a.png").is_err());
        assert!(file_path(root, "abc", "files", "sub/a.png").is_err());
        assert!(file_path(root, "abc", "secrets", "a.png").is_err());
        assert!(file_path(root, "abc", "files", ".hidden").is_err());
    }

    #[test]
    fn atomic_write_replaces_content_without_leftovers() {
        let dir = std::env::temp_dir().join(format!("evp-store-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let target = dir.join("project.json");
        write_atomic(&target, b"one").unwrap();
        write_atomic(&target, b"two").unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"two");
        assert!(!dir.join("project.json.tmp").exists());
    }
}
