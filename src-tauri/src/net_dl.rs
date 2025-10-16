use anyhow::Context;
use tokio::sync::Semaphore;
use std::sync::Arc;

pub async fn download_all(urls: Vec<String>, _target_dir: &str, max_concurrency: usize) -> anyhow::Result<()> {
    let sem = Arc::new(Semaphore::new(max_concurrency));
    let mut tasks = Vec::new();
    for u in urls {
        let permit_sem = sem.clone();
        let url = u.clone();
        tasks.push(tokio::spawn(async move {
            let _permit = permit_sem.acquire_owned().await.unwrap();
            let _ = reqwest::get(&url).await?.error_for_status()?;
            anyhow::Ok(())
        }));
    }
    for t in tasks { t.await.context("download task join")??; }
    Ok(())
}
