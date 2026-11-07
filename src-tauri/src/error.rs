#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("invalid name")]
    InvalidName,
    #[error("not found")]
    NotFound,
    #[error("bad request")]
    BadRequest,
    #[error("unsupported file type")]
    UnsupportedType,
    #[error("image error: {0}")]
    Image(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(
        &self,
        serializer: S,
    ) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
