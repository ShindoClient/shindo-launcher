import { writable, get } from 'svelte/store'
import type {
  ClientStatePayload,
  LauncherConfig,
  SystemMemoryInfo,
  UpdateCompletionPayload,
  UpdateErrorPayload,
  UpdateProgressPayload,
  LaunchLogPayload,
  LaunchExitPayload,
} from '@shindo/shared'

type Screen = 'update' | 'home' | 'settings'

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
  clientLogs: string[]
  initializing: boolean
  updateInFlight: boolean
  listenersRegistered: boolean
  launching: boolean
  logWindowVisible: boolean
  launcherStatus: string
}

const LOG_LIMIT = 200

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
  clientLogs: [],
  initializing: false,
  updateInFlight: false,
  listenersRegistered: false,
  launching: false,
  logWindowVisible: false,
  launcherStatus: 'Preparando...',
}

const store = writable<AppState>(initialState)

let listenersRegistered = false
const unsubscribers: Array<() => void> = []

function pushClientLog(
  logs: string[],
  level: 'INFO' | 'WARN' | 'ERROR',
  message: string,
): string[] {
  const timestamp = new Date().toLocaleTimeString()
  const line = `[${timestamp}] [${level}] ${message}`
  return [...logs.slice(-LOG_LIMIT + 1), line]
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
  unsubscribers.push(window.shindo.onLaunchLog((payload) => appendLog(payload)))
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
  store.update((state) => ({
    ...state,
    update: {
      status: 'running',
      step: payload.step,
      message: payload.message,
      percent: Math.min(100, Math.max(0, payload.percent)),
      phaseIndex: Math.max(0, payload.phaseIndex),
      phaseTotal: Math.max(0, payload.phaseTotal),
      errorMessage: undefined,
    },
    launcherStatus: payload.message,
  }))
}

function handleUpdateCompleted(_payload: UpdateCompletionPayload): void {
  store.update((state) => ({
    ...state,
    update: {
      ...state.update,
      status: 'completed',
      percent: 100,
      message: state.update.message || 'Atualizacao concluida.',
      phaseIndex: state.update.phaseTotal || state.update.phaseIndex || 0,
      errorMessage: undefined,
    },
    launcherStatus: 'Atualizacao concluida. Pronto para jogar.',
    screen: 'home',
  }))
  void refreshClientState()
}

function handleUpdateError(payload: UpdateErrorPayload): void {
  store.update((state) => ({
    ...state,
    update: {
      status: 'error',
      step: null,
      message: 'Falha durante a atualizacao.',
      percent: 0,
      phaseIndex: 0,
      phaseTotal: 0,
      errorMessage: payload.message,
    },
    launcherStatus: `Erro durante a atualizacao: ${payload.message}`,
  }))
}

function appendLog(payload: LaunchLogPayload): void {
  store.update((state) => ({
    ...state,
    clientLogs: pushClientLog(
      state.clientLogs,
      payload.level.toUpperCase() as 'INFO' | 'WARN' | 'ERROR',
      payload.message,
    ),
  }))
}

function appendExitLog(payload: LaunchExitPayload): void {
  const exitMessage = `Processo finalizado com codigo ${payload.code ?? 'desconhecido'}`
  store.update((state) => ({
    ...state,
    clientLogs: pushClientLog(state.clientLogs, 'INFO', exitMessage),
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
      message: 'Iniciando verificacoes...',
      percent: 0,
      phaseIndex: 0,
      phaseTotal: 0,
      errorMessage: undefined,
    },
    launcherStatus: 'Iniciando verificacoes...',
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
  const previousLogWindowVisible = currentState.logWindowVisible
  if (previousConfig) {
    const optimistic = { ...previousConfig, ...patch } as LauncherConfig
    store.update((state) => ({
      ...state,
      config: optimistic,
      logWindowVisible: patch.showLogsOnLaunch === false ? false : state.logWindowVisible,
    }))
  }
  try {
    const updated = await window.shindo.setConfig(patch)
    store.update((state) => ({
      ...state,
      config: updated,
      logWindowVisible: updated.showLogsOnLaunch ? state.logWindowVisible : false,
    }))
  } catch (error) {
    if (previousConfig) {
      store.update((state) => ({
        ...state,
        config: previousConfig,
        logWindowVisible: previousLogWindowVisible,
      }))
    }
    throw error
  }
}

async function launch(): Promise<void> {
  const current = get(store)
  if (current.launching) return

  store.update((state) => {
    const showLogs = state.config?.showLogsOnLaunch ?? true
    return {
      ...state,
      launching: true,
      clientLogs: pushClientLog(state.clientLogs, 'INFO', 'Iniciando ShindoClient...'),
      launcherStatus: 'Iniciando ShindoClient...',
      logWindowVisible: showLogs ? true : state.logWindowVisible,
    }
  })

  try {
    const config = get(store).config
    const options = config
      ? {
          memory: { max: `${Math.max(1, config.ramGB)}G` },
        }
      : undefined

    const result = await window.shindo.launchClient(options)
    const summary = result.pid
      ? `ShindoClient iniciado (pid ${result.pid}).`
      : 'ShindoClient iniciado.'
    store.update((state) => ({ ...state, launcherStatus: summary }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to launch client', message)
    store.update((state) => ({
      ...state,
      clientLogs: pushClientLog(state.clientLogs, 'ERROR', `Falha ao iniciar cliente: ${message}`),
      launcherStatus: `Falha ao iniciar cliente: ${message}`,
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

      store.update((prev) => ({ ...prev, config, systemMemory }))
    } finally {
      store.update((prev) => ({ ...prev, initializing: false }))
    }

    await refreshClientState()
    await startUpdate()
  },
  setScreen: (screen: Screen) => {
    store.update((state) => ({ ...state, screen }))
  },
  setLogWindowVisible: (visible: boolean) => {
    store.update((state) => ({ ...state, logWindowVisible: visible }))
  },
  clearClientLogs: () => {
    store.update((state) => ({ ...state, clientLogs: [] }))
  },
  applyConfigPatch,
  startUpdate,
  launch,
  get state() {
    return get(store)
  },
}
