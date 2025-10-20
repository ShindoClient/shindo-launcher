export const enum IpcChannel {
  Ping = 'shindo:ping',
  EnsureClient = 'shindo:client.ensure',
  ClientState = 'shindo:client.state',
  LauncherCheckUpdate = 'shindo:launcher.check-update',
  LauncherDownloadUpdate = 'shindo:launcher.download-update',
  ConfigGet = 'shindo:config.get',
  ConfigSet = 'shindo:config.set',
  SystemMemory = 'shindo:system.memory',
  RunStartupUpdate = 'shindo:update.run',
  LaunchStart = 'shindo:launch.start',
  WindowMinimize = 'shindo:window.minimize',
  WindowClose = 'shindo:window.close',
}

export const enum IpcEvent {
  UpdateProgress = 'shindo:update.progress',
  UpdateCompleted = 'shindo:update.completed',
  UpdateError = 'shindo:update.error',
  LaunchLog = 'shindo:launch.log',
  LaunchExit = 'shindo:launch.exit',
}

export interface ReleaseAssetInfo {
  name: string;
  downloadUrl: string;
  size?: number;
  contentType?: string;
}

export interface ReleaseInfo {
  id?: number;
  name?: string;
  tagName?: string;
  url?: string;
  body?: string;
  publishedAt?: string;
  assets: ReleaseAssetInfo[];
}

export interface ClientStatePayload {
  version: string | null;
  baseVersion: string | null;
  versionId: string;
  clientDir: string;
  versionJsonPath: string | null;
  clientPackagePath?: string | null;
  assetsIndex?: string | null;
}

export interface ClientUpdatePayload extends ClientStatePayload {
  updated: boolean;
  release?: ReleaseInfo;
}

export interface LauncherUpdateInfoPayload {
  updateAvailable: boolean;
  currentVersion: string | null;
  latestVersion: string | null | undefined;
  release?: ReleaseInfo;
  asset?: ReleaseAssetInfo | null;
}

export interface LauncherUpdateResultPayload extends LauncherUpdateInfoPayload {
  downloadedPath?: string;
}

export interface MemoryOptions {
  min?: string;
  max?: string;
}

export interface LaunchClientOptionsPayload {
  username?: string;
  javaPath?: string;
  memory?: MemoryOptions;
  customArgs?: string[];
  customLaunchArgs?: string[];
  versionId?: string;
}

export interface LaunchClientResultPayload {
  pid: number | null;
  command: string[];
  startedAt: number;
}

export interface LauncherBridge {
  ensureClientUpToDate(options?: { force?: boolean }): Promise<ClientUpdatePayload>;
  getClientState(): Promise<ClientStatePayload>;
  checkLauncherUpdate(): Promise<LauncherUpdateInfoPayload>;
  downloadLauncherUpdate(): Promise<LauncherUpdateResultPayload>;
  launchClient(options?: LaunchClientOptionsPayload): Promise<LaunchClientResultPayload>;
  getConfig(): Promise<LauncherConfig>;
  setConfig(patch: Partial<LauncherConfig>): Promise<LauncherConfig>;
  getSystemMemory(): Promise<SystemMemoryInfo>;
  runStartupUpdate(): Promise<void>;
  minimizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  onUpdateProgress(callback: (event: UpdateProgressPayload) => void): () => void;
  onUpdateCompleted(callback: (payload: UpdateCompletionPayload) => void): () => void;
  onUpdateError(callback: (payload: UpdateErrorPayload) => void): () => void;
  onLaunchLog(callback: (payload: LaunchLogPayload) => void): () => void;
  onLaunchExit(callback: (payload: LaunchExitPayload) => void): () => void;
}

export interface LauncherConfig {
  ramGB: number;
  jrePreference: 'zulu' | 'temurin' | 'system';
  jrePath?: string;
  jvmArgs: string;
  versionId: string;
  showLogsOnLaunch: boolean;
}

export interface SystemMemoryInfo {
  totalGB: number;
}

export type UpdateStep =
  | 'launcher-update'
  | 'jre-setup'
  | 'client-update';

export interface UpdateProgressPayload {
  step: UpdateStep;
  message: string;
  percent: number;
  phaseIndex: number;
  phaseTotal: number;
}

export interface UpdateCompletionPayload {
  success: true;
}

export interface UpdateErrorPayload {
  success: false;
  message: string;
}

export interface LaunchLogPayload {
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface LaunchExitPayload {
  code: number | null;
}
