import { ipcRenderer } from 'electron';
import { IpcEvent } from '@shindo/shared';
import type {
  UpdateProgressPayload,
  UpdateCompletionPayload,
  UpdateErrorPayload,
  LaunchLogEntry,
  LaunchExitPayload,
  JreStatusPayload,
} from '@shindo/shared';

type Unsubscribe = () => void;

function on<T>(event: IpcEvent, cb: (payload: T) => void): Unsubscribe {
  const handler = (_: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(event, handler as never);
  return () => ipcRenderer.removeListener(event, handler as never);
}

export const events = {
  onUpdateProgress: (cb: (p: UpdateProgressPayload) => void): Unsubscribe =>
    on(IpcEvent.UpdateProgress, cb),

  onUpdateCompleted: (cb: (p: UpdateCompletionPayload) => void): Unsubscribe =>
    on(IpcEvent.UpdateCompleted, cb),

  onUpdateError: (cb: (p: UpdateErrorPayload) => void): Unsubscribe => on(IpcEvent.UpdateError, cb),

  onLaunchLog: (cb: (entry: LaunchLogEntry) => void): Unsubscribe => on(IpcEvent.LaunchLog, cb),

  onLaunchExit: (cb: (p: LaunchExitPayload) => void): Unsubscribe => on(IpcEvent.LaunchExit, cb),

  onJreStatus: (cb: (p: JreStatusPayload) => void): Unsubscribe => on(IpcEvent.JreStatus, cb),
};
