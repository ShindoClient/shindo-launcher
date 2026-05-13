import { ipcMain } from 'electron';
import { IpcChannel } from '@shindo/shared';
import type { LauncherConfig } from '@shindo/shared';
import { loadConfig, updateConfig } from '../../services/config';

export function registerConfigHandlers(): void {
  ipcMain.handle(IpcChannel.ConfigGet, () => loadConfig());

  ipcMain.handle(IpcChannel.ConfigSet, (_e, patch: Partial<LauncherConfig>) => updateConfig(patch));
}
