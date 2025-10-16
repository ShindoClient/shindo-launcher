use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Clone)]
pub struct ProgressEvt {
    pub phase: String,
    pub step: String,
    pub current: u64,
    pub total: u64,
    pub percent: f32,
}

impl ProgressEvt {
    pub fn new(phase: &str, step: &str, current: u64, total: u64, percent: f32) -> Self {
        Self { phase: phase.into(), step: step.into(), current, total, percent }
    }
}

pub fn emit_progress(app: &AppHandle, evt: ProgressEvt) -> tauri::Result<()> {
    app.emit("progress", evt)
}
