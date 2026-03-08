import {
  IpcChannel,
  IpcEvent,
  type LaunchLogEntry,
  type LaunchLogLevel,
  type LauncherConfig,
} from '@shindo/shared';
import { BrowserWindow, app, ipcMain, nativeImage, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { accountService } from './services/accountService';
import { loadConfig, updateConfig } from './services/configService';
import { ensureJre } from './services/jreManager';
import { LauncherService } from './services/launcherService';
import { runStartupUpdateSequence } from './services/updateOrchestrator';
import { getSystemMemory } from './system/memory';

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;
const ICON_MAP: Partial<Record<NodeJS.Platform, string>> = {
  win32: 'logo.ico',
  linux: 'logo.png',
  darwin: 'logo.icns',
};
const DEFAULT_ICON_FILE = 'logo.png';

type LogLevel = 'debug' | 'info' | 'error' | 'warn';

let logFilePath: string | null = null;
const pendingLogs: string[] = [];
const launchLogBuffer: LaunchLogEntry[] = [];
const LAUNCH_LOG_LIMIT = 500;

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
  } else if (level === 'debug') {
    console.debug(message);
  } else if (level === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }
}

function emitLaunchLog(level: LaunchLogLevel, message: string): void {
  const entry: LaunchLogEntry = {
    level,
    message,
    timestamp: Date.now(),
  };
  logMessage(level, message);
  launchLogBuffer.push(entry);
  if (launchLogBuffer.length > LAUNCH_LOG_LIMIT) {
    launchLogBuffer.splice(0, launchLogBuffer.length - LAUNCH_LOG_LIMIT);
  }
  broadcast(IpcEvent.LaunchLog, entry);
}

function classifyLaunchLog(message: unknown, fallback: LaunchLogLevel = 'info'): LaunchLogLevel {
  const text = String(message ?? '');
  const normalized = text.toLowerCase();
  if (
    normalized.includes('error') ||
    normalized.includes('exception') ||
    normalized.includes('fatal') ||
    normalized.includes('stack trace') ||
    /\[error/.test(normalized)
  ) {
    return 'error';
  }
  if (normalized.includes('warn') || /\[warn/.test(normalized)) {
    return 'warn';
  }
  if (normalized.includes('debug') || normalized.includes('trace') || /\[debug/.test(normalized)) {
    return 'debug';
  }
  return fallback;
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
let logWindow: BrowserWindow | null = null;
const launcherService = new LauncherService();

function broadcast(event: IpcEvent, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(event, payload);
  }
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

ipcMain.handle(IpcChannel.VersionCatalog, async () => launcherService.getVersionCatalog());

ipcMain.handle(IpcChannel.LauncherCheckUpdate, () => launcherService.checkLauncherUpdate());

ipcMain.handle(IpcChannel.LauncherDownloadUpdate, () => launcherService.downloadLauncherUpdate());

ipcMain.handle(IpcChannel.ConfigGet, () => loadConfig());

ipcMain.handle(IpcChannel.ConfigSet, async (_event, patch) => {
  const incomingPatch: Partial<LauncherConfig> = { ...(patch ?? {}) };
  const previous = loadConfig();

  // Clear stale JRE path when switching back to system
  if (incomingPatch.jrePreference === 'system') {
    incomingPatch.jrePath = undefined;
  }

  let next = updateConfig(incomingPatch);

  const shouldReconcileRuntime =
    Object.prototype.hasOwnProperty.call(incomingPatch, 'jrePreference') ||
    Object.prototype.hasOwnProperty.call(incomingPatch, 'jrePath');

  if (shouldReconcileRuntime) {
    const result = await ensureJre(next);
    logMessage('info', result.message);
    if (result.patch) {
      next = updateConfig(result.patch);
    }
  }

  return next;
});

ipcMain.handle(IpcChannel.SystemMemory, () => getSystemMemory());

ipcMain.handle(IpcChannel.AccountsList, () => accountService.getPublicState());

ipcMain.handle(IpcChannel.AccountsAddOffline, (_event, payload) =>
  accountService.addOfflineAccount(payload),
);

ipcMain.handle(IpcChannel.AccountsAddMicrosoft, () => accountService.addMicrosoftAccount());

ipcMain.handle(IpcChannel.AccountsRemove, (_event, payload) =>
  accountService.removeAccount(payload),
);

ipcMain.handle(IpcChannel.AccountsSelect, (_event, payload) =>
  accountService.selectAccount(payload),
);

ipcMain.handle(IpcChannel.RunStartupUpdate, async () => {
  await runStartupUpdateSequence(launcherService);
});

ipcMain.handle(IpcChannel.AppVersion, () => app.getVersion());

ipcMain.handle(IpcChannel.WindowMinimize, (event) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  target?.minimize();
});

ipcMain.handle(IpcChannel.WindowClose, (event) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  target?.close();
});

ipcMain.handle(IpcChannel.LogWindowOpen, async () => {
  await createLogWindow();
});

ipcMain.handle(IpcChannel.LogWindowClose, () => {
  logWindow?.close();
});

ipcMain.handle(IpcChannel.LaunchLogHistory, () => [...launchLogBuffer]);

ipcMain.handle(IpcChannel.LaunchLogClear, () => {
  launchLogBuffer.length = 0;
});

ipcMain.handle(IpcChannel.LaunchStart, (_event, options) => {
  console.log('[MAIN] LaunchStart called with options:', options);
  emitLaunchLog('info', 'Iniciando ShindoClient...');
  return launcherService
    .launchClient(options, {
      onLog: (message) => emitLaunchLog(classifyLaunchLog(message, 'info'), message),
      onError: (message) => emitLaunchLog(classifyLaunchLog(message, 'error'), message),
      onClose: (code) => {
        const exitMessage = `Processo finalizado com codigo ${code ?? 'desconhecido'}`;
        emitLaunchLog('info', exitMessage);
        broadcast(IpcEvent.LaunchExit, { code });
      },
    })
    .then((result) => {
      const summary = result.pid ? `Cliente iniciado (pid ${result.pid}).` : 'Cliente iniciado.';
      emitLaunchLog('info', summary);
      console.log('[MAIN] launchClient succeeded:', result);
      return result;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[MAIN] launchClient failed:', error);
      emitLaunchLog('error', message);
      throw error;
    });
});

ipcMain.handle(IpcChannel.LaunchStop, async () => {
  const stopped = await launcherService.stopClient();
  emitLaunchLog(
    'info',
    stopped
      ? 'Solicitacao de encerramento do cliente enviada.'
      : 'Nenhum cliente em execucao para encerrar.',
  );
  return stopped;
});
