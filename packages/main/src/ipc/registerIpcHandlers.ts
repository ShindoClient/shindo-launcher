import {
  BrowserWindow,
  OpenDialogOptions,
  dialog,
  ipcMain,
  app,
} from 'electron';
import {
  IpcChannel,
  IpcEvent,
  type LaunchLogEntry,
  type LaunchLogLevel,
  type LauncherConfig,
} from '@shindo/shared';
import { accountService } from '../services/accountService';
import { loadConfig, updateConfig } from '../services/configService';
import { validateJavaExecutable } from '../services/jreManager';
import type { LauncherService } from '../services/launcherService';
import { runStartupUpdateSequence } from '../services/updateOrchestrator';
import { getSystemMemory } from '../system/memory';

interface IpcContext {
  launcherService: LauncherService;
  getMainWindow: () => BrowserWindow | null;
  emitLaunchLog: (level: LaunchLogLevel, message: string) => void;
  classifyLaunchLog: (message: unknown, fallback?: LaunchLogLevel) => LaunchLogLevel;
  emitJavaUpdateProgress: (message: string, percent: number) => void;
  emitJavaUpdateCompleted: () => void;
  emitJavaUpdateError: (message: string) => void;
  createLogWindow: () => Promise<void>;
  getLaunchLogBuffer: () => LaunchLogEntry[];
  clearLaunchLogBuffer: () => void;
}

export function registerIpcHandlers(context: IpcContext): void {
  const {
    launcherService,
    getMainWindow,
    emitLaunchLog,
    classifyLaunchLog,
    emitJavaUpdateProgress,
    emitJavaUpdateCompleted,
    emitJavaUpdateError,
    createLogWindow,
    getLaunchLogBuffer,
    clearLaunchLogBuffer,
  } = context;

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

    if (Object.prototype.hasOwnProperty.call(incomingPatch, 'javaSource')) {
      if (incomingPatch.javaSource === 'auto') {
        incomingPatch.javaCustomPath = null;
        incomingPatch.javaPath = null;
        incomingPatch.javaRuntimeMajor = undefined;
      }
    }

    if (Object.prototype.hasOwnProperty.call(incomingPatch, 'javaCustomPath')) {
      incomingPatch.javaSource = 'custom';
      incomingPatch.javaPath = incomingPatch.javaCustomPath ?? null;
    }

    return updateConfig(incomingPatch);
  });

  ipcMain.handle(IpcChannel.JavaChoosePath, async (event, options) => {
    const parent = BrowserWindow.fromWebContents(event.sender) ?? getMainWindow();
    const dialogOptions: OpenDialogOptions = {
      title: 'Select Java executable',
      buttonLabel: 'Choose Java',
      defaultPath: options?.defaultPath,
      properties: ['openFile'] as const,
    };
    const { canceled, filePaths } = parent
      ? await dialog.showOpenDialog(parent, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (canceled || filePaths.length === 0) {
      return null;
    }
    return filePaths[0];
  });

  ipcMain.handle(IpcChannel.JavaValidatePath, async (_event, filePath) =>
    validateJavaExecutable(String(filePath ?? '')),
  );

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
    const window = getMainWindow();
    window?.close();
  });

  ipcMain.handle(IpcChannel.LaunchLogHistory, () => getLaunchLogBuffer());

  ipcMain.handle(IpcChannel.LaunchLogClear, () => {
    clearLaunchLogBuffer();
  });

  ipcMain.handle(IpcChannel.LaunchStart, (_event, options) => {
    emitLaunchLog('info', 'Iniciando ShindoClient...');
    return launcherService
      .launchClient(options, {
        onLog: (message) => emitLaunchLog(classifyLaunchLog(message, 'info'), message),
        onError: (message) => emitLaunchLog(classifyLaunchLog(message, 'error'), message),
        onClose: (code) => {
          const exitMessage = `Processo finalizado com codigo ${code ?? 'desconhecido'}`;
          emitLaunchLog('info', exitMessage);
          BrowserWindow.getAllWindows().forEach((window) => {
            window.webContents.send(IpcEvent.LaunchExit, { code });
          });
        },
        onJavaProgress: (payload) => emitJavaUpdateProgress(payload.message, payload.percent),
        onJavaReady: (info) => {
          emitJavaUpdateProgress(`Java ${info.major} pronto`, 100);
          emitJavaUpdateCompleted();
        },
        onJavaError: (message) => {
          emitJavaUpdateError(message);
        },
      })
      .then((result) => {
        const summary = result.pid ? `Cliente iniciado (pid ${result.pid}).` : 'Cliente iniciado.';
        emitLaunchLog('info', summary);
        return result;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        emitLaunchLog('error', message);
        emitJavaUpdateError(message);
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
}
