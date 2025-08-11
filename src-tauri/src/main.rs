#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri_plugin_updater::{Builder as UpdaterBuilder, UpdaterExt};
use std::{path::{PathBuf}, fs, process::Command};
use serde::{Serialize, Deserialize};
use dirs::home_dir;
use anyhow::Result;

#[derive(Serialize, Deserialize, Clone)]
struct Settings { ram: u64, width: u32, height: u32, fullscreen: bool }

fn data_dir() -> PathBuf { home_dir().unwrap().join(".shindo") }
fn java_dir() -> PathBuf { data_dir().join("java") }
fn client_dir() -> PathBuf { data_dir().join("client") }
fn settings_file() -> PathBuf { data_dir().join("settings.json") }

#[tauri::command]
fn app_version() -> String { env!("CARGO_PKG_VERSION").to_string() }

#[tauri::command]
async fn run_updater(app: tauri::AppHandle) -> Result<(), String> {
  // UpdaterExt fornece .updater() no AppHandle
  match app.updater() {
    Ok(updater) => {
      // dispara verificação agora
      let _ = updater.check().await;
      Ok(())
    }
    Err(e) => Err(format!("Updater não inicializado: {e}")),
  }
}

#[tauri::command]
async fn load_settings() -> Result<Settings, String> {
  let path = settings_file();
  if path.exists() {
    let txt = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&txt).map_err(|e| e.to_string())
  } else {
    Ok(Settings { ram: 2048, width: 1280, height: 720, fullscreen: false })
  }
}

#[tauri::command]
async fn save_settings(ram: u64, width: u32, height: u32, fullscreen: bool) -> Result<(), String> {
  fs::create_dir_all(data_dir()).map_err(|e| e.to_string())?;
  let s = Settings { ram, width, height, fullscreen };
  let txt = serde_json::to_string_pretty(&s).map_err(|e| e.to_string())?;
  fs::write(settings_file(), txt).map_err(|e| e.to_string())
}

#[tauri::command]
async fn ensure_java() -> Result<(), String> {
  fs::create_dir_all(java_dir()).map_err(|e| e.to_string())?;
  // TODO: baixar Azul Zulu JDK dinamicamente por SO/arch
  Ok(())
}

#[tauri::command]
async fn ensure_client(zip_url: String) -> Result<(), String> {
    fs::create_dir_all(client_dir()).map_err(|e| e.to_string())?;

    // Baixar o ZIP do cliente
    let bytes = reqwest::get(&zip_url)
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let zip_path = client_dir().join("ShindoClient.zip");
    fs::write(&zip_path, &bytes).map_err(|e| e.to_string())?;

    // Extrair o ZIP
    let file = fs::File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let out_path = client_dir().join(file.mangled_name());
        if file.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = out_path.parent() {
                fs::create_dir_all(p).map_err(|e| e.to_string())?;
            }
            let mut outfile = fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn ensure_assets_and_libs() -> Result<(), String> {
  fs::create_dir_all(client_dir().join("libraries")).map_err(|e| e.to_string())?;
  fs::create_dir_all(client_dir().join("assets")).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
async fn start_client() -> Result<(), String> {
  let s: Settings = load_settings().await.map_err(|e| e)?;
  let java_bin = if cfg!(target_os = "windows") {
    java_dir().join("jdk").join("bin").join("java.exe")
  } else {
    java_dir().join("jdk").join("bin").join("java")
  };
  // TODO: montar classpath real com libs + jar do cliente, e args do JSON
  let mut cmd = Command::new(java_bin);
  cmd.arg(format!("-Xmx{}m", s.ram))
     .arg("-version");
  cmd.spawn().map_err(|e| e.to_string())?;
  Ok(())
}

#[tokio::main]
async fn main() {
  tauri::Builder::default()
    .plugin(UpdaterBuilder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_os::init())
    .invoke_handler(tauri::generate_handler![
      app_version, run_updater, load_settings, save_settings,
      ensure_java, ensure_client, ensure_assets_and_libs, start_client
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
