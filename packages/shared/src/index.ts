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
  LaunchStop = 'shindo:launch.stop',
  WindowMinimize = 'shindo:window.minimize',
  WindowClose = 'shindo:window.close',
  AppVersion = 'shindo:app.version',
  AccountsList = 'shindo:accounts.list',
  AccountsAddOffline = 'shindo:accounts.add-offline',
  AccountsAddMicrosoft = 'shindo:accounts.add-microsoft',
  AccountsRemove = 'shindo:accounts.remove',
  AccountsSelect = 'shindo:accounts.select',
  LogWindowOpen = 'shindo:logs.open',
  LogWindowClose = 'shindo:logs.close',
  LaunchLogHistory = 'shindo:launch.log-history',
  LaunchLogClear = 'shindo:launch.log-clear',
  VersionCatalog = 'shindo:catalog.versions',
  JavaChoosePath = 'shindo:java.choose-path',
  JavaValidatePath = 'shindo:java.validate-path',
}

export const enum IpcEvent {
  UpdateProgress = 'shindo:update.progress',
  UpdateCompleted = 'shindo:update.completed',
  UpdateError = 'shindo:update.error',
  LaunchLog = 'shindo:launch.log',
  LaunchExit = 'shindo:launch.exit',
  JreStatus = 'shindo:jre.status',
}

export type LaunchLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type JavaMajor = 8 | 11 | 16 | 17 | 21;

export interface LaunchLogEntry {
  level: LaunchLogLevel;
  message: string;
  timestamp: number;
}

export type JreStatusSeverity = 'info' | 'warning';

export interface JreStatusPayload {
  severity: JreStatusSeverity;
  message: string;
  source: 'config' | 'launch' | 'update';
}

export interface JavaChooserOptions {
  defaultPath?: string;
}

export type JavaSource = 'auto' | 'custom';

export interface JavaValidationResult {
  ok: boolean;
  path: string;
  versionText?: string;
  error?: string;
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

export interface VersionBuildCatalogEntry {
  build: number;
  semver: string | null;
  label: string;
  packageUrl: string | null;
  jarUrl: string | null;
  legacyJarUrl: string | null;
  versionUrl: string | null;
  versionJsonPath: string | null;
  releasedAt: string | null;
}

export interface VersionCatalogEntry {
  id: string;
  name: string;
  enabled: boolean;
  minecraftVersion: string;
  bannerUrl: string | null;
  assetsIndex: string | null;
  baseVersion: string | null;
  latestBuild: number | null;
  latestSemver: string | null;
  builds: VersionBuildCatalogEntry[];
}

export interface VersionCatalogPayload {
  updatedAt: string | null;
  defaultVersionId: string;
  entries: VersionCatalogEntry[];
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
  build?: number | null;
}

export interface LaunchClientResultPayload {
  pid: number | null;
  command: string[];
  startedAt: number;
}

export interface LauncherBridge {
  ensureClientUpToDate(options?: {
    force?: boolean;
    versionId?: string;
    build?: number | null;
  }): Promise<ClientUpdatePayload>;
  getClientState(): Promise<ClientStatePayload>;
  checkLauncherUpdate(): Promise<LauncherUpdateInfoPayload>;
  downloadLauncherUpdate(): Promise<LauncherUpdateResultPayload>;
  launchClient(options?: LaunchClientOptionsPayload): Promise<LaunchClientResultPayload>;
  stopClient(): Promise<boolean>;
  getConfig(): Promise<LauncherConfig>;
  setConfig(patch: Partial<LauncherConfig>): Promise<LauncherConfig>;
  getSystemMemory(): Promise<SystemMemoryInfo>;
  runStartupUpdate(): Promise<void>;
  minimizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  openLogWindow(): Promise<void>;
  closeLogWindow(): Promise<void>;
  getLaunchLogs(): Promise<LaunchLogEntry[]>;
  clearLaunchLogs(): Promise<void>;
  getVersionCatalog(): Promise<VersionCatalogPayload>;
  getVersion(): Promise<string>;
  getAccounts(): Promise<AccountsStatePayload>;
  addOfflineAccount(payload: OfflineAccountRequestPayload): Promise<AccountsStatePayload>;
  addMicrosoftAccount(): Promise<AccountsStatePayload>;
  removeAccount(payload: AccountSelectionPayload): Promise<AccountsStatePayload>;
  selectAccount(payload: AccountSelectionPayload): Promise<AccountsStatePayload>;
  chooseJavaExecutable(options?: JavaChooserOptions): Promise<string | null>;
  validateJavaExecutable(path: string): Promise<JavaValidationResult>;
  onUpdateProgress(callback: (event: UpdateProgressPayload) => void): () => void;
  onUpdateCompleted(callback: (payload: UpdateCompletionPayload) => void): () => void;
  onUpdateError(callback: (payload: UpdateErrorPayload) => void): () => void;
  onLaunchLog(callback: (payload: LaunchLogPayload) => void): () => void;
  onLaunchExit(callback: (payload: LaunchExitPayload) => void): () => void;
  onJreStatus(callback: (payload: JreStatusPayload) => void): () => void;
}

export interface LauncherConfig {
  ramGB: number;
  javaSource: JavaSource;
  javaPath?: string | null;
  javaCustomPath?: string | null;
  javaRuntimeMajor?: JavaMajor;
  jvmArgs: string;
  versionId: string;
  selectedBuild?: number | null;
  showLogsOnLaunch: boolean;
  language: 'en' | 'pt';
}

export interface SystemMemoryInfo {
  totalGB: number;
}

export type UpdateStep = 'launcher-update' | 'jre-setup' | 'client-update';

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
  level: LaunchLogLevel;
  message: string;
  timestamp: number;
}

export interface LaunchExitPayload {
  code: number | null;
}

export type AccountType = 'offline' | 'microsoft';

export interface AccountProfile {
  id: string;
  type: AccountType;
  username: string;
  uuid: string;
  createdAt: number;
  lastUsedAt?: number;
  skinUrl?: string | null;
}

export interface AccountsStatePayload {
  accounts: AccountProfile[];
  activeAccountId: string | null;
  limit: number;
}

export interface OfflineAccountRequestPayload {
  username: string;
}

export interface AccountSelectionPayload {
  accountId: string;
}
