export type UpdateStep = 'launcher-update' | 'jre-setup' | 'client-update';
export interface UpdateProgressPayload {
    step: UpdateStep;
    message: string;
    percent: number;
    phaseIndex: number;
    phaseTotal: number;
}
export interface UpdateCompletionPayload {
    success: true;
}
export interface UpdateErrorPayload {
    success: false;
    message: string;
}
export interface LauncherUpdateInfo {
    updateAvailable: boolean;
    currentVersion: string | null;
    latestVersion: string | null;
    downloadedPath?: string;
}
