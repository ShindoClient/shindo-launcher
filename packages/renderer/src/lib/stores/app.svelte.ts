import { configStore } from './config.svelte';
import { accountsStore } from './accounts.svelte';
import { updateStore } from './update.svelte';
import { launchStore } from './launch.svelte';
import type { SystemMemoryInfo } from '@shindo/shared';

export type Screen = 'update' | 'home' | 'settings';

class AppStore {
  screen = $state<Screen>('update');
  version = $state('');
  memory = $state<SystemMemoryInfo | null>(null);
  initialized = $state(false);
  initError = $state<string | null>(null);

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Register IPC event listeners
      window.shindo.onUpdateProgress((p) => updateStore.onProgress(p));
      window.shindo.onUpdateCompleted(() => {
        updateStore.onCompleted();
        // Navigate to home after a short delay so progress bar completes visually
        setTimeout(() => {
          this.screen = 'home';
        }, 400);
      });
      window.shindo.onUpdateError((p) => updateStore.onError(p.message));
      window.shindo.onLaunchLog((entry) => launchStore.onLog(entry));
      window.shindo.onLaunchExit((p) => launchStore.onExit(p.code));

      // Parallel load of initial data
      const [ver, , mem] = await Promise.all([
        window.shindo.getVersion(),
        Promise.all([configStore.load(), accountsStore.load()]),
        window.shindo.getSystemMemory(),
      ]);

      this.version = ver;
      this.memory = mem;
      this.initialized = true;

      // Start update sequence — events will drive the UI
      await updateStore.run();
    } catch (err) {
      this.initError = err instanceof Error ? err.message : String(err);
    }
  }

  navigate(screen: Screen): void {
    this.screen = screen;
  }
}

export const appStore = new AppStore();
