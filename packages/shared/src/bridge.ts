import type { AccountProfile, AccountsState, AddOfflineAccountPayload, AccountSelectionPayload } from './types/account';
import type { ClientState, ClientUpdateResult, VersionCatalog } from './types/client';
import type { LauncherConfig, SystemMemoryInfo } from './types/config';
import type { JavaChooserOptions, JavaValidationResult, JreStatusPayload } from './types/java';
import type { LaunchOptions, LaunchResult, LaunchLogEntry, LaunchExitPayload } from './types/launch';
import type { UpdateProgressPayload, UpdateCompletionPayload, UpdateErrorPayload, LauncherUpdateInfo } from './types/update';

type Unsubscribe = () => void;

export interface LauncherBridge {
  // System
  getVersion(): Promise<string>;
  getSystemMemory(): Promise<SystemMemoryInfo>;

  // Window
  minimizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  openLogWindow(): Promise<void>;
  closeLogWindow(): Promise<void>;

  // Config
  getConfig(): Promise<LauncherConfig>;
  setConfig(patch: Partial<LauncherConfig>): Promise<LauncherConfig>;

  // Accounts
  getAccounts(): Promise<AccountsState>;
  addOfflineAccount(payload: AddOfflineAccountPayload): Promise<AccountsState>;
  addMicrosoftAccount(): Promise<AccountsState>;
  removeAccount(payload: AccountSelectionPayload): Promise<AccountsState>;
  selectAccount(payload: AccountSelectionPayload): Promise<AccountsState>;

  // Client / versions
  getClientState(): Promise<ClientState>;
  ensureClientUpToDate(opts?: { force?: boolean; versionId?: string; build?: number | null }): Promise<ClientUpdateResult>;
  getVersionCatalog(): Promise<VersionCatalog>;

  // Java
  chooseJavaExecutable(opts?: JavaChooserOptions): Promise<string | null>;
  validateJavaExecutable(path: string): Promise<JavaValidationResult>;

  // Launch
  launchClient(opts?: LaunchOptions): Promise<LaunchResult>;
  stopClient(): Promise<boolean>;
  getLaunchLogs(): Promise<LaunchLogEntry[]>;
  clearLaunchLogs(): Promise<void>;

  // Update
  runStartupUpdate(): Promise<void>;
  checkLauncherUpdate(): Promise<LauncherUpdateInfo>;
  downloadLauncherUpdate(): Promise<LauncherUpdateInfo>;

  // Events — return unsubscribe function
  onUpdateProgress(cb: (payload: UpdateProgressPayload) => void): Unsubscribe;
  onUpdateCompleted(cb: (payload: UpdateCompletionPayload) => void): Unsubscribe;
  onUpdateError(cb: (payload: UpdateErrorPayload) => void): Unsubscribe;
  onLaunchLog(cb: (entry: LaunchLogEntry) => void): Unsubscribe;
  onLaunchExit(cb: (payload: LaunchExitPayload) => void): Unsubscribe;
  onJreStatus(cb: (payload: JreStatusPayload) => void): Unsubscribe;
}

// Extend the global Window interface so renderer TypeScript knows about window.shindo
declare global {
  interface Window {
    shindo: LauncherBridge;
  }
}
