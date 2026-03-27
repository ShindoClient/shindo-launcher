import { writable, get } from 'svelte/store';
import type { Language } from '../i18n';
import { setLanguage, t } from '../i18n';
import { createUpdateHandlers } from './updateHandlers';
import { createAccountHandlers } from './accountHandlers';
import type {
  ClientStatePayload,
  LauncherConfig,
  SystemMemoryInfo,
  UpdateProgressPayload,
  AccountProfile,
  VersionCatalogPayload,
} from '@shindo/shared';

export type Screen = 'update' | 'home' | 'settings';

export type UpdateStatus = 'idle' | 'running' | 'completed' | 'error';

export interface UpdateState {
  status: UpdateStatus;
  step: UpdateProgressPayload['step'] | null;
  message: string;
  percent: number;
  phaseIndex: number;
  phaseTotal: number;
  errorMessage?: string;
}

export interface AppState {
  screen: Screen;
  update: UpdateState;
  config: LauncherConfig | null;
  systemMemory: SystemMemoryInfo | null;
  clientState: ClientStatePayload | null;
  initializing: boolean;
  updateInFlight: boolean;
  listenersRegistered: boolean;
  launching: boolean;
  clientRunning: boolean;
  launcherStatus: string;
  accounts: {
    entries: AccountProfile[];
    activeAccountId: string | null;
    limit: number;
    loading: boolean;
    loginInProgress: boolean;
    error?: string;
  };
  versionCatalog: VersionCatalogPayload | null;
  versionCatalogLoading: boolean;
}

const initialState: AppState = {
  screen: 'update',
  update: {
    status: 'idle',
    step: null,
    message: 'Preparando...',
    percent: 0,
    phaseIndex: 0,
    phaseTotal: 0,
  },
  config: null,
  systemMemory: null,
  clientState: null,
  initializing: false,
  updateInFlight: false,
  listenersRegistered: false,
  launching: false,
  clientRunning: false,
  launcherStatus: get(t)('home.status.preparing'),
  accounts: {
    entries: [],
    activeAccountId: null,
    limit: 6,
    loading: false,
    loginInProgress: false,
  },
  versionCatalog: null,
  versionCatalogLoading: false,
};
const store = writable<AppState>(initialState);

console.log('[renderer] bridge available:', typeof window.shindo !== 'undefined');

function translate(key: string, params?: Record<string, string | number>): string {
  return get(t)(key, params);
}

async function refreshClientState(): Promise<void> {
  try {
    const state = await window.shindo.getClientState();
    store.update((prev) => ({ ...prev, clientState: state }));
  } catch (error) {
    console.error('Failed to refresh client state', error);
  }
}

async function refreshVersionCatalog(): Promise<void> {
  store.update((state) => ({ ...state, versionCatalogLoading: true }));
  try {
    const payload = await window.shindo.getVersionCatalog();
    store.update((state) => ({
      ...state,
      versionCatalog: payload,
      versionCatalogLoading: false,
    }));
  } catch (error) {
    console.error('Failed to load version catalog', error);
    store.update((state) => ({ ...state, versionCatalogLoading: false }));
  }
}

const {
  refreshAccounts,
  addOfflineAccount,
  addMicrosoftAccount,
  removeAccount,
  selectAccount,
} = createAccountHandlers({ store });

const {
  registerListeners,
  handleUpdateProgress,
  handleUpdateCompleted,
  handleUpdateError,
  startUpdate,
} = createUpdateHandlers({ store, translate, refreshClientState });

async function applyConfigPatch(patch: Partial<LauncherConfig>): Promise<void> {
  const currentState = get(store);
  const previousConfig = currentState.config;
  if (previousConfig) {
    const optimistic = { ...previousConfig, ...patch } as LauncherConfig;
    if (optimistic.language) {
      setLanguage(optimistic.language as Language);
    }
    store.update((state) => ({
      ...state,
      config: optimistic,
    }));
  }
  try {
    const updated = await window.shindo.setConfig(patch);
    if (updated.language) {
      setLanguage(updated.language as Language);
    }
    store.update((state) => ({
      ...state,
      config: updated,
    }));
  } catch (error) {
    if (previousConfig) {
      store.update((state) => ({
        ...state,
        config: previousConfig,
      }));
      if (previousConfig.language) {
        setLanguage(previousConfig.language as Language);
      }
    }
    throw error;
  }
}

async function launch(): Promise<void> {
  const current = get(store);
  console.log('[DEBUG] launch() called, current state:', {
    activeAccountId: current.accounts.activeAccountId,
    accounts: current.accounts.entries.length,
    launching: current.launching,
    config: current.config ? 'present' : 'missing',
  });

  if (!current.accounts.activeAccountId) {
    console.log('[DEBUG] No active account selected');
    store.update((state) => ({
      ...state,
      launcherStatus: translate('home.status.accountRequired'),
    }));
    return;
  }
  if (current.launching || current.clientRunning) {
    console.log('[DEBUG] Already launching, skipping');
    return;
  }

  store.update((state) => {
    return {
      ...state,
      launching: true,
      launcherStatus: translate('home.status.launching'),
    };
  });

  try {
    const config = get(store).config;
    console.log('[DEBUG] Config:', config);
    const options = config
      ? {
          memory: { max: `${Math.max(1, config.ramGB)}G` },
          build: config.selectedBuild ?? null,
        }
      : undefined;

    console.log('[DEBUG] Calling window.shindo.launchClient with options:', options);
    const result = await window.shindo.launchClient(options);
    console.log('[DEBUG] launchClient result:', result);

    const summary = result.pid
      ? translate('home.status.startedPid', { pid: result.pid })
      : translate('home.status.started');
    store.update((state) => ({
      ...state,
      launcherStatus: summary,
      clientRunning: Boolean(result.pid),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[DEBUG] Failed to launch client', error);
    store.update((state) => ({
      ...state,
      launcherStatus: translate('home.status.failed', { message }),
    }));
  }

  store.update((state) => ({ ...state, launching: false }));
}

async function stopClient(): Promise<boolean> {
  try {
    const stopped = await window.shindo.stopClient();
    if (stopped) {
      store.update((state) => ({
        ...state,
        launcherStatus:
          state.config?.language === 'pt' ? 'Encerrando cliente...' : 'Stopping client...',
      }));
    }
    return stopped;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    store.update((state) => ({
      ...state,
      launcherStatus: translate('home.status.failed', { message }),
    }));
    return false;
  }
}

export const appStore = {
  subscribe: store.subscribe,
  init: async () => {
    const state = get(store);
    if (state.initializing) return;

    store.update((prev) => ({ ...prev, initializing: true }));
    registerListeners();

    try {
      const [config, systemMemory] = await Promise.all([
        window.shindo.getConfig(),
        window.shindo.getSystemMemory(),
      ]);

      if (config.language) {
        setLanguage(config.language as Language);
      }
      store.update((prev) => ({ ...prev, config, systemMemory }));
    } finally {
      store.update((prev) => ({ ...prev, initializing: false }));
    }

    await refreshClientState();
    await refreshVersionCatalog();
    try {
      await refreshAccounts();
    } catch (error) {
      console.error('Falha ao carregar contas', error);
    }
    await startUpdate();
  },
  setScreen: (screen: Screen) => {
    store.update((state) => ({ ...state, screen }));
  },
  applyConfigPatch,
  startUpdate,
  launch,
  stopClient,
  reloadAccounts: refreshAccounts,
  addOfflineAccount,
  addMicrosoftAccount,
  removeAccount,
  selectAccount,
  get state() {
    return get(store);
  },
};
