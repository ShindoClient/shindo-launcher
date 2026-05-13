<script lang="ts">
  import { launchStore } from '$lib/stores/launch.svelte';
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { configStore } from '$lib/stores/config.svelte';
  import { t } from '$lib/i18n';
  import AccountSelector from '$lib/components/domain/AccountSelector.svelte';

  let statusMsg = $state('');
  let bannerUrl = $state<string | null>(null);

  const canPlay = $derived(Boolean(accountsStore.activeAccount) && !launchStore.isActive);

  const playLabel = $derived(
    launchStore.isLaunching
      ? t('home.launching')
      : launchStore.isRunning
        ? t('home.stop')
        : accountsStore.activeAccount
          ? t('home.play')
          : t('home.accountRequired'),
  );

  async function handlePlayStop() {
    if (launchStore.isRunning) {
      await launchStore.stop();
      statusMsg = t('home.status.stopped');
      return;
    }
    if (!canPlay) return;

    statusMsg = '';
    try {
      await launchStore.launch({
        versionId: configStore.data?.versionId,
        build: configStore.data?.selectedBuild,
      });
      statusMsg = launchStore.pid
        ? t('home.status.startedPid', { pid: launchStore.pid })
        : t('home.status.started');
    } catch (err) {
      statusMsg = t('home.status.failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Show logs window automatically if configured
  $effect(() => {
    if (launchStore.isRunning && configStore.showLogs) {
      window.shindo.openLogWindow().catch(() => {});
    }
  });
</script>

<div class="home-screen">
  <!-- Background banner -->
  {#if bannerUrl}
    <div class="home-banner" style="background-image: url({bannerUrl})"></div>
  {/if}

  <div class="home-content">
    <!-- Left panel: version + play -->
    <div class="home-left">
      <div class="home-version-badge">
        <span class="home-version-label">
          {configStore.data?.versionId ?? ''}
        </span>
      </div>

      {#if statusMsg}
        <p class="home-status">{statusMsg}</p>
      {/if}

      <button
        class="home-play-btn"
        class:home-play-btn--active={launchStore.isRunning}
        class:home-play-btn--disabled={!canPlay && !launchStore.isRunning}
        disabled={launchStore.isLaunching || (!canPlay && !launchStore.isRunning)}
        onclick={handlePlayStop}
      >
        {playLabel}
      </button>
    </div>

    <!-- Right panel: accounts -->
    <div class="home-right">
      <AccountSelector />
    </div>
  </div>
</div>

<style lang="scss">
  .home-screen {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .home-banner {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    opacity: 0.18;
    pointer-events: none;
    z-index: 0;
  }

  .home-content {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding: 32px 40px;
    gap: 24px;
  }

  .home-left {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 280px;
  }

  .home-version-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(255 255 255 / 0.06);
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    padding: 6px 14px;
    width: fit-content;
  }

  .home-version-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
    letter-spacing: 0.04em;
  }

  .home-status {
    font-size: 12px;
    color: var(--color-text-muted);
    margin: 0;
    max-width: 300px;
  }

  .home-play-btn {
    height: 52px;
    padding: 0 40px;
    min-width: 200px;
    background: var(--color-accent);
    color: #fff;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.12em;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition:
      filter 0.12s,
      transform 0.08s;

    &:hover:not(:disabled) {
      filter: brightness(1.12);
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &--active {
      background: var(--color-danger);
    }

    &--disabled,
    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  .home-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    min-width: 260px;
  }
</style>
