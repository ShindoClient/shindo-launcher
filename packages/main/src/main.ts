import fs from 'node:fs';
import { app, BrowserWindow, ipcMain, shell, nativeImage } from 'electron';
import path from 'node:path';
import { IpcChannel, IpcEvent } from '@shindo/shared';
import { LauncherService } from './services/launcherService';
import { loadConfig, updateConfig } from './services/configService';
import { getSystemMemory } from './system/memory';
import { runStartupUpdateSequence } from './services/updateOrchestrator';

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;
const ICON_MAP: Partial<Record<NodeJS.Platform, string>> = {
  win32: 'logo.ico',
  linux: 'logo.png',
  darwin: 'logo.icns',
};
const DEFAULT_ICON_FILE = 'logo.png';

type LogLevel = 'info' | 'error' | 'warn';

let logFilePath: string | null = null;
const pendingLogs: string[] = [];

function persistLog(line: string): void {
  if (!logFilePath) {
    pendingLogs.push(line);
    return;
  }
  try {
    fs.appendFileSync(logFilePath, line);
  } catch {
    pendingLogs.push(line);
  }
}

function flushPendingLogs(): void {
  if (!logFilePath || pendingLogs.length === 0) {
    return;
  }
  try {
    fs.appendFileSync(logFilePath, pendingLogs.join(''));
    pendingLogs.length = 0;
  } catch {
    // keep pending
  }
}

function logMessage(level: LogLevel, message: string): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
  persistLog(line);
  if (level === 'error') {
    console.error(message);
  } else if (level === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }
}

function resolveAssetPath(fileName: string): string {
  if (isDev) {
    return path.resolve(__dirname, '../../packages/renderer/src/assets', fileName);
  }
  return path.join(process.resourcesPath, fileName);
}

function resolveIconPath(): string {
  const iconFile = ICON_MAP[process.platform as NodeJS.Platform] ?? DEFAULT_ICON_FILE;
  return resolveAssetPath(iconFile);
}

function createWindowIcon() {
  const icon = nativeImage.createFromPath(resolveIconPath());
  return icon.isEmpty() ? undefined : icon;
}

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
    icon: createWindowIcon(),
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

    if (process.platform === 'darwin') {
      const dockIcon = nativeImage.createFromPath(resolveAssetPath('logo.png'));
      if (!dockIcon.isEmpty() && app.dock) {
        app.dock.setIcon(dockIcon);
      }
    }
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

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logMessage('error', `Renderer failed to load (${errorCode}): ${errorDescription} -> ${validatedURL}`);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const mappedLevel: LogLevel = level === 2 ? 'error' : level === 1 ? 'warn' : 'info';
    logMessage(mappedLevel, `[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logMessage('error', `Renderer process gone: ${details.reason}`);
  });

  mainWindow.webContents.on('dom-ready', () => {
    logMessage('info', 'Renderer dom-ready event fired');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.executeJavaScript('typeof window.shindo')
      .then((value) => {
        logMessage('info', `Renderer window.shindo typeof: ${value}`);
      })
      .catch((error) => {
        logMessage('error', `Failed to read window.shindo typeof: ${error instanceof Error ? error.message : String(error)}`);
      });

    mainWindow?.webContents.executeJavaScript('document.body.innerHTML')
      .then((html) => {
        const snapshot = String(html).replace(/\s+/g, ' ').trim().slice(0, 200);
        logMessage('info', `Renderer body snapshot: ${snapshot}`);
      })
      .catch((error) => {
        logMessage('error', `Failed to snapshot renderer DOM: ${error instanceof Error ? error.message : String(error)}`);
      });
  });

  setTimeout(() => {
    mainWindow?.webContents.executeJavaScript('typeof window.shindo')
      .then((value) => {
        logMessage('info', `[delay] window.shindo typeof: ${value}`);
      })
      .catch((error) => {
        logMessage('error', `[delay] Failed to read window.shindo typeof: ${error instanceof Error ? error.message : String(error)}`);
      });

    mainWindow?.webContents.executeJavaScript('document.body.innerHTML')
      .then((html) => {
        const snapshot = String(html).replace(/\s+/g, ' ').trim().slice(0, 200);
        logMessage('info', `[delay] body snapshot: ${snapshot}`);
      })
      .catch((error) => {
        logMessage('error', `[delay] Failed to snapshot renderer DOM: ${error instanceof Error ? error.message : String(error)}`);
      });
  }, 5000);
}

app.whenReady().then(async () => {
  try {
    logFilePath = path.join(app.getPath('userData'), 'launcher.log');
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    fs.writeFileSync(logFilePath, '', { flag: 'a' });
    flushPendingLogs();
  } catch (error) {
    console.error('Failed to initialise log file', error);
  }

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

ipcMain.handle(IpcChannel.AppVersion, () => app.getVersion());

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
