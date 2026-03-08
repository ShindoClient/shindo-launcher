import { writable, get } from 'svelte/store';
import type { LaunchLogEntry, LaunchLogLevel, LaunchLogPayload } from '@shindo/shared';

export type ClientLogEntry = LaunchLogEntry & { id: number };

const LOG_LIMIT = 500;
const store = writable<ClientLogEntry[]>([]);

let initialized = false;
let counter = 0;
let unsubscribe: (() => void) | null = null;

function nextId(): number {
  counter += 1;
  return counter;
}

function normalizeEntry(entry: LaunchLogEntry): ClientLogEntry {
  return {
    ...entry,
    id: nextId(),
  };
}

function clampLogs(logs: ClientLogEntry[]): ClientLogEntry[] {
  if (logs.length <= LOG_LIMIT) return logs;
  return logs.slice(logs.length - LOG_LIMIT);
}

function append(entry: LaunchLogEntry): void {
  store.update((logs) => clampLogs([...logs, normalizeEntry(entry)]));
}

async function loadHistory(): Promise<void> {
  try {
    const history = await window.shindo.getLaunchLogs();
    store.set(clampLogs(history.map(normalizeEntry)));
  } catch (error) {
    console.error('Failed to fetch log history', error);
  }
}

function startListeners(): void {
  if (unsubscribe) return;
  unsubscribe = window.shindo.onLaunchLog((payload: LaunchLogPayload) => append(payload));
}

export const logStore = {
  subscribe: store.subscribe,
  init: async (): Promise<void> => {
    if (initialized) return;
    initialized = true;
    await loadHistory();
    startListeners();
  },
  appendLocal: (level: LaunchLogLevel, message: string): void => {
    append({ level, message, timestamp: Date.now() });
  },
  clear: async (): Promise<void> => {
    store.set([]);
    try {
      await window.shindo.clearLaunchLogs();
    } catch (error) {
      console.error('Failed to clear logs', error);
    }
  },
  get state() {
    return get(store);
  },
};
