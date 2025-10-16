use anyhow::Context;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct JavaRuntime { pub path: PathBuf }

pub fn detect_java() -> Option<JavaRuntime> {
    which::which("java").ok().map(|p| JavaRuntime { path: p })
}

pub async fn ensure_runtime(_vendor: &str) -> anyhow::Result<JavaRuntime> {
    if let Some(rt) = detect_java() { return Ok(rt); }
    Err(anyhow::anyhow!("Java não encontrado e download não implementado"))
        .context("java_mgr.ensure_runtime")
}
