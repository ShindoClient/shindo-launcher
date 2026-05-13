import { ipcMain } from 'electron';
import { IpcChannel } from '@shindo/shared';
import type { LaunchOptions } from '@shindo/shared';
import { Broadcast } from '../broadcast';
import { launchClient, stopClient } from '../../services/launcher/processManager';
import {
  appendLaunchLog,
  getLaunchLogBuffer,
  clearLaunchLogBuffer,
  classifyLevel,
} from '../../services/log';

export function registerLaunchHandlers(): void {
  ipcMain.handle(IpcChannel.LaunchStart, async (_e, opts: LaunchOptions = {}) => {
    const startEntry = appendLaunchLog('info', 'Launching ShindoClient...');
    Broadcast.launchLog(startEntry);

    return launchClient(opts, {
      onLog: (msg) => {
        const entry = appendLaunchLog(classifyLevel(msg), msg);
        Broadcast.launchLog(entry);
      },
      onClose: (code) => {
        const entry = appendLaunchLog('info', `Process exited with code ${code ?? 'unknown'}`);
        Broadcast.launchLog(entry);
        Broadcast.launchExit({ code });
      },
    });
  });

  ipcMain.handle(IpcChannel.LaunchStop, () => stopClient());

  ipcMain.handle(IpcChannel.LaunchLogHistory, () => getLaunchLogBuffer());

  ipcMain.handle(IpcChannel.LaunchLogClear, () => clearLaunchLogBuffer());
}
