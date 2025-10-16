#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod launcher_cfg;
mod self_update;
mod client_update;
mod mojang;
mod java_mgr;
mod net_dl;
mod process;
mod progress_bus;

use tauri::Manager;
use tracing_subscriber::{EnvFilter, fmt};

#[tauri::command]
async fn cmd_check_updates(app: tauri::AppHandle) -> Result<bool, String> {
  use tauri_plugin_updater::UpdaterExt;
  if let Ok(update) = app.updater().check().await { return Ok(update.is_update_available()); }
  self_update::run(&app).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn cmd_apply_update(app: tauri::AppHandle) -> Result<bool, String> {
  use tauri_plugin_updater::UpdaterExt;
  if let Ok(update) = app.updater().check().await {
    if update.is_update_available() {
      update.download_and_install(|_d,_t|{}).await.map_err(|e| e.to_string())?;
      return Ok(true);
    }
  }
  Ok(false)
}

#[tauri::command]
async fn cmd_play(app: tauri::AppHandle) -> Result<(), String> {
  let cfg = launcher_cfg::load_or_default().map_err(|e| e.to_string())?;
  let client_dir = std::path::PathBuf::from(launcher_cfg::data_dir()).join("client");
  let base_mc = client_update::run(&app, &cfg.client.git.url, &cfg.client.git.branch, &client_dir)
    .await.map_err(|e| e.to_string())?;

  progress_bus::emit_progress(&app, progress_bus::ProgressEvt::new("resolve_manifest", "download manifest", 0, 3, 0.0)).ok();
  let manifest = mojang::fetch_manifest().await.map_err(|e| e.to_string())?;
  let wanted = base_mc.unwrap_or(manifest.latest.release.clone());
  let ver_ref = manifest.versions.iter().find(|v| v.id == wanted)
    .ok_or_else(|| format!("versão {} não encontrada no manifest", wanted))
    .map_err(|e| e.to_string())?;
  progress_bus::emit_progress(&app, progress_bus::ProgressEvt::new("resolve_manifest", &format!("download {} json", wanted), 1, 3, 34.0)).ok();
  let _version_json = mojang::fetch_version_json(&ver_ref.url).await.map_err(|e| e.to_string())?;

  let _java = java_mgr::ensure_runtime(&cfg.java.distro).await.map_err(|e| e.to_string())?;
  let args = process::build_args("java".into(), vec!["-version".into()], vec![]);
  progress_bus::emit_progress(&app, progress_bus::ProgressEvt::new("launch", "starting", 0, 1, 0.0)).ok();
  let _ = process::spawn_process(args).await.map_err(|e| e.to_string())?;
  progress_bus::emit_progress(&app, progress_bus::ProgressEvt::new("launch", "started", 1, 1, 100.0)).ok();
  Ok(())
}

fn main() {
  let _ = fmt().with_env_filter(EnvFilter::from_default_env()).init();

  tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![cmd_check_updates, cmd_apply_update, cmd_play])
    .setup(|_app| {
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
