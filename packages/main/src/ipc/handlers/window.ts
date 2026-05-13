import { ipcMain, BrowserWindow } from 'electron';
import { IpcChannel } from '@shindo/shared';
import { createLogWindow } from '../../app/windows';

let logWindow: BrowserWindow | null = null;

export function registerWindowHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IpcChannel.WindowMinimize, () => {
    getMainWindow()?.minimize();
  });

  ipcMain.handle(IpcChannel.WindowClose, () => {
    getMainWindow()?.close();
  });

  ipcMain.handle(IpcChannel.LogWindowOpen, async () => {
    if (logWindow && !logWindow.isDestroyed()) {
      logWindow.focus();
      return;
    }
    logWindow = await createLogWindow();
    logWindow.on('closed', () => {
      logWindow = null;
    });
  });

  ipcMain.handle(IpcChannel.LogWindowClose, () => {
    if (logWindow && !logWindow.isDestroyed()) {
      logWindow.close();
    }
  });
}
