use std::path::PathBuf;

use percent_encoding::percent_decode_str;
use tauri::ipc::{InvokeBody, Request};

use crate::error::{AppError, Result};
use crate::store::write_atomic;

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
