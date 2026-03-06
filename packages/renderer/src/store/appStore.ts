import { writable, get } from 'svelte/store'
import type { Language } from '../i18n'
import { setLanguage, t } from '../i18n'
import type {
  ClientStatePayload,
  LauncherConfig,
  SystemMemoryInfo,
  UpdateCompletionPayload,
  UpdateErrorPayload,
  UpdateProgressPayload,
  LaunchExitPayload,
  AccountsStatePayload,
  AccountProfile,
} from '@shindo/shared'

type Screen = 'update' | 'home' | 'settings' | 'accounts'

type UpdateStatus = 'idle' | 'running' | 'completed' | 'error'

interface UpdateState {
  status: UpdateStatus
  step: UpdateProgressPayload['step'] | null
  message: string
  percent: number
  phaseIndex: number
  phaseTotal: number
  errorMessage?: string
}

interface AppState {
  screen: Screen
  update: UpdateState
  config: LauncherConfig | null
  systemMemory: SystemMemoryInfo | null
  clientState: ClientStatePayload | null
  initializing: boolean
  updateInFlight: boolean
  listenersRegistered: boolean
  launching: boolean
  launcherStatus: string
  accounts: {
    entries: AccountProfile[]
    activeAccountId: string | null
    limit: number
    loading: boolean
    loginInProgress: boolean
    error?: string
  }
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
  launcherStatus: get(t)('home.status.preparing'),
  accounts: {
    entries: [],
    activeAccountId: null,
    limit: 6,
    loading: false,
    loginInProgress: false,
  },
}
function applyAccountsPayload(state: AppState, payload: AccountsStatePayload): AppState {
  return {
    ...state,
    accounts: {
      ...state.accounts,
      entries: payload.accounts,
      activeAccountId: payload.activeAccountId,
      limit: payload.limit,
      loading: false,
      loginInProgress: false,
      error: undefined,
    },
  }
}

async function refreshAccounts(): Promise<void> {
  store.update((state) => ({
    ...state,
    accounts: {
      ...state.accounts,
      loading: true,
      error: undefined,
    },
  }))

  try {
    const payload = await window.shindo.getAccounts()
    store.update((state) => applyAccountsPayload(state, payload))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.update((state) => ({
      ...state,
      accounts: {
        ...state.accounts,
        loading: false,
        error: message,
      },
    }))
    throw error
  }
}

async function addOfflineAccount(username: string): Promise<void> {
  store.update((state) => ({
    ...state,
    accounts: {
      ...state.accounts,
      loading: true,
      error: undefined,
    },
  }))

  try {
    const payload = await window.shindo.addOfflineAccount({ username })
    store.update((state) => applyAccountsPayload(state, payload))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.update((state) => ({
      ...state,
      accounts: {
        ...state.accounts,
        loading: false,
        error: message,
      },
    }))
    throw error
  }
}

async function addMicrosoftAccount(): Promise<void> {
  store.update((state) => ({
    ...state,
    accounts: {
      ...state.accounts,
      loginInProgress: true,
      error: undefined,
    },
  }))

  try {
    const payload = await window.shindo.addMicrosoftAccount()
    store.update((state) => applyAccountsPayload(state, payload))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.update((state) => ({
      ...state,
      accounts: {
        ...state.accounts,
        loginInProgress: false,
        error: message,
      },
    }))
    throw error
  }
}

async function removeAccount(accountId: string): Promise<void> {
  store.update((state) => ({
    ...state,
    accounts: {
      ...state.accounts,
      loading: true,
      error: undefined,
    },
  }))

  try {
    const payload = await window.shindo.removeAccount({ accountId })
    store.update((state) => applyAccountsPayload(state, payload))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.update((state) => ({
      ...state,
      accounts: {
        ...state.accounts,
        loading: false,
        error: message,
      },
    }))
    throw error
  }
}

async function selectAccount(accountId: string): Promise<void> {
  store.update((state) => ({
    ...state,
    accounts: {
      ...state.accounts,
      loading: true,
      error: undefined,
    },
  }))

  try {
    const payload = await window.shindo.selectAccount({ accountId })
    store.update((state) => applyAccountsPayload(state, payload))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.update((state) => ({
      ...state,
      accounts: {
        ...state.accounts,
        loading: false,
        error: message,
      },
    }))
    throw error
  }
}


const store = writable<AppState>(initialState)

let listenersRegistered = false
const unsubscribers: Array<() => void> = []

console.log('[renderer] bridge available:', typeof window.shindo !== 'undefined')

function translate(key: string, params?: Record<string, string | number>): string {
  return get(t)(key, params)
}

function localizeUpdateMessage(message: string, step: UpdateProgressPayload['step'] | null): string {
  const lower = (message || '').toLowerCase()
  if (step === 'launcher-update') {
    if (lower.includes('baixando') || lower.includes('download')) return translate('home.progress.launcherDownloading')
    if (lower.includes('aplicando') || lower.includes('apply')) return translate('home.progress.launcherApplying')
    if (lower.includes('preparada') || lower.includes('ready')) return translate('home.progress.launcherReady')
    if (lower.includes('atualizado') || lower.includes('up to date')) return translate('home.progress.launcherUpToDate')
    return translate('home.progress.launcher')
  }
  if (step === 'jre-setup') {
    if (lower.includes('verificado') || lower.includes('ready')) return translate('home.progress.jreReady')
    return translate('home.progress.jreChecking')
  }
  if (step === 'client-update') {
    if (lower.includes('pronto') || lower.includes('ready') || lower.includes('sincronizado')) {
      return translate('home.progress.clientReady')
    }
    return translate('home.progress.clientSync')
  }
  return message
}

function registerListeners(): void {
  if (listenersRegistered) return
  listenersRegistered = true

  unsubscribers.push(
    window.shindo.onUpdateProgress((payload) => handleUpdateProgress(payload)),
  )
  unsubscribers.push(
    window.shindo.onUpdateCompleted((payload) => handleUpdateCompleted(payload)),
  )
  unsubscribers.push(
    window.shindo.onUpdateError((payload) => handleUpdateError(payload)),
  )
  unsubscribers.push(window.shindo.onLaunchExit((payload) => appendExitLog(payload)))

  store.update((state) => ({ ...state, listenersRegistered: true }))
}

async function refreshClientState(): Promise<void> {
  try {
    const state = await window.shindo.getClientState()
    store.update((prev) => ({ ...prev, clientState: state }))
  } catch (error) {
    console.error('Failed to refresh client state', error)
  }
}

function handleUpdateProgress(payload: UpdateProgressPayload): void {
  const localizedMessage = localizeUpdateMessage(payload.message, payload.step)
  store.update((state) => ({
    ...state,
    update: {
      status: 'running',
      step: payload.step,
      message: localizedMessage,
      percent: Math.min(100, Math.max(0, payload.percent)),
      phaseIndex: Math.max(0, payload.phaseIndex),
      phaseTotal: Math.max(0, payload.phaseTotal),
      errorMessage: undefined,
    },
    launcherStatus: localizedMessage,
  }))
}

function handleUpdateCompleted(_payload: UpdateCompletionPayload): void {
  store.update((state) => ({
    ...state,
    update: {
      ...state.update,
      status: 'completed',
      percent: 100,
      message: state.update.message || translate('home.status.updateComplete'),
      phaseIndex: state.update.phaseTotal || state.update.phaseIndex || 0,
      errorMessage: undefined,
    },
    launcherStatus: translate('home.status.updateComplete'),
    screen: 'home',
  }))
  void refreshClientState()
}

function handleUpdateError(payload: UpdateErrorPayload): void {
  const message = translate('home.status.updateError', { message: payload.message })
  store.update((state) => ({
    ...state,
    update: {
      status: 'error',
      step: null,
      message,
      percent: 0,
      phaseIndex: 0,
      phaseTotal: 0,
      errorMessage: payload.message,
    },
    launcherStatus: message,
  }))
}

function appendExitLog(payload: LaunchExitPayload): void {
  const exitMessage = payload.code === null || payload.code === undefined
    ? translate('home.status.exitUnknown')
    : translate('home.status.exit', { code: payload.code })
  store.update((state) => ({
    ...state,
    launcherStatus: exitMessage,
  }))
}

async function startUpdate(): Promise<void> {
  if (get(store).updateInFlight) return

  store.update((state) => ({
    ...state,
    updateInFlight: true,
    update: {
      status: 'running',
      step: null,
      message: translate('home.status.checking'),
      percent: 0,
      phaseIndex: 0,
      phaseTotal: 0,
      errorMessage: undefined,
    },
    launcherStatus: translate('home.status.checking'),
  }))

  try {
    await window.shindo.runStartupUpdate()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    handleUpdateError({ success: false, message })
  } finally {
    store.update((state) => ({ ...state, updateInFlight: false }))
  }
}

async function applyConfigPatch(patch: Partial<LauncherConfig>): Promise<void> {
  const currentState = get(store)
  const previousConfig = currentState.config
  if (previousConfig) {
    const optimistic = { ...previousConfig, ...patch } as LauncherConfig
    if (optimistic.language) {
      setLanguage(optimistic.language as Language)
    }
    store.update((state) => ({
      ...state,
      config: optimistic,
    }))
  }
  try {
    const updated = await window.shindo.setConfig(patch)
    if (updated.language) {
      setLanguage(updated.language as Language)
    }
    store.update((state) => ({
      ...state,
      config: updated,
    }))
  } catch (error) {
    if (previousConfig) {
      store.update((state) => ({
        ...state,
        config: previousConfig,
      }))
      if (previousConfig.language) {
        setLanguage(previousConfig.language as Language)
      }
    }
    throw error
  }
}

async function launch(): Promise<void> {
  const current = get(store)
  console.log('[DEBUG] launch() called, current state:', {
    activeAccountId: current.accounts.activeAccountId,
    accounts: current.accounts.entries.length,
    launching: current.launching,
    config: current.config ? 'present' : 'missing'
  })
  
  if (!current.accounts.activeAccountId) {
    console.log('[DEBUG] No active account selected')
    store.update((state) => ({
      ...state,
      launcherStatus: translate('home.status.accountRequired'),
    }))
    return
  }
  if (current.launching) {
    console.log('[DEBUG] Already launching, skipping')
    return
  }

  store.update((state) => {
    return {
      ...state,
      launching: true,
      launcherStatus: translate('home.status.launching'),
    }
  })

  const showLogs = current.config?.showLogsOnLaunch ?? true
  if (showLogs) {
    console.log('[DEBUG] Opening log window')
    window.shindo.openLogWindow().catch((error) => console.error('Failed to open log window', error))
  }

  try {
    const config = get(store).config
    console.log('[DEBUG] Config:', config)
    const options = config
      ? {
          memory: { max: `${Math.max(1, config.ramGB)}G` },
        }
      : undefined

    console.log('[DEBUG] Calling window.shindo.launchClient with options:', options)
    const result = await window.shindo.launchClient(options)
    console.log('[DEBUG] launchClient result:', result)
    
    const summary = result.pid
      ? translate('home.status.startedPid', { pid: result.pid })
      : translate('home.status.started')
    store.update((state) => ({ ...state, launcherStatus: summary }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[DEBUG] Failed to launch client', error)
    store.update((state) => ({
      ...state,
      launcherStatus: translate('home.status.failed', { message }),
    }))
  }

  store.update((state) => ({ ...state, launching: false }))
}

export const appStore = {
  subscribe: store.subscribe,
  init: async () => {
    const state = get(store)
    if (state.initializing) return

    store.update((prev) => ({ ...prev, initializing: true }))
    registerListeners()

    try {
      const [config, systemMemory] = await Promise.all([
        window.shindo.getConfig(),
        window.shindo.getSystemMemory(),
      ])

      if (config.language) {
        setLanguage(config.language as Language)
      }
      store.update((prev) => ({ ...prev, config, systemMemory }))
    } finally {
      store.update((prev) => ({ ...prev, initializing: false }))
    }

    await refreshClientState()
    try {
      await refreshAccounts()
    } catch (error) {
      console.error('Falha ao carregar contas', error)
    }
    await startUpdate()
  },
  setScreen: (screen: Screen) => {
    store.update((state) => ({ ...state, screen }))
  },
  applyConfigPatch,
  startUpdate,
  launch,
  reloadAccounts: refreshAccounts,
  addOfflineAccount,
  addMicrosoftAccount,
  removeAccount,
  selectAccount,
  get state() {
    return get(store)
  },
}
