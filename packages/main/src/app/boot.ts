import { app } from 'electron';
import { createMainWindow } from './windows';
import { registerAllHandlers } from '../ipc/register';
import { logMessage } from '../services/log';

export async function boot(): Promise<void> {
  logMessage('info', `Booting Shindo Launcher v${app.getVersion()}`);

  const mainWindow = await createMainWindow();

  registerAllHandlers({
    getMainWindow: () => mainWindow,
  });

  // macOS: recreate window when dock icon is clicked
  app.on('activate', async () => {
    const { BrowserWindow } = await import('electron');
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });

  logMessage('info', 'Boot complete');
}
