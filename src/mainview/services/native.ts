import type {
  AccountProfile,
  LaunchRequest,
  LogEntry,
  NativeDownloadRequest,
  NativeDownloadResult,
  NativeState,
  ProgressPayload,
  ShindoRPCSchema,
} from "../../shared/types";
import { launcherState, pushLog, updateState } from "../state/app.svelte";

// ─── AccountsStatePayload (mirrors bun-side type) ─────────────────────────────
// Defined locally to avoid a shared-package dependency on the bun-only type.

export type AccountsStatePayload = {
  accounts: AccountProfile[];
  activeAccountId: string | null;
  limit: number;
};

// ─── NativeApi contract ───────────────────────────────────────────────────────

type NativeApi = {
  getState(): Promise<NativeState>;
  saveState(state: NativeState): Promise<{ ok: boolean }>;
  checkLauncherUpdate(): Promise<{ ok: boolean; channel?: string }>;
  downloadClient(request: NativeDownloadRequest): Promise<NativeDownloadResult>;
  ensureJava(params: {
    javaVersion: number;
  }): Promise<{ path?: string; ok: boolean }>;
  selectJavaExecutable(): Promise<{ path?: string }>;
  launchGame(request: LaunchRequest): Promise<{ ok: boolean; pid?: number }>;
  // Account management — all operations are handled natively (bun side).
  getAccounts(): Promise<AccountsStatePayload>;
  addOfflineAccount(payload: {
    username: string;
  }): Promise<AccountsStatePayload>;
  addMicrosoftAccount(): Promise<AccountsStatePayload>;
  removeAccount(payload: { accountId: string }): Promise<AccountsStatePayload>;
  selectAccount(payload: { accountId: string }): Promise<AccountsStatePayload>;
  minimizeWindow(): Promise<{ ok: boolean }>;
  closeWindow(): Promise<{ ok: boolean }>;
};

// ─── Shared ───────────────────────────────────────────────────────────────────

const storageKey = "shindo-launcher-state";
let nativeApi: NativeApi | null = null;
const nativeTimeoutMs = 4000;

function updateProgress(progress: ProgressPayload) {
  updateState.progress = progress;
  launcherState.progress = progress;
}

// ─── Fallback (browser / dev without native) ─────────────────────────────────

function fallbackApi(): NativeApi {
  const fallbackAccounts: AccountProfile[] = [];
  let fallbackActiveId: string | null = null;
  let fallbackLimit = 6;

  function makeState(): AccountsStatePayload {
    return {
      accounts: fallbackAccounts,
      activeAccountId: fallbackActiveId,
      limit: fallbackLimit,
    };
  }

  return {
    async getState() {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as NativeState) : {};
    },
    async saveState(state) {
      localStorage.setItem(storageKey, JSON.stringify(state));
      return { ok: true };
    },
    async checkLauncherUpdate() {
      return { ok: true, channel: "web-fallback" };
    },
    async downloadClient(request) {
      for (let current = 0; current <= 100; current += 10) {
        updateProgress({ current, total: 100, label: request.release.id });
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      return {
        installPath: `local-fallback/${request.release.id}`,
        versionId: request.release.id,
        versionJsonPath: `local-fallback/${request.release.id}/${request.release.id}.json`,
      };
    },
    async ensureJava() {
      return { ok: true };
    },
    async selectJavaExecutable() {
      return {};
    },
    async launchGame() {
      launcherState.status = "running";
      setTimeout(() => {
        launcherState.status = "idle";
      }, 5000);
      return { ok: true };
    },
    async getAccounts() {
      return makeState();
    },
    async addOfflineAccount({ username }) {
      const account: AccountProfile = {
        id: `offline-${username.toLowerCase()}-${Date.now()}`,
        type: "offline",
        username,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };
      fallbackAccounts.unshift(account);
      if (fallbackAccounts.length > fallbackLimit) fallbackAccounts.pop();
      fallbackActiveId = account.id;
      return makeState();
    },
    async addMicrosoftAccount() {
      // No-op in fallback — Microsoft login requires a real native window.
      console.warn(
        "[fallback] Microsoft login is not available outside the native app.",
      );
      return makeState();
    },
    async removeAccount({ accountId }) {
      const idx = fallbackAccounts.findIndex((a) => a.id === accountId);
      if (idx >= 0) fallbackAccounts.splice(idx, 1);
      if (fallbackActiveId === accountId) {
        fallbackActiveId = fallbackAccounts[0]?.id ?? null;
      }
      return makeState();
    },
    async selectAccount({ accountId }) {
      const target = fallbackAccounts.find((a) => a.id === accountId);
      if (target) {
        fallbackActiveId = accountId;
        target.lastUsedAt = Date.now();
      }
      return makeState();
    },
    async minimizeWindow() {
      return { ok: true };
    },
    async closeWindow() {
      window.close();
      return { ok: true };
    },
  };
}

// ─── Bootstrap state wrapper ──────────────────────────────────────────────────

function withTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, nativeTimeoutMs);
    operation.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function apiWithBootstrapState(
  primary: NativeApi,
  bootstrapState: NativeState,
): NativeApi {
  let cachedState: NativeState | null = bootstrapState;
  return {
    async getState() {
      if (cachedState) {
        const state = cachedState;
        cachedState = null;
        return state;
      }
      return primary.getState();
    },
    async saveState(state) {
      return primary.saveState(state);
    },
    async checkLauncherUpdate() {
      return primary.checkLauncherUpdate();
    },
    async downloadClient(request) {
      return primary.downloadClient(request);
    },
    async ensureJava(params) {
      return primary.ensureJava(params);
    },
    async selectJavaExecutable() {
      return primary.selectJavaExecutable();
    },
    async launchGame(request) {
      return primary.launchGame(request);
    },
    async getAccounts() {
      return primary.getAccounts();
    },
    async addOfflineAccount(payload) {
      return primary.addOfflineAccount(payload);
    },
    async addMicrosoftAccount() {
      return primary.addMicrosoftAccount();
    },
    async removeAccount(payload) {
      return primary.removeAccount(payload);
    },
    async selectAccount(payload) {
      return primary.selectAccount(payload);
    },
    async minimizeWindow() {
      return primary.minimizeWindow();
    },
    async closeWindow() {
      return primary.closeWindow();
    },
  };
}

// ─── Initializer ─────────────────────────────────────────────────────────────

export async function getNativeApi(): Promise<NativeApi> {
  if (nativeApi) return nativeApi;
  try {
    const Electrobun = await import("electrobun/view");
    const rpc = Electrobun.default.Electroview.defineRPC<ShindoRPCSchema>({
      maxRequestTime: Infinity,
      handlers: {
        messages: {
          downloadProgress: updateProgress,
          gameStarted: () => {
            launcherState.status = "running";
          },
          gameClosed: () => {
            launcherState.status = "idle";
          },
          nativeError: ({ message }) => {
            console.error(message);
          },
          launcherLog: (entry: LogEntry) => {
            pushLog(entry);
          },
        },
      },
    });
    new Electrobun.default.Electroview({ rpc });
    const primary = rpc.request;
    const bootstrapState = await withTimeout(
      primary.getState(),
      "Native bootstrap",
    );
    nativeApi = apiWithBootstrapState(primary, bootstrapState);
    return nativeApi;
  } catch (error) {
    console.warn(error);
    nativeApi = fallbackApi();
    return nativeApi;
  }
}
