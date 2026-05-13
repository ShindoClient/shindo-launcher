import type { AccountsState, AddOfflineAccountPayload, AccountSelectionPayload } from './types/account';
import type { ClientState, ClientUpdateResult, VersionCatalog } from './types/client';
import type { LauncherConfig, SystemMemoryInfo } from './types/config';
import type { JavaChooserOptions, JavaValidationResult, JreStatusPayload } from './types/java';
import type { LaunchOptions, LaunchResult, LaunchLogEntry, LaunchExitPayload } from './types/launch';
import type { UpdateProgressPayload, UpdateCompletionPayload, UpdateErrorPayload, LauncherUpdateInfo } from './types/update';
type Unsubscribe = () => void;
export interface LauncherBridge {
    getVersion(): Promise<string>;
    getSystemMemory(): Promise<SystemMemoryInfo>;
    minimizeWindow(): Promise<void>;
    closeWindow(): Promise<void>;
    openLogWindow(): Promise<void>;
    closeLogWindow(): Promise<void>;
    getConfig(): Promise<LauncherConfig>;
    setConfig(patch: Partial<LauncherConfig>): Promise<LauncherConfig>;
    getAccounts(): Promise<AccountsState>;
    addOfflineAccount(payload: AddOfflineAccountPayload): Promise<AccountsState>;
    addMicrosoftAccount(): Promise<AccountsState>;
    removeAccount(payload: AccountSelectionPayload): Promise<AccountsState>;
    selectAccount(payload: AccountSelectionPayload): Promise<AccountsState>;
    getClientState(): Promise<ClientState>;
    ensureClientUpToDate(opts?: {
        force?: boolean;
        versionId?: string;
        build?: number | null;
    }): Promise<ClientUpdateResult>;
    getVersionCatalog(): Promise<VersionCatalog>;
    chooseJavaExecutable(opts?: JavaChooserOptions): Promise<string | null>;
    validateJavaExecutable(path: string): Promise<JavaValidationResult>;
    launchClient(opts?: LaunchOptions): Promise<LaunchResult>;
    stopClient(): Promise<boolean>;
    getLaunchLogs(): Promise<LaunchLogEntry[]>;
    clearLaunchLogs(): Promise<void>;
    runStartupUpdate(): Promise<void>;
    checkLauncherUpdate(): Promise<LauncherUpdateInfo>;
    downloadLauncherUpdate(): Promise<LauncherUpdateInfo>;
    onUpdateProgress(cb: (payload: UpdateProgressPayload) => void): Unsubscribe;
    onUpdateCompleted(cb: (payload: UpdateCompletionPayload) => void): Unsubscribe;
    onUpdateError(cb: (payload: UpdateErrorPayload) => void): Unsubscribe;
    onLaunchLog(cb: (entry: LaunchLogEntry) => void): Unsubscribe;
    onLaunchExit(cb: (payload: LaunchExitPayload) => void): Unsubscribe;
    onJreStatus(cb: (payload: JreStatusPayload) => void): Unsubscribe;
}
declare global {
    interface Window {
        shindo: LauncherBridge;
    }
}
export {};
