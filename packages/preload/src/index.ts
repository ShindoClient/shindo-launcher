import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel, IpcEvent } from '@shindo/shared';
import type {
  ClientUpdatePayload,
  ClientStatePayload,
  LaunchClientOptionsPayload,
  LaunchClientResultPayload,
  LauncherBridge,
  LauncherConfig,
  LauncherUpdateInfoPayload,
  LauncherUpdateResultPayload,
  SystemMemoryInfo,
  UpdateCompletionPayload,
  UpdateErrorPayload,
  UpdateProgressPayload,
  LaunchLogPayload,
  LaunchExitPayload,
  AccountsStatePayload,
  VersionCatalogPayload,
  OfflineAccountRequestPayload,
  AccountSelectionPayload,
  LaunchLogEntry,
  JreStatusPayload,
  JavaChooserOptions,
  JavaValidationResult,
} from '@shindo/shared';

type EventPayload<T extends IpcEvent> = T extends IpcEvent.UpdateProgress
  ? UpdateProgressPayload
  : T extends IpcEvent.UpdateCompleted
    ? UpdateCompletionPayload
    : T extends IpcEvent.UpdateError
      ? UpdateErrorPayload
      : T extends IpcEvent.LaunchLog
        ? LaunchLogPayload
        : T extends IpcEvent.LaunchExit
          ? LaunchExitPayload
          : never;

function registerEvent<T extends IpcEvent>(
  channel: T,
  callback: (payload: EventPayload<T>) => void,
): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: EventPayload<T>) => {
    callback(payload);
  };
  ipcRenderer.on(channel, handler as unknown as () => void);
  return () => ipcRenderer.removeListener(channel, handler as unknown as () => void);
}

const bridge: LauncherBridge = {
  ensureClientUpToDate: (options) =>
    ipcRenderer.invoke(IpcChannel.EnsureClient, options) as Promise<ClientUpdatePayload>,
  getClientState: () => ipcRenderer.invoke(IpcChannel.ClientState) as Promise<ClientStatePayload>,
  checkLauncherUpdate: () =>
    ipcRenderer.invoke(IpcChannel.LauncherCheckUpdate) as Promise<LauncherUpdateInfoPayload>,
  downloadLauncherUpdate: () =>
    ipcRenderer.invoke(IpcChannel.LauncherDownloadUpdate) as Promise<LauncherUpdateResultPayload>,
  launchClient: (options?: LaunchClientOptionsPayload) =>
    ipcRenderer.invoke(IpcChannel.LaunchStart, options) as Promise<LaunchClientResultPayload>,
  stopClient: () => ipcRenderer.invoke(IpcChannel.LaunchStop) as Promise<boolean>,
  getConfig: () => ipcRenderer.invoke(IpcChannel.ConfigGet) as Promise<LauncherConfig>,
  setConfig: (patch) => ipcRenderer.invoke(IpcChannel.ConfigSet, patch) as Promise<LauncherConfig>,
  getSystemMemory: () => ipcRenderer.invoke(IpcChannel.SystemMemory) as Promise<SystemMemoryInfo>,
  runStartupUpdate: () => ipcRenderer.invoke(IpcChannel.RunStartupUpdate) as Promise<void>,
  getVersion: () => ipcRenderer.invoke(IpcChannel.AppVersion) as Promise<string>,
  chooseJavaExecutable: (options?: JavaChooserOptions) =>
    ipcRenderer.invoke(IpcChannel.JavaChoosePath, options) as Promise<string | null>,
  validateJavaExecutable: (filePath: string) =>
    ipcRenderer.invoke(IpcChannel.JavaValidatePath, filePath) as Promise<JavaValidationResult>,
  getLaunchLogs: () => ipcRenderer.invoke(IpcChannel.LaunchLogHistory) as Promise<LaunchLogEntry[]>,
  clearLaunchLogs: () => ipcRenderer.invoke(IpcChannel.LaunchLogClear) as Promise<void>,
  getVersionCatalog: () =>
    ipcRenderer.invoke(IpcChannel.VersionCatalog) as Promise<VersionCatalogPayload>,
  openLogWindow: () => ipcRenderer.invoke(IpcChannel.LogWindowOpen) as Promise<void>,
  closeLogWindow: () => ipcRenderer.invoke(IpcChannel.LogWindowClose) as Promise<void>,
  getAccounts: () => ipcRenderer.invoke(IpcChannel.AccountsList) as Promise<AccountsStatePayload>,
  addOfflineAccount: (payload: OfflineAccountRequestPayload) =>
    ipcRenderer.invoke(IpcChannel.AccountsAddOffline, payload) as Promise<AccountsStatePayload>,
  addMicrosoftAccount: () =>
    ipcRenderer.invoke(IpcChannel.AccountsAddMicrosoft) as Promise<AccountsStatePayload>,
  removeAccount: (payload: AccountSelectionPayload) =>
    ipcRenderer.invoke(IpcChannel.AccountsRemove, payload) as Promise<AccountsStatePayload>,
  selectAccount: (payload: AccountSelectionPayload) =>
    ipcRenderer.invoke(IpcChannel.AccountsSelect, payload) as Promise<AccountsStatePayload>,
  minimizeWindow: () => ipcRenderer.invoke(IpcChannel.WindowMinimize) as Promise<void>,
  closeWindow: () => ipcRenderer.invoke(IpcChannel.WindowClose) as Promise<void>,
  onUpdateProgress: (callback) => registerEvent(IpcEvent.UpdateProgress, callback),
  onUpdateCompleted: (callback) => registerEvent(IpcEvent.UpdateCompleted, callback),
  onUpdateError: (callback) => registerEvent(IpcEvent.UpdateError, callback),
  onLaunchLog: (callback) => registerEvent(IpcEvent.LaunchLog, callback),
  onLaunchExit: (callback) => registerEvent(IpcEvent.LaunchExit, callback),
  onJreStatus: (callback) => registerEvent(IpcEvent.JreStatus, callback),
};

contextBridge.exposeInMainWorld('shindo', bridge);
