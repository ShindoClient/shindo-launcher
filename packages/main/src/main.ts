import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { IpcChannel, IpcEvent } from '@shindo/shared';
import { LauncherService } from './services/launcherService';
import { loadConfig, updateConfig } from './services/configService';
import { getSystemMemory } from './system/memory';
import { runStartupUpdateSequence } from './services/updateOrchestrator';

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

let mainWindow: BrowserWindow | null = null;
const launcherService = new LauncherService();

function broadcast(event: IpcEvent, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(event, payload);
  }
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 740,
    height: 520,
    minWidth: 740,
    minHeight: 520,
    resizable: false,
    title: 'Shindo Launcher',
    show: false,
    frame: false,
    backgroundColor: '#0f172a',
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : undefined,
    trafficLightPosition: process.platform === 'darwin' ? { x: 12, y: 16 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const rendererPath = path.join(__dirname, '../renderer/index.html');
    await mainWindow.loadFile(rendererPath);
  }
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle(IpcChannel.Ping, async () => ({ success: true }));

ipcMain.handle(IpcChannel.EnsureClient, (_event, options) =>
  launcherService.ensureClientUpToDate(options),
);

ipcMain.handle(IpcChannel.ClientState, async () => launcherService.getClientState());

ipcMain.handle(IpcChannel.LauncherCheckUpdate, () => launcherService.checkLauncherUpdate());

ipcMain.handle(IpcChannel.LauncherDownloadUpdate, () => launcherService.downloadLauncherUpdate());

ipcMain.handle(IpcChannel.ConfigGet, () => loadConfig());

ipcMain.handle(IpcChannel.ConfigSet, (_event, patch) => updateConfig(patch ?? {}));

ipcMain.handle(IpcChannel.SystemMemory, () => getSystemMemory());

ipcMain.handle(IpcChannel.RunStartupUpdate, async () => {
  await runStartupUpdateSequence(launcherService);
});

ipcMain.handle(IpcChannel.WindowMinimize, () => {
  mainWindow?.minimize();
});

ipcMain.handle(IpcChannel.WindowClose, () => {
  mainWindow?.close();
});

ipcMain.handle(IpcChannel.LaunchStart, (_event, options) =>
  launcherService.launchClient(options, {
    onLog: (message) => broadcast(IpcEvent.LaunchLog, { level: 'info', message }),
    onError: (message) => broadcast(IpcEvent.LaunchLog, { level: 'error', message }),
    onClose: (code) => broadcast(IpcEvent.LaunchExit, { code }),
  }).then((result) => {
    const summary = result.pid
      ? `Cliente iniciado (pid ${result.pid}).`
      : 'Cliente iniciado.';
    broadcast(IpcEvent.LaunchLog, { level: 'info', message: summary });
    return result;
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    broadcast(IpcEvent.LaunchLog, { level: 'error', message });
    throw error;
  }),
);
