import { BrowserWindow } from 'electron';
import { IpcEvent } from '@shindo/shared';
import type {
  UpdateProgressPayload,
  UpdateCompletionPayload,
  UpdateErrorPayload,
  LaunchLogEntry,
  LaunchExitPayload,
  JreStatusPayload,
} from '@shindo/shared';

function broadcast(event: IpcEvent, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(event, payload);
    }
  }
}

export const Broadcast = {
  updateProgress: (payload: UpdateProgressPayload): void =>
    broadcast(IpcEvent.UpdateProgress, payload),

  updateCompleted: (payload: UpdateCompletionPayload): void =>
    broadcast(IpcEvent.UpdateCompleted, payload),

  updateError: (payload: UpdateErrorPayload): void => broadcast(IpcEvent.UpdateError, payload),

  launchLog: (entry: LaunchLogEntry): void => broadcast(IpcEvent.LaunchLog, entry),

  launchExit: (payload: LaunchExitPayload): void => broadcast(IpcEvent.LaunchExit, payload),

  jreStatus: (payload: JreStatusPayload): void => broadcast(IpcEvent.JreStatus, payload),
};
