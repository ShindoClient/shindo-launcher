import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IpcChannel } from '@shindo/shared';
import type { JavaChooserOptions } from '@shindo/shared';
import { validateJavaExecutable } from '../../services/java/jreManager';

export function registerJavaHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IpcChannel.JavaChoosePath, async (_e, opts: JavaChooserOptions = {}) => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win ?? BrowserWindow.getFocusedWindow()!, {
      title: 'Select Java Executable',
      defaultPath: opts.defaultPath,
      filters: [
        {
          name: 'Java Executable',
          extensions: process.platform === 'win32' ? ['exe'] : ['*'],
        },
      ],
      properties: ['openFile'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(IpcChannel.JavaValidatePath, (_e, javaPath: string) =>
    validateJavaExecutable(javaPath),
  );
}
