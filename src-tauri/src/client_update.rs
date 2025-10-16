use crate::progress_bus::{emit_progress, ProgressEvt};
use anyhow::{Context, Result};
use serde::Deserialize;
use std::{fs, io::Read, path::{Path, PathBuf}};
use tauri::AppHandle;

#[derive(Debug, Deserialize)]
struct ReleaseAsset { name: String, browser_download_url: String }

#[derive(Debug, Deserialize)]
struct ReleaseInfo { assets: Vec<ReleaseAsset>, tag_name: Option<String> }

#[derive(Debug, Deserialize)]
pub struct ShindoClientJson {
    #[serde(rename = "inheritsFrom")] pub inherits_from: Option<String>,
    #[serde(rename = "minecraftVersion")] pub minecraft_version: Option<String>,
}

pub async fn run(app: &AppHandle, _url_ignored: &str, _branch_ignored: &str, dest: &Path) -> Result<Option<String>> {
    emit_progress(app, ProgressEvt::new("client_update", "prepare", 0, 6, 0.0)).ok();
    fs::create_dir_all(dest).ok();

    // 1) Buscar última release via API do GitHub
    emit_progress(app, ProgressEvt::new("client_update", "fetch release", 1, 6, 16.0)).ok();
    let release: ReleaseInfo = reqwest::Client::new()
        .get("https://api.github.com/repos/ShindoClient/Shindo-Client/releases/latest")
        .header("User-Agent", "shindo-launcher")
        .send().await?.error_for_status()?
        .json().await?;

    // 2) Localizar assets
    let version_txt = release.assets.iter().find(|a| a.name.eq_ignore_ascii_case("version.txt"))
        .context("version.txt não encontrado na release")?;
    let zip_asset = release.assets.iter().find(|a| a.name.eq_ignore_ascii_case("ShindoClient.zip"))
        .context("ShindoClient.zip não encontrado na release")?;

    // 3) Baixar version.txt
    emit_progress(app, ProgressEvt::new("client_update", "download version.txt", 2, 6, 32.0)).ok();
    let version_txt_bytes = reqwest::Client::new()
        .get(&version_txt.browser_download_url)
        .header("User-Agent", "shindo-launcher")
        .send().await?.error_for_status()?
        .bytes().await?;
    let version_id = String::from_utf8_lossy(&version_txt_bytes).trim().to_string();
    fs::write(dest.join("version.txt"), &version_txt_bytes)?;

    // 4) Baixar ShindoClient.zip
    emit_progress(app, ProgressEvt::new("client_update", "download ShindoClient.zip", 3, 6, 48.0)).ok();
    let zip_bytes = reqwest::Client::new()
        .get(&zip_asset.browser_download_url)
        .header("User-Agent", "shindo-launcher")
        .send().await?.error_for_status()?
        .bytes().await?;
    let zip_path = dest.join("ShindoClient.zip");
    fs::write(&zip_path, &zip_bytes)?;

    // 5) Extrair ShindoClient.json
    emit_progress(app, ProgressEvt::new("client_update", "extract ShindoClient.json", 4, 6, 64.0)).ok();
    let file = fs::File::open(&zip_path)?;
    let mut zip = zip::ZipArchive::new(file)?;
    let mut json_buf = String::new();
    let mut found = false;
    for i in 0..zip.len() {
        let mut f = zip.by_index(i)?;
        if f.name().ends_with("ShindoClient.json") {
            f.read_to_string(&mut json_buf)?;
            found = true;
            break;
        }
    }
    if !found { anyhow::bail!("ShindoClient.json não encontrado no ZIP"); }
    fs::write(dest.join("ShindoClient.json"), &json_buf)?;

    // 6) Parse e retornar versão base do Minecraft
    emit_progress(app, ProgressEvt::new("client_update", "parse client json", 5, 6, 80.0)).ok();
    let scj: ShindoClientJson = serde_json::from_str(&json_buf)?;
    let base_mc = scj.inherits_from.or(scj.minecraft_version).unwrap_or_else(|| "1.8.9".into());

    emit_progress(app, ProgressEvt::new("client_update", &format!("done ({} / {})", version_id, base_mc), 6, 6, 100.0)).ok();
    Ok(Some(base_mc))
}
