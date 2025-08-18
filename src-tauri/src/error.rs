use anyhow::{anyhow, Error};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LauncherError {
    #[error("Invalid version profile: {0}")]
    InvalidVersionProfile(String),
    #[error("Unknown template parameter: {0}")]
    UnknownTemplateParameter(String),
}

pub fn map_into_connection_error(e: Error) -> Error {
    anyhow!(
        "Failed to download file. This might have been caused by connection issues. Please try using a VPN such as Cloudflare Warp.\n\nError: {}",
        e
    )
}