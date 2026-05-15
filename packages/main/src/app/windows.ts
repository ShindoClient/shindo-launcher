import { BrowserWindow, nativeImage, shell } from 'electron';
import path from 'node:path';
import { logMessage } from '../services/log';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function resolveIconPath(): string | null {
  const file = 'logo.png';
  if (isDev) {
    return path.resolve(__dirname, '../../../logo.png');
  }
  return path.join(process.resourcesPath, file);
}

function loadIcon() {
  const iconPath = resolveIconPath();
  if (!iconPath) return undefined;
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? undefined : icon;
}

export async function createMainWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1200,
    height: 720,
    minWidth: 1000,
    minHeight: 650,
    resizable: false,
    title: 'Shindo Launcher',
    show: false,
    frame: false,
    backgroundColor: '#0f172a',
    icon: loadIcon(),
    ...(process.platform === 'darwin' && {
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 12, y: 16 },
    }),
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Open external links in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  win.on('closed', () => logMessage('info', 'Main window closed'));
  return win;
}

export async function createLogWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 920,
    height: 620,
    minWidth: 700,
    minHeight: 480,
    resizable: true,
    title: 'Shindo — Launch Logs',
    show: false,
    frame: false,
    backgroundColor: '#0b1224',
    icon: loadIcon(),
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(`${process.env.VITE_DEV_SERVER_URL}/logs.html`);
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/logs.html'));
  }

  return win;
}
