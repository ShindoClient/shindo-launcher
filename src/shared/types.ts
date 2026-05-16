export type ReleaseChannel = "stable" | "dev" | "snapshot";
export type AppPage = "update" | "home" | "settings" | "logs";
export type LauncherStatus = "idle" | "downloading" | "launching" | "running";
export type AccountType = "microsoft" | "offline";
export type Locale = "en" | "pt" | "de";

export type ProgressPayload = {
  current: number;
  total: number;
  label: string;
};

export type LogEntry = {
  id: string;
  level: "info" | "debug" | "warn" | "error";
  message: string;
  timestamp: number;
};

export type AccountProfile = {
  id: string;
  type: AccountType;
  username: string;
  uuid?: string;
  createdAt: number;
  lastUsedAt: number;
  skinUrl?: string | null;
};

export type AccountsStatePayload = {
  accounts: AccountProfile[];
  activeAccountId: string | null;
  limit: number;
};

export type LauncherSettings = {
  channel: ReleaseChannel;
  selectedVersionId?: string;
  activeAccountId?: string;
  ramMinMb: number;
  ramMaxMb: number;
  javaMode: "auto" | "manual";
  javaPath?: string;
  locale: Locale;
};

export type ClientRelease = {
  id: string;
  channel: ReleaseChannel;
  minecraftVersion: string;
  assetsIndex: string;
  clientVersion: string;
  versionJsonUrl?: string;
  clientUrl?: string;
  checksum?: string;
  javaVersion: number;
  bannerUrl?: string;
  notes?: string;
  createdAt?: string;
};

export type VersioningDocument = {
  releases: ClientRelease[];
  assets?: {
    banners?: Record<string, string>;
  };
};

export type PersistedState = {
  settings: LauncherSettings;
  accounts: AccountProfile[];
  installedVersions: Record<string, string>;
};

export type NativeState = {
  settings?: Partial<LauncherSettings>;
  accounts?: AccountProfile[];
  installedVersions?: Record<string, string>;
};

export type LaunchRequest = {
  version: ClientRelease;
  account: AccountProfile;
  settings: LauncherSettings;
};

export type NativeDownloadRequest = {
  release: ClientRelease;
  versionJsonUrl?: string;
};

export type NativeDownloadResult = {
  installPath: string;
  versionId: string;
  versionJsonPath?: string;
};

export type ShindoRPCSchema = {
  bun: {
    requests: {
      getState: { params: undefined; response: NativeState };
      saveState: { params: NativeState; response: { ok: boolean } };
      checkLauncherUpdate: {
        params: undefined;
        response: { ok: boolean; channel?: string };
      };
      downloadClient: {
        params: NativeDownloadRequest;
        response: NativeDownloadResult;
      };
      ensureJava: {
        params: { javaVersion: number };
        response: { path?: string; ok: boolean };
      };
      selectJavaExecutable: { params: undefined; response: { path?: string } };
      launchGame: {
        params: LaunchRequest;
        response: { ok: boolean; pid?: number };
      };
      // Account management — replaces the old openMicrosoftLogin single-shot call.
      // All operations return the full updated AccountsStatePayload so the
      // webview never needs to manage account state independently.
      getAccounts: {
        params: undefined;
        response: AccountsStatePayload;
      };
      addOfflineAccount: {
        params: { username: string };
        response: AccountsStatePayload;
      };
      addMicrosoftAccount: {
        params: undefined;
        response: AccountsStatePayload;
      };
      removeAccount: {
        params: { accountId: string };
        response: AccountsStatePayload;
      };
      selectAccount: {
        params: { accountId: string };
        response: AccountsStatePayload;
      };
      minimizeWindow: { params: undefined; response: { ok: boolean } };
      closeWindow: { params: undefined; response: { ok: boolean } };
    };
    messages: {};
  };
  webview: {
    requests: {};
    messages: {
      downloadProgress: ProgressPayload;
      gameStarted: { pid?: number };
      gameClosed: { code?: number | null };
      nativeError: { message: string };
      launcherLog: LogEntry;
    };
  };
};
