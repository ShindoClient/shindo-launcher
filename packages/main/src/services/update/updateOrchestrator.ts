import { Broadcast } from '../../ipc/broadcast';
import { loadConfig } from '../config';
import { ensureClientUpToDate } from '../client/clientManager';
import {
  checkLauncherUpdate,
  downloadLauncherUpdate,
  applyLauncherUpdate,
} from './launcherUpdater';
import { logMessage } from '../log';
import type { UpdateStep } from '@shindo/shared';

let running = false;

function progress(
  step: UpdateStep,
  message: string,
  percent: number,
  idx: number,
  total: number,
): void {
  Broadcast.updateProgress({ step, message, percent, phaseIndex: idx, phaseTotal: total });
  logMessage('info', `[update:${step}] ${message} (${percent}%)`);
}

export async function runStartupUpdateSequence(): Promise<void> {
  if (running) return;
  running = true;

  try {
    await execute();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logMessage('error', `Update sequence failed: ${message}`);
    Broadcast.updateError({ success: false, message });
  } finally {
    running = false;
  }
}

async function execute(): Promise<void> {
  const TOTAL = 3;

  // ── Phase 1: Launcher self-update ──────────────────────────────────────────
  progress('launcher-update', 'Checking for launcher updates...', 10, 1, TOTAL);

  const updateInfo = await checkLauncherUpdate();

  if (updateInfo.updateAvailable) {
    progress(
      'launcher-update',
      `Downloading launcher update ${updateInfo.latestVersion ?? ''}...`,
      40,
      1,
      TOTAL,
    );
    const downloaded = await downloadLauncherUpdate();

    if (downloaded.updateAvailable && downloaded.downloadedPath) {
      progress('launcher-update', 'Applying launcher update...', 80, 1, TOTAL);
      const applied = await applyLauncherUpdate(downloaded.downloadedPath);
      if (applied) {
        // App will restart — end sequence here
        Broadcast.updateCompleted({ success: true });
        return;
      }
    }
    progress(
      'launcher-update',
      `Launcher ${updateInfo.latestVersion ?? 'update'} ready.`,
      100,
      1,
      TOTAL,
    );
  } else {
    progress('launcher-update', 'Launcher is up to date.', 100, 1, TOTAL);
  }

  // ── Phase 2: Client sync ──────────────────────────────────────────────────
  const config = loadConfig();
  progress('client-update', 'Checking for client updates...', 10, 2, TOTAL);

  const clientResult = await ensureClientUpToDate({
    versionId: config.versionId,
    build: config.selectedBuild,
    releaseChannel: config.releaseChannel,
  });

  const clientMsg = clientResult.updated
    ? `Client updated to ${clientResult.version ?? 'latest'}.`
    : `Client ready (${clientResult.version ?? 'cached'}).`;

  progress('client-update', clientMsg, 100, 3, TOTAL);

  Broadcast.updateCompleted({ success: true });
}
