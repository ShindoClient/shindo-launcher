import { ipcRenderer } from 'electron';
import { IpcChannel } from '@shindo/shared';
import type {
  AccountsState,
  AddOfflineAccountPayload,
  AccountSelectionPayload,
  ClientState,
  ClientUpdateResult,
  LauncherConfig,
  JavaChooserOptions,
  JavaValidationResult,
  LaunchOptions,
  LaunchResult,
  LaunchLogEntry,
  LauncherUpdateInfo,
  SystemMemoryInfo,
  VersionCatalog,
} from '@shindo/shared';

export const bridge = {
  // System
  getVersion: (): Promise<string> => ipcRenderer.invoke(IpcChannel.AppVersion),

  getSystemMemory: (): Promise<SystemMemoryInfo> => ipcRenderer.invoke(IpcChannel.SystemMemory),

  // Window
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke(IpcChannel.WindowMinimize),

  closeWindow: (): Promise<void> => ipcRenderer.invoke(IpcChannel.WindowClose),

  openLogWindow: (): Promise<void> => ipcRenderer.invoke(IpcChannel.LogWindowOpen),

  closeLogWindow: (): Promise<void> => ipcRenderer.invoke(IpcChannel.LogWindowClose),

  // Config
  getConfig: (): Promise<LauncherConfig> => ipcRenderer.invoke(IpcChannel.ConfigGet),

  setConfig: (patch: Partial<LauncherConfig>): Promise<LauncherConfig> =>
    ipcRenderer.invoke(IpcChannel.ConfigSet, patch),

  // Accounts
  getAccounts: (): Promise<AccountsState> => ipcRenderer.invoke(IpcChannel.AccountsList),

  addOfflineAccount: (payload: AddOfflineAccountPayload): Promise<AccountsState> =>
    ipcRenderer.invoke(IpcChannel.AccountsAddOffline, payload),

  addMicrosoftAccount: (): Promise<AccountsState> =>
    ipcRenderer.invoke(IpcChannel.AccountsAddMicrosoft),

  removeAccount: (payload: AccountSelectionPayload): Promise<AccountsState> =>
    ipcRenderer.invoke(IpcChannel.AccountsRemove, payload),

  selectAccount: (payload: AccountSelectionPayload): Promise<AccountsState> =>
    ipcRenderer.invoke(IpcChannel.AccountsSelect, payload),

  // Client
  getClientState: (): Promise<ClientState> => ipcRenderer.invoke(IpcChannel.ClientState),

  ensureClientUpToDate: (opts?: {
    force?: boolean;
    versionId?: string;
    build?: number | null;
  }): Promise<ClientUpdateResult> => ipcRenderer.invoke(IpcChannel.EnsureClient, opts),

  getVersionCatalog: (): Promise<VersionCatalog> => ipcRenderer.invoke(IpcChannel.VersionCatalog),

  // Java
  chooseJavaExecutable: (opts?: JavaChooserOptions): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannel.JavaChoosePath, opts),

  validateJavaExecutable: (path: string): Promise<JavaValidationResult> =>
    ipcRenderer.invoke(IpcChannel.JavaValidatePath, path),

  // Launch
  launchClient: (opts?: LaunchOptions): Promise<LaunchResult> =>
    ipcRenderer.invoke(IpcChannel.LaunchStart, opts),

  stopClient: (): Promise<boolean> => ipcRenderer.invoke(IpcChannel.LaunchStop),

  getLaunchLogs: (): Promise<LaunchLogEntry[]> => ipcRenderer.invoke(IpcChannel.LaunchLogHistory),

  clearLaunchLogs: (): Promise<void> => ipcRenderer.invoke(IpcChannel.LaunchLogClear),

  // Update
  runStartupUpdate: (): Promise<void> => ipcRenderer.invoke(IpcChannel.RunStartupUpdate),

  checkLauncherUpdate: (): Promise<LauncherUpdateInfo> =>
    ipcRenderer.invoke(IpcChannel.LauncherCheckUpdate),

  downloadLauncherUpdate: (): Promise<LauncherUpdateInfo> =>
    ipcRenderer.invoke(IpcChannel.LauncherDownloadUpdate),
};
