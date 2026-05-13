import { ipcMain } from 'electron';
import { IpcChannel } from '@shindo/shared';
import { runStartupUpdateSequence } from '../../services/update/updateOrchestrator';
import { checkLauncherUpdate, downloadLauncherUpdate } from '../../services/update/launcherUpdater';

export function registerUpdateHandlers(): void {
  ipcMain.handle(IpcChannel.RunStartupUpdate, () => runStartupUpdateSequence());

  ipcMain.handle(IpcChannel.LauncherCheckUpdate, () => checkLauncherUpdate());

  ipcMain.handle(IpcChannel.LauncherDownloadUpdate, () => downloadLauncherUpdate());
}
