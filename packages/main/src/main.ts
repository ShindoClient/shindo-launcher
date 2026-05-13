import { app } from 'electron';
import { boot } from './app/boot';
import { initLogFile } from './services/log';

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Disable hardware acceleration in certain Linux GPU configurations
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

app.whenReady().then(async () => {
  initLogFile(app.getPath('userData'));
  await boot();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
