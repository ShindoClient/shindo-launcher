import { get, type Writable } from 'svelte/store';
import type {
  UpdateCompletionPayload,
  UpdateErrorPayload,
  UpdateProgressPayload,
} from '@shindo/shared';
import { enqueueNotification } from './notificationStore';
import type { AppState } from './appStore';

interface UpdateDeps {
  store: Writable<AppState>;
  translate: (key: string, params?: Record<string, string | number>) => string;
  refreshClientState: () => Promise<void>;
}

export function createUpdateHandlers({ store, translate, refreshClientState }: UpdateDeps) {
  const unsubscribers: Array<() => void> = [];
  let listenersRegistered = false;

  function localizeUpdateMessage(
    message: string,
    step: UpdateProgressPayload['step'] | null,
  ): string {
    const lower = (message || '').toLowerCase();
    if (step === 'launcher-update') {
      if (lower.includes('baixando') || lower.includes('download'))
        return translate('home.progress.launcherDownloading');
      if (lower.includes('aplicando') || lower.includes('apply'))
        return translate('home.progress.launcherApplying');
      if (lower.includes('preparada') || lower.includes('ready'))
        return translate('home.progress.launcherReady');
      if (lower.includes('atualizado') || lower.includes('up to date'))
        return translate('home.progress.launcherUpToDate');
      return translate('home.progress.launcher');
    }
    if (step === 'jre-setup') {
      if (lower.includes('verificado') || lower.includes('ready') || lower.includes('pronto'))
        return translate('home.progress.jreReady');
      return translate('home.progress.jreChecking');
    }
    if (step === 'client-update') {
      if (lower.includes('pronto') || lower.includes('ready') || lower.includes('sincronizado')) {
        return translate('home.progress.clientReady');
      }
      return translate('home.progress.clientSync');
    }
    return message;
  }

  function handleUpdateProgress(payload: UpdateProgressPayload): void {
    const localizedMessage = localizeUpdateMessage(payload.message, payload.step);
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
    }));
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
    }));
    void refreshClientState();
  }

  function handleUpdateError(payload: UpdateErrorPayload): void {
    const message = translate('home.status.updateError', { message: payload.message });
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
    }));
  }

  async function startUpdate(): Promise<void> {
    if (get(store).updateInFlight) return;

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
    }));

    try {
      await window.shindo.runStartupUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      handleUpdateError({ success: false, message });
    } finally {
      store.update((state) => ({ ...state, updateInFlight: false }));
    }
  }

  function registerListeners(): void {
    if (listenersRegistered) return;
    listenersRegistered = true;

    unsubscribers.push(window.shindo.onUpdateProgress((payload) => handleUpdateProgress(payload)));
    unsubscribers.push(window.shindo.onUpdateCompleted((payload) => handleUpdateCompleted(payload)));
    unsubscribers.push(window.shindo.onUpdateError((payload) => handleUpdateError(payload)));
    unsubscribers.push(window.shindo.onLaunchExit((payload) => appendExitLog(payload)));
    unsubscribers.push(
      window.shindo.onJreStatus((payload) => {
        enqueueNotification({ message: payload.message, severity: payload.severity });
      }),
    );

    store.update((state) => ({ ...state, listenersRegistered: true }));
  }

  function appendExitLog(payload: { code: number | null }): void {
    const exitMessage =
      payload.code === null || payload.code === undefined
        ? translate('home.status.exitUnknown')
        : translate('home.status.exit', { code: payload.code });
    store.update((state) => ({
      ...state,
      clientRunning: false,
      launcherStatus: exitMessage,
    }));
  }

  return {
    localizeUpdateMessage,
    handleUpdateProgress,
    handleUpdateCompleted,
    handleUpdateError,
    registerListeners,
    startUpdate,
  };
}
