import { ipcMain } from 'electron';
import { IpcChannel } from '@shindo/shared';
import {
  ensureClientUpToDate,
  getLocalClientState,
  getVersionCatalog,
} from '../../services/client/clientManager';

export function registerClientHandlers(): void {
  ipcMain.handle(IpcChannel.ClientState, () => getLocalClientState());

  ipcMain.handle(IpcChannel.EnsureClient, (_e, opts) => ensureClientUpToDate(opts ?? {}));

  ipcMain.handle(IpcChannel.VersionCatalog, () => getVersionCatalog());
}
