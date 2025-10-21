import { BrowserWindow } from 'electron';
import { IpcEvent, type UpdateStep, type ClientUpdatePayload, type LauncherUpdateInfoPayload, type LauncherUpdateResultPayload } from '@shindo/shared';
import type { LauncherService } from './launcherService';
import { loadConfig, updateConfig } from './configService';
import { ensureJre, type EnsureJreResult } from './jreManager';
import { onLauncherDownloadProgress } from './launcherUpdater';

let isRunning = false;

function emit(event: IpcEvent, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(event, payload);
  }
}

function emitProgress(
  step: UpdateStep,
  message: string,
  percent: number,
  phaseIndex: number,
  phaseTotal: number,
): void {
  emit(IpcEvent.UpdateProgress, { step, message, percent, phaseIndex, phaseTotal });
}

interface PhaseDescriptor {
  step: UpdateStep;
  message: string | (() => string);
  percent: number;
  action?: () => Promise<void | boolean>;
  trackDownloadProgress?: boolean;
}

export async function runStartupUpdateSequence(service: LauncherService): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const launcherInfo: LauncherUpdateInfoPayload = await service.checkLauncherUpdate();
    let jreResult: EnsureJreResult | null = null;
    let clientState: ClientUpdatePayload | null = null;
    let launcherDownloadResult: LauncherUpdateResultPayload | null = null;

    const phases: PhaseDescriptor[] = [
      {
        step: 'launcher-update',
        message: 'Verificando atualizacoes do launcher...',
        percent: 10,
      },
    ];

    if (launcherInfo.updateAvailable) {
      phases.push({
        step: 'launcher-update',
        message: 'Baixando atualizacao do launcher...',
        percent: 55,
        trackDownloadProgress: true,
        action: async () => {
          launcherDownloadResult = await service.downloadLauncherUpdate();
        },
      });
      phases.push({
        step: 'launcher-update',
        message: 'Aplicando atualizacao do launcher...',
        percent: 90,
        action: async () => {
          if (launcherDownloadResult?.updateAvailable) {
            const applied = await service.applyLauncherUpdate(launcherDownloadResult.downloadedPath ?? null);
            if (applied) {
              emit(IpcEvent.UpdateCompleted, { success: true });
              return true;
            }
          }
          return false;
        },
      });
      phases.push({
        step: 'launcher-update',
        message: () => `Atualizacao do launcher preparada (${launcherInfo.latestVersion ?? 'nova versao'}).`,
        percent: 100,
      });
    } else {
      phases.push({
        step: 'launcher-update',
        message: 'Launcher ja esta atualizado.',
        percent: 100,
      });
    }

    phases.push({
      step: 'jre-setup',
      message: 'Verificando runtime Java...',
      percent: 10,
      action: async () => {
        const config = loadConfig();
        jreResult = await ensureJre(config);
        if (jreResult.patch) {
          updateConfig(jreResult.patch);
        }
      },
    });

    phases.push({
      step: 'jre-setup',
      message: () => jreResult?.message ?? 'Runtime verificado.',
      percent: 100,
    });

    phases.push({
      step: 'client-update',
      message: 'Sincronizando cliente Shindo...',
      percent: 15,
      action: async () => {
        clientState = await service.ensureClientUpToDate();
      },
    });

    phases.push({
      step: 'client-update',
      message: () => {
        if (!clientState) {
          return 'Cliente sincronizado.';
        }
        return clientState.updated
          ? `Cliente atualizado para ${clientState.version ?? 'versao desconhecida'}.`
          : `Cliente pronto (versao ${clientState.version ?? 'desconhecida'}).`;
      },
      percent: 100,
    });

    const total = phases.length;
    for (let index = 0; index < phases.length; index += 1) {
      const phase = phases[index];
      const baseMessage = typeof phase.message === 'function' ? phase.message() : phase.message;
      emitProgress(phase.step, baseMessage, phase.percent, index + 1, total);

      let unsubscribe: (() => void) | null = null;
      if (phase.trackDownloadProgress) {
        unsubscribe = onLauncherDownloadProgress((progress) => {
          const percentValue =
            typeof progress.percent === 'number'
              ? Math.max(0, Math.min(phase.percent, Math.round((progress.percent / 100) * phase.percent)))
              : phase.percent;
          const messageWithPercent =
            typeof progress.percent === 'number'
              ? `${baseMessage} (${Math.round(progress.percent)}%)`
              : baseMessage;
          emitProgress(phase.step, messageWithPercent, percentValue, index + 1, total);
        });
      }

      try {
        if (phase.action) {
          const shouldStop = await phase.action();
          if (shouldStop === true) {
            return;
          }
        }
      } finally {
        unsubscribe?.();
      }
    }

    emit(IpcEvent.UpdateCompleted, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit(IpcEvent.UpdateError, { success: false, message });
    throw error;
  } finally {
    isRunning = false;
  }
}
