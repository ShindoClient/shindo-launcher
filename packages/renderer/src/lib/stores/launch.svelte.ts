import type { LaunchLogEntry } from '@shindo/shared';

type LaunchStatus = 'idle' | 'launching' | 'running' | 'stopping';

class LaunchStore {
  status = $state<LaunchStatus>('idle');
  pid = $state<number | null>(null);
  logs = $state<LaunchLogEntry[]>([]);
  lastExitCode = $state<number | null>(null);
  error = $state<string | null>(null);

  isLaunching = $derived(this.status === 'launching');
  isRunning = $derived(this.status === 'running');
  isActive = $derived(this.status === 'launching' || this.status === 'running');

  async launch(opts: Parameters<typeof window.shindo.launchClient>[0] = {}): Promise<void> {
    if (this.isActive) return;
    this.status = 'launching';
    this.error = null;

    try {
      const result = await window.shindo.launchClient(opts);
      this.pid = result.pid;
      this.status = 'running';
    } catch (err) {
      this.status = 'idle';
      this.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.status = 'stopping';
    await window.shindo.stopClient();
  }

  onLog(entry: LaunchLogEntry): void {
    this.logs.push(entry);
    // Keep buffer to 500 entries
    if (this.logs.length > 500) {
      this.logs.splice(0, this.logs.length - 500);
    }
  }

  onExit(code: number | null): void {
    this.status = 'idle';
    this.pid = null;
    this.lastExitCode = code;
  }

  async clearLogs(): Promise<void> {
    this.logs = [];
    await window.shindo.clearLaunchLogs();
  }
}

export const launchStore = new LaunchStore();
