use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionManifestIndex {
    pub latest: Latest,
    pub versions: Vec<VersionRef>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Latest { pub release: String, pub snapshot: String }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionRef { pub id: String, pub url: String, #[serde(rename = "type")] pub typ: Option<String>, #[serde(rename = "releaseTime")] pub release_time: Option<String> }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionDetail {
    pub id: String,
    pub assets: String,
    pub libraries: Vec<Library>,
    #[serde(rename = "mainClass")] pub main_class: Option<String>,
    #[serde(rename = "minecraftArguments")] pub legacy_args: Option<String>,
    pub arguments: Option<Arguments>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Arguments { pub game: Option<Vec<Arg>>, pub jvm: Option<Vec<Arg>> }

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum Arg { Str(String), Obj(ArgObj) }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ArgObj { pub value: Vec<String>, pub rules: Option<Vec<Rule>> }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Rule { pub action: String, pub os: Option<OsRule> }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OsRule { pub name: Option<String>, pub arch: Option<String> }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Library { pub name: String, pub downloads: Option<LibraryDownloads>, pub rules: Option<Vec<Rule>> }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryDownloads { pub artifact: Option<DownloadItem>, pub classifiers: Option<std::collections::HashMap<String, DownloadItem>> }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadItem { pub url: Option<String>, pub path: Option<String>, pub sha1: Option<String>, pub size: Option<u64> }

pub async fn fetch_manifest() -> anyhow::Result<VersionManifestIndex> {
    let url = "https://launchermeta.mojang.com/mc/game/version_manifest.json";
    let resp = reqwest::get(url).await?.error_for_status()?;
    let idx: VersionManifestIndex = resp.json().await?;
    Ok(idx)
}

pub async fn fetch_version_json(url: &str) -> anyhow::Result<VersionDetail> {
    let resp = reqwest::get(url).await?.error_for_status()?;
    let v: VersionDetail = resp.json().await?;
    Ok(v)
}
