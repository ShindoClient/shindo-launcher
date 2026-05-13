export type JavaMajor = 8 | 11 | 16 | 17 | 21;
export type JavaSource = 'auto' | 'custom';
export type ReleaseChannel = 'stable' | 'snapshot' | 'dev';
export type AppLanguage = 'en' | 'pt';

export interface LauncherConfig {
  ramGB: number;
  javaSource: JavaSource;
  javaPath: string | null;
  javaCustomPath: string | null;
  javaRuntimeMajor: JavaMajor | null;
  jrePath: string | null;
  jvmArgs: string;
  versionId: string;
  selectedBuild: number | null;
  releaseChannel: ReleaseChannel;
  showLogsOnLaunch: boolean;
  language: AppLanguage;
}

export interface SystemMemoryInfo {
  totalGB: number;
}
