use crate::progress_bus::{emit_progress, ProgressEvt};
use tauri::AppHandle;

pub async fn run(app: &AppHandle) -> anyhow::Result<bool> {
    emit_progress(app, ProgressEvt::new("launcher_update", "checking", 0, 3, 0.0)).ok();
    // Em um cenário real: comparar versão/local com remoto, baixar artefato e aplicar.
    // Aqui mantemos um stub seguro que apenas reporta status sem modificar binários.
    emit_progress(app, ProgressEvt::new("launcher_update", "up-to-date", 2, 3, 66.0)).ok();
    emit_progress(app, ProgressEvt::new("launcher_update", "done", 3, 3, 100.0)).ok();
    Ok(false)
}
