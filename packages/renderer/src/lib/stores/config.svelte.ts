import type { LauncherConfig } from '@shindo/shared';
import { setLocale } from '../i18n';

class ConfigStore {
  data = $state<LauncherConfig | null>(null);
  loading = $state(false);
  error = $state<string | null>(null);

  // Derived values for convenience
  ramGB = $derived(this.data?.ramGB ?? 4);
  language = $derived(this.data?.language ?? 'en');
  channel = $derived(this.data?.releaseChannel ?? 'stable');
  showLogs = $derived(this.data?.showLogsOnLaunch ?? true);

  async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.data = await window.shindo.getConfig();
      setLocale(this.data.language);
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  async patch(update: Partial<LauncherConfig>): Promise<void> {
    if (!this.data) return;
    const prev = this.data;
    // Optimistic update
    this.data = { ...this.data, ...update };
    if (update.language) setLocale(update.language);
    try {
      this.data = await window.shindo.setConfig(update);
    } catch (err) {
      this.data = prev;
      throw err;
    }
  }
}

export const configStore = new ConfigStore();
