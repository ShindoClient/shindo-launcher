<script lang="ts">
  import Minus from 'lucide-svelte/icons/minus';
  import Settings from 'lucide-svelte/icons/settings';
  import X from 'lucide-svelte/icons/x';
  import { onMount } from 'svelte';
  import logoUrl from '../assets/logo.png';
  import { t } from '../i18n';
  import { appStore } from '../store/appStore';

  const TITLE = 'SHINDO LAUNCHER';
  const { setScreen } = appStore;
  let versionLabel: string | null = null;

  function minimize() {
    window.shindo
      .minimizeWindow()
      .catch((error) => console.error('Failed to minimize window', error));
  }

  function close() {
    window.shindo.closeWindow().catch((error) => console.error('Failed to close window', error));
  }

  function toggleSettings(event: MouseEvent) {
    event.stopPropagation();
    const currentScreen = $appStore.screen;
    setScreen(currentScreen === 'settings' ? 'home' : 'settings');
  }

  onMount(() => {
    window.shindo
      .getVersion()
      .then((value) => {
        versionLabel = value.trim() ? value : null;
      })
      .catch((error) => console.error('Failed to fetch launcher version', error));
  });

  $: isSettingsOpen = $appStore.screen === 'settings';
</script>

<style>
  .title-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
    padding: 0 16px;
    background: #000000;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffffff;
    -webkit-app-region: drag;
    -webkit-user-select: none;
    user-select: none;
  }

  .title-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .logo {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    -webkit-app-region: no-drag;
  }

  .title-text {
    display: inline-flex;
    align-items: baseline;
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 1px;
  }

  .title-version {
    margin-left: 6px;
    font-size: 11px;
    font-weight: 500;
    color: #94a3b8;
  }

  .title-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    -webkit-app-region: no-drag;
  }

  .control-button {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: #cbd5e1;
    transition: all 0.2s ease;
  }

  .control-button:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
  }

  .icon {
    width: 14px;
    height: 14px;
  }

  .control-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .control-button:active {
    transform: translateY(1px);
  }

  .control-button.close:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .control-button.settings {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.2);
  }

  .control-button.settings:hover {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .control-button.settings.active {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.4);
    color: #93c5fd;
  }
</style>

<header
  class="title-bar"
  role="presentation"
  on:dblclick|preventDefault|stopPropagation={() => null}
>
  <div class="title-left">
    <img class="logo" src={logoUrl} alt="Shindo Launcher Logo" draggable="false" />
    <span class="title-text">
      {TITLE}
      {#if versionLabel}
        <span class="title-version">v{versionLabel}</span>
      {/if}
    </span>
  </div>
  <div class="title-controls" role="group" aria-label={$t('titleBar.controls')}>
    <button
      type="button"
      class={`control-button settings ${isSettingsOpen ? 'active' : ''}`}
      title={isSettingsOpen ? $t('titleBar.settingsBack') : $t('titleBar.settingsOpen')}
      aria-label={$t('titleBar.settingsAria')}
      aria-pressed={isSettingsOpen}
      on:click|stopPropagation={toggleSettings}
    >
      <Settings class="icon" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="control-button"
      title={$t('titleBar.minimize')}
      aria-label={$t('titleBar.minimize')}
      on:click|stopPropagation={minimize}
    >
      <Minus class="icon" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="control-button close"
      title={$t('titleBar.close')}
      aria-label={$t('titleBar.close')}
      on:click|stopPropagation={close}
    >
      <X class="icon" aria-hidden="true" />
    </button>
  </div>
</header>
