import { ipcMain, app } from 'electron';
import { IpcChannel } from '@shindo/shared';
import { getSystemMemory } from '../../system/memory';

export function registerSystemHandlers(): void {
  ipcMain.handle(IpcChannel.SystemMemory, () => getSystemMemory());

  ipcMain.handle(IpcChannel.AppVersion, () => app.getVersion());

  ipcMain.handle(IpcChannel.Ping, () => 'pong');
}
