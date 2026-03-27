import type { ProgressInfo, UpdateDownloadedEvent, UpdateFileInfo } from 'electron-updater';
import { autoUpdater } from 'electron-updater';

const progressListeners = new Set<(info: ProgressInfo) => void>();

function computeTotalFromFiles(files: UpdateFileInfo[] | undefined): number {
  return (files ?? []).reduce((acc, file) => acc + (file.size ?? 0), 0);
}

function broadcastProgress(partial: Partial<ProgressInfo>): void {
  const payload: ProgressInfo = {
    percent: partial.percent ?? 0,
    bytesPerSecond: partial.bytesPerSecond ?? 0,
    transferred: partial.transferred ?? 0,
    total: partial.total ?? partial.transferred ?? 0,
    delta: partial.delta ?? 0,
  };

  for (const listener of progressListeners) {
    try {
      listener(payload);
    } catch (error) {
      console.error('launcher download progress listener failed', error);
    }
  }
}

export function setupAutoUpdaterProgressHooks(): void {
  autoUpdater.on('download-progress', (info) => {
    broadcastProgress(info);
  });

  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    const total = computeTotalFromFiles(info.files);
    broadcastProgress({
      percent: 100,
      transferred: total,
      total,
    });
  });
}

export function onLauncherDownloadProgress(listener: (info: ProgressInfo) => void): () => void {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

export function notifyProgress(partial: Partial<ProgressInfo>): void {
  broadcastProgress(partial);
}
