<script lang="ts">
  import { appStore } from '$lib/stores/app.svelte';
  import { t } from '$lib/i18n';
  import { Minus, X, Settings, ScrollText } from '@lucide/svelte';

  function minimize() {
    window.shindo.minimizeWindow();
  }
  function close() {
    window.shindo.closeWindow();
  }
  function settings() {
    appStore.navigate('settings');
  }
  function openLogs() {
    window.shindo.openLogWindow();
  }
</script>

<header class="titlebar" data-drag-region>
  <div class="titlebar-brand">
    <img src="/assets/logo-small.png" alt="Shindo" class="titlebar-logo" />
    <span class="titlebar-name">Shindo Launcher</span>
    {#if appStore.version}
      <span class="titlebar-version">v{appStore.version}</span>
    {/if}
  </div>

  <div class="titlebar-actions">
    {#if appStore.screen === 'home'}
      <button class="titlebar-btn" onclick={openLogs} title={t('titleBar.logs')} data-no-drag>
        <ScrollText size={14} />
      </button>
      <button class="titlebar-btn" onclick={settings} title={t('titleBar.settings')} data-no-drag>
        <Settings size={14} />
      </button>
    {/if}
    <button class="titlebar-btn" onclick={minimize} title={t('titleBar.minimize')} data-no-drag>
      <Minus size={14} />
    </button>
    <button
      class="titlebar-btn titlebar-btn--close"
      onclick={close}
      title={t('titleBar.close')}
      data-no-drag
    >
      <X size={14} />
    </button>
  </div>
</header>

<style lang="scss">
  .titlebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 38px;
    padding: 0 8px 0 12px;
    background: var(--color-bg-titlebar);
    border-bottom: 1px solid var(--color-border-subtle);
    flex-shrink: 0;
    -webkit-app-region: drag;
    user-select: none;
  }

  .titlebar-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .titlebar-logo {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  .titlebar-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
    letter-spacing: 0.01em;
  }

  .titlebar-version {
    font-size: 11px;
    color: var(--color-text-muted);
    background: var(--color-bg-tag);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .titlebar-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    -webkit-app-region: no-drag;
  }

  .titlebar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    border-radius: 4px;
    cursor: pointer;
    transition:
      background 0.12s,
      color 0.12s;

    &:hover {
      background: var(--color-bg-hover);
      color: var(--color-text-primary);
    }

    &--close:hover {
      background: var(--color-danger);
      color: #fff;
    }
  }
</style>
