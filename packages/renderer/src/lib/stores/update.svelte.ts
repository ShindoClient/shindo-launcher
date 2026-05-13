import type { UpdateProgressPayload } from '@shindo/shared';

type UpdateStatus = 'idle' | 'running' | 'done' | 'error';

class UpdateStore {
  status = $state<UpdateStatus>('idle');
  message = $state('');
  percent = $state(0);
  phaseIndex = $state(0);
  phaseTotal = $state(0);
  errorMsg = $state<string | null>(null);

  isRunning = $derived(this.status === 'running');
  isDone = $derived(this.status === 'done');
  isError = $derived(this.status === 'error');

  onProgress(payload: UpdateProgressPayload): void {
    this.status = 'running';
    this.message = payload.message;
    this.percent = payload.percent;
    this.phaseIndex = payload.phaseIndex;
    this.phaseTotal = payload.phaseTotal;
  }

  onCompleted(): void {
    this.status = 'done';
    this.percent = 100;
  }

  onError(message: string): void {
    this.status = 'error';
    this.errorMsg = message;
  }

  reset(): void {
    this.status = 'idle';
    this.message = '';
    this.percent = 0;
    this.phaseIndex = 0;
    this.phaseTotal = 0;
    this.errorMsg = null;
  }

  async run(): Promise<void> {
    this.status = 'running';
    this.message = 'Starting...';
    this.percent = 0;
    await window.shindo.runStartupUpdate();
  }
}

export const updateStore = new UpdateStore();
