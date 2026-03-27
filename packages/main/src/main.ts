import {
  IpcChannel,
  IpcEvent,
  type JreStatusPayload,
  type LaunchLogLevel,
  type LauncherConfig,
} from '@shindo/shared';
import { BrowserWindow, app, nativeImage, shell } from 'electron';
import path from 'node:path';
import { LauncherService } from './services/launcherService';
import {
  appendLaunchLog,
  classifyLaunchLog,
  clearLaunchLogBuffer,
  getLaunchLogBuffer,
  initLogFile,
  LogLevel,
  logMessage,
} from './services/logService';
import { registerIpcHandlers } from './ipc/registerIpcHandlers';

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;
const ICON_MAP: Partial<Record<NodeJS.Platform, string>> = {
  win32: 'logo.ico',
  linux: 'logo.png',
  darwin: 'logo.icns',
};
const DEFAULT_ICON_FILE = 'logo.png';

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
let logWindow: BrowserWindow | null = null;
const launcherService = new LauncherService();
launcherService.setJreNotifier((payload) => {
  broadcastJreStatus({
    ...payload,
    source: 'launch',
  });
});

function broadcast(event: IpcEvent, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(event, payload);
  }
}

function broadcastJreStatus(payload: JreStatusPayload): void {
  broadcast(IpcEvent.JreStatus, payload);
}

function emitLaunchLog(level: LaunchLogLevel, message: string): void {
  const entry = appendLaunchLog(level, message);
  broadcast(IpcEvent.LaunchLog, entry);
}

function emitJavaUpdateProgress(message: string, percent: number): void {
  broadcast(IpcEvent.UpdateProgress, {
    step: 'jre-setup',
    message,
    percent: Math.max(0, Math.min(100, percent)),
    phaseIndex: 1,
    phaseTotal: 1,
  });
}

function emitJavaUpdateCompleted(): void {
  broadcast(IpcEvent.UpdateCompleted, { success: true });
}

function emitJavaUpdateError(message: string): void {
  broadcast(IpcEvent.UpdateError, { success: false, message });
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 720,
    minWidth: 1000,
    minHeight: 650,
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

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      logMessage(
        'error',
        `Renderer failed to load (${errorCode}): ${errorDescription} -> ${validatedURL}`,
      );
    },
  );

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
    mainWindow?.webContents
      .executeJavaScript('typeof window.shindo')
      .then((value) => {
        logMessage('info', `Renderer window.shindo typeof: ${value}`);
      })
      .catch((error) => {
        logMessage(
          'error',
          `Failed to read window.shindo typeof: ${error instanceof Error ? error.message : String(error)}`,
        );
      });

    mainWindow?.webContents
      .executeJavaScript('document.body.innerHTML')
      .then((html) => {
        const snapshot = String(html).replace(/\s+/g, ' ').trim().slice(0, 200);
        logMessage('info', `Renderer body snapshot: ${snapshot}`);
      })
      .catch((error) => {
        logMessage(
          'error',
          `Failed to snapshot renderer DOM: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  });

  setTimeout(() => {
    mainWindow?.webContents
      .executeJavaScript('typeof window.shindo')
      .then((value) => {
        logMessage('info', `[delay] window.shindo typeof: ${value}`);
      })
      .catch((error) => {
        logMessage(
          'error',
          `[delay] Failed to read window.shindo typeof: ${error instanceof Error ? error.message : String(error)}`,
        );
      });

    mainWindow?.webContents
      .executeJavaScript('document.body.innerHTML')
      .then((html) => {
        const snapshot = String(html).replace(/\s+/g, ' ').trim().slice(0, 200);
        logMessage('info', `[delay] body snapshot: ${snapshot}`);
      })
      .catch((error) => {
        logMessage(
          'error',
          `[delay] Failed to snapshot renderer DOM: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }, 5000);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (logWindow) {
      logWindow.close();
      logWindow = null;
    }
  });
}

async function createLogWindow(): Promise<void> {
  if (logWindow) {
    if (logWindow.isMinimized()) {
      logWindow.restore();
    }
    logWindow.focus();
    return;
  }

  logWindow = new BrowserWindow({
    width: 920,
    height: 620,
    minWidth: 700,
    minHeight: 480,
    resizable: true,
    title: 'Shindo Logs',
    show: false,
    frame: false,
    backgroundColor: '#0b1224',
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

  logWindow.on('ready-to-show', () => {
    logWindow?.show();
  });

  logWindow.on('closed', () => {
    logWindow = null;
    emitLaunchLog('info', 'Janela de logs fechada.');
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await logWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/logs.html`);
    logWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const rendererPath = path.join(__dirname, '../renderer/logs.html');
    await logWindow.loadFile(rendererPath);
  }
}

app.whenReady().then(async () => {
  initLogFile(app.getPath('userData'));

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

registerIpcHandlers({
  launcherService,
  getMainWindow: () => mainWindow,
  emitLaunchLog,
  classifyLaunchLog,
  emitJavaUpdateProgress,
  emitJavaUpdateCompleted,
  emitJavaUpdateError,
  createLogWindow,
  getLaunchLogBuffer,
  clearLaunchLogBuffer,
});
