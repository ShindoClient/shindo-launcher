import { BrowserWindow } from 'electron';
import {
  IpcEvent,
  type UpdateStep,
  type ClientUpdatePayload,
  type LauncherUpdateInfoPayload,
  type LauncherUpdateResultPayload,
} from '@shindo/shared';
import type { LauncherService } from './launcherService';
import { loadConfig } from './configService';
import { onLauncherDownloadProgress } from './launcherUpdater';

// ─── IPC Helpers ──────────────────────────────────────────────────────────────

function emit(event: IpcEvent, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(event, payload);
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

// ─── Phase Types ──────────────────────────────────────────────────────────────

interface Phase {
  step: UpdateStep;
  /** Static string or lazy resolver (called after preceding phases ran). */
  message: string | (() => string);
  percent: number;
  /** Returns `true` to abort the sequence (e.g. app will quit for update). */
  action?: () => Promise<void | boolean>;
  trackDownloadProgress?: boolean;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

let isRunning = false;

export async function runStartupUpdateSequence(service: LauncherService): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    await runSequence(service);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit(IpcEvent.UpdateError, { success: false, message });
    throw error;
  } finally {
    isRunning = false;
  }
}

async function runSequence(service: LauncherService): Promise<void> {
  // ── 1. Check for launcher update ────────────────────────────────────────────
  const launcherInfo: LauncherUpdateInfoPayload = await service.checkLauncherUpdate();
  let clientState: ClientUpdatePayload | null = null;
  let launcherDownloadResult: LauncherUpdateResultPayload | null = null;

  const phases: Phase[] = [
    {
      step: 'launcher-update',
      message: 'Verificando atualizacoes do launcher...',
      percent: 10,
    },
  ];

  // ── 2. Launcher update phases (conditional) ──────────────────────────────────
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
          const applied = await service.applyLauncherUpdate(
            launcherDownloadResult.downloadedPath ?? null,
          );
          if (applied) {
            emit(IpcEvent.UpdateCompleted, { success: true });
            return true; // Signals sequence abort (app will quit)
          }
        }
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

  // ── 3. Client sync ────────────────────────────────────────────────────────────
  phases.push({
    step: 'client-update',
    message: 'Sincronizando cliente Shindo...',
    percent: 15,
    action: async () => {
      const config = loadConfig();
      clientState = await service.ensureClientUpToDate({
        versionId: config.versionId,
        build: config.selectedBuild,
      });
    },
  });

  phases.push({
    step: 'client-update',
    message: () => {
      if (!clientState) return 'Cliente sincronizado.';
      return clientState.updated
        ? `Cliente atualizado para ${clientState.version ?? 'versao desconhecida'}.`
        : `Cliente pronto (versao ${clientState.version ?? 'desconhecida'}).`;
    },
    percent: 100,
  });

  // ── 4. Run phases ─────────────────────────────────────────────────────────────
  const total = phases.length;

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const message = typeof phase.message === 'function' ? phase.message() : phase.message;

    emitProgress(phase.step, message, phase.percent, i + 1, total);

    let unsubscribe: (() => void) | null = null;
    if (phase.trackDownloadProgress) {
      unsubscribe = onLauncherDownloadProgress((progress) => {
        const pct =
          typeof progress.percent === 'number'
            ? Math.max(0, Math.min(phase.percent, Math.round((progress.percent / 100) * phase.percent)))
            : phase.percent;
        const msg =
          typeof progress.percent === 'number'
            ? `${message} (${Math.round(progress.percent)}%)`
            : message;
        emitProgress(phase.step, msg, pct, i + 1, total);
      });
    }

    try {
      if (phase.action) {
        const shouldStop = await phase.action();
        if (shouldStop === true) return;
      }
    } finally {
      unsubscribe?.();
    }
  }

  emit(IpcEvent.UpdateCompleted, { success: true });
}
