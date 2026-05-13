<script lang="ts">
  import { updateStore } from '$lib/stores/update.svelte';
  import { t } from '$lib/i18n';
</script>

<div class="update-screen">
  <div class="update-card">
    <img src="/assets/logo.png" alt="Shindo" class="update-logo" />
    <h1 class="update-title">
      {updateStore.isError ? t('update.error') : t('update.title')}
    </h1>

    {#if updateStore.isError}
      <p class="update-error-msg">{updateStore.errorMsg}</p>
      <div class="update-actions">
        <button class="btn btn--primary" onclick={() => updateStore.run()}>
          {t('update.retry')}
        </button>
      </div>
    {:else}
      <div class="update-progress-wrap">
        <div class="update-progress-bar">
          <div class="update-progress-fill" style="width: {updateStore.percent}%"></div>
        </div>
        <div class="update-progress-meta">
          <span class="update-message">
            {updateStore.isDone ? t('update.done') : updateStore.message}
          </span>
          {#if updateStore.phaseTotal > 0}
            <span class="update-phase">
              {t('update.phase', {
                current: updateStore.phaseIndex,
                total: updateStore.phaseTotal,
              })}
            </span>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style lang="scss">
  .update-screen {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-app);
  }

  .update-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    width: 420px;
    padding: 48px 40px;
  }

  .update-logo {
    width: 72px;
    height: 72px;
    object-fit: contain;
    opacity: 0.9;
  }

  .update-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
    letter-spacing: 0.02em;
  }

  .update-progress-wrap {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .update-progress-bar {
    width: 100%;
    height: 4px;
    background: var(--color-bg-surface);
    border-radius: 2px;
    overflow: hidden;
  }

  .update-progress-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .update-progress-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .update-message {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .update-phase {
    font-size: 11px;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .update-error-msg {
    font-size: 13px;
    color: var(--color-danger);
    text-align: center;
    margin: 0;
    max-width: 340px;
  }

  .update-actions {
    display: flex;
    gap: 10px;
  }

  .btn {
    padding: 8px 20px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.12s;

    &:hover {
      opacity: 0.85;
    }
    &--primary {
      background: var(--color-accent);
      color: #fff;
    }
  }
</style>
