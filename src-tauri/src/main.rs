#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri_plugin_updater::{Builder as UpdaterBuilder, UpdaterExt};
use std::{path::{PathBuf}, fs, process::Command};
use serde::{Serialize, Deserialize};
use dirs::home_dir;
use anyhow::Result;

use std::{fs, path::PathBuf};
use reqwest::Client;
use tokio::io::AsyncWriteExt;
use std::process::Command;
use zip::ZipArchive;
use std::io::Cursor;

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

fn java_dir() -> PathBuf {
    // Exemplo: ~/.shindo/java
    dirs::home_dir()
        .unwrap()
        .join(".shindo")
        .join("java")
}

#[tauri::command]
async fn ensure_java() -> Result<(), String> {
    fs::create_dir_all(java_dir()).map_err(|e| e.to_string())?;

    // Detecta OS/Arch
    let os = std::env::consts::OS; // "windows", "linux", "macos"
    let arch = std::env::consts::ARCH; // "x86_64", "aarch64"

    // Escolhe o link correto do Azul Zulu JDK 8
    let url = match (os, arch) {
        ("windows", "x86_64") => "https://cdn.azul.com/zulu/bin/zulu8.80.0.15-ca-jdk8.0.422-win_x64.zip",
        ("linux", "x86_64") => "https://cdn.azul.com/zulu/bin/zulu8.80.0.15-ca-jdk8.0.422-linux_x64.tar.gz",
        ("macos", "x86_64") => "https://cdn.azul.com/zulu/bin/zulu8.80.0.15-ca-jdk8.0.422-macosx_x64.zip",
        ("macos", "aarch64") => "https://cdn.azul.com/zulu/bin/zulu8.80.0.15-ca-jdk8.0.422-macosx_aarch64.zip",
        _ => return Err(format!("SO/Arch não suportado: {}/{}", os, arch)),
    };

    let filename = url.split('/').last().unwrap();

    let java_path = java_dir();
    let file_path = java_path.join(filename);

    // Se já tiver baixado, pula
    if file_path.exists() {
        return Ok(());
    }

    println!("Baixando Java de {}", url);

    let client = Client::new();
    let resp = client.get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let mut file = tokio::fs::File::create(&file_path)
        .await
        .map_err(|e| e.to_string())?;
    file.write_all(&resp).await.map_err(|e| e.to_string())?;
    file.flush().await.map_err(|e| e.to_string())?;

    // Extrai dependendo do formato
    if filename.ends_with(".zip") {
        let reader = std::fs::File::open(&file_path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(reader).map_err(|e| e.to_string())?;
        archive.extract(&java_path).map_err(|e| e.to_string())?;
    } else if filename.ends_with(".tar.gz") {
        let status = Command::new("tar")
            .arg("-xzf")
            .arg(file_path.to_string_lossy().to_string())
            .arg("-C")
            .arg(java_path.to_string_lossy().to_string())
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err("Falha ao extrair o tar.gz".into());
        }
    }

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
