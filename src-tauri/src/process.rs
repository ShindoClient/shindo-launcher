use std::process::Stdio as StdStdio;

pub struct LaunchArgs {
    pub java_path: String,
    pub jvm_args: Vec<String>,
    pub game_args: Vec<String>,
}

pub fn build_args(java_path: String, jvm_args: Vec<String>, game_args: Vec<String>) -> LaunchArgs {
    LaunchArgs { java_path, jvm_args, game_args }
}

pub async fn spawn_process(args: LaunchArgs) -> anyhow::Result<()> {
    #[cfg(feature = "tokio_process")] {
        let mut cmd = tokio::process::Command::new(args.java_path);
        cmd.args(args.jvm_args).args(args.game_args).stdout(tokio::process::Stdio::piped()).stderr(tokio::process::Stdio::piped());
        let _child = cmd.spawn()?;
        return Ok(());
    }
    #[allow(unused)]
    {
        let mut cmd = std::process::Command::new(args.java_path);
        cmd.args(args.jvm_args).args(args.game_args).stdout(StdStdio::piped()).stderr(StdStdio::piped());
        let _child = cmd.spawn()?;
        Ok(())
    }
}
