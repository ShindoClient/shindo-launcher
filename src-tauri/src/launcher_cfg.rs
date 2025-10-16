use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LauncherConfig {
    pub java: JavaCfg,
    pub memory: MemoryCfg,
    pub resolution: ResolutionCfg,
    pub jvmArgs: Vec<String>,
    pub client: ClientCfg,
    pub featuredImagePath: String,
    pub gameDir: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JavaCfg { pub distro: String, pub path: Option<String> }
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryCfg { pub min: u32, pub max: u32 }
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResolutionCfg { pub width: u32, pub height: u32, pub fullscreen: bool }
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClientCfg { pub git: GitCfg }
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitCfg { pub url: String, pub branch: String }

pub fn data_dir() -> PathBuf {
    #[cfg(target_os = "windows")] {
        let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
        return base.join("Shindo");
    }
    #[cfg(target_os = "macos")] {
        let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
        return base.join("Shindo");
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))] {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        return home.join(".shindo");
    }
}

pub fn config_path() -> PathBuf { data_dir().join("config.json") }

pub fn load_or_default() -> anyhow::Result<LauncherConfig> {
    let path = config_path();
    if path.exists() {
        let s = fs::read_to_string(path)?;
        let cfg: LauncherConfig = serde_json::from_str(&s)?;
        return Ok(cfg);
    }
    let cfg = LauncherConfig {
        java: JavaCfg { distro: "Zulu".into(), path: None },
        memory: MemoryCfg { min: 512, max: 4096 },
        resolution: ResolutionCfg { width: 1280, height: 720, fullscreen: false },
        jvmArgs: vec![],
        client: ClientCfg { git: GitCfg { url: String::new(), branch: "main".into() } },
        featuredImagePath: String::new(),
        gameDir: data_dir().to_string_lossy().to_string(),
    };
    save(&cfg)?;
    Ok(cfg)
}

pub fn save(cfg: &LauncherConfig) -> anyhow::Result<()> {
    let dir = data_dir();
    std::fs::create_dir_all(&dir)?;
    let path = config_path();
    let s = serde_json::to_string_pretty(cfg)?;
    fs::write(path, s)?;
    Ok(())
}
