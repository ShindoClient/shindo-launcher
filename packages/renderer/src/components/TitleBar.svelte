<script lang="ts">
  import Minus from 'lucide-svelte/icons/minus';
  import Settings from 'lucide-svelte/icons/settings';
  import Home from 'lucide-svelte/icons/home';
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

  function goHome() {
    setScreen('home');
  }

  function goSettings() {
    setScreen('settings');
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
  $: showNavigation = $appStore.screen !== 'update';
</script>

<style lang="scss">
  @use '../styles/variables' as v;
  @use '../styles/mixins';

  .title-bar {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 72px;
    padding: 0 16px;
    background: v.$color-bg-app;
    border-bottom: 1px solid v.$color-border-soft;
    color: v.$color-text;
    -webkit-user-select: none;
    user-select: none;
  }

  .title-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    -webkit-app-region: no-drag;
    margin-left: auto;
  }

  .drag-zone {
    flex: 1;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 16px;
    -webkit-app-region: drag;
    min-width: 0;
  }

  .title-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    grid-column: 1;
  }

  .logo {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    -webkit-app-region: no-drag;
    pointer-events: auto;
  }

  .title-text {
    display: inline-flex;
    align-items: baseline;
    font-size: 14px;
    font-weight: 700;
    color: v.$color-text;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 1px;
  }

  .title-version {
    margin-left: 6px;
    font-size: 11px;
    font-weight: 500;
    color: v.$color-muted-strong;
  }

  .title-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    -webkit-app-region: no-drag;
    grid-column: 2;
    justify-self: center;
  }

  .control-button {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border: 1px solid v.$color-border-soft;
    background: v.$color-surface-weak;
    color: #cbd5e1;
    transition: all 0.2s ease;
  }

  .control-button:focus-visible {
    outline: none;
    @include mixins.focus-ring;
  }

  .icon {
    width: 14px;
    height: 14px;
  }

  .control-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: v.$color-border-strong;
  }

  .control-button:active {
    transform: translateY(1px);
  }

  .control-button.close:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
  }

  .control-button.nav {
    width: 40px;
    height: 40px;
    background: v.$color-surface-strong;
    border-color: rgba(59, 130, 246, 0.25);
    transition: box-shadow 0.25s ease;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.35);
    -webkit-app-region: no-drag;
  }

  .control-button.nav.active {
    background: rgba(59, 130, 246, 0.18);
    border-color: rgba(59, 130, 246, 0.4);
    box-shadow: 0 10px 28px rgba(59, 130, 246, 0.3);
  }

  .control-button.nav:focus-visible {
    outline: none;
    @include mixins.focus-ring;
  }
</style>

<header
  class="title-bar"
  role="presentation"
  on:dblclick|preventDefault|stopPropagation={() => null}
>
  <div class="drag-zone">
    <div class="title-left">
      <img class="logo" src={logoUrl} alt="Shindo Launcher Logo" draggable="false" />
      <span class="title-text">
        {TITLE}
        {#if versionLabel}
          <span class="title-version">v{versionLabel}</span>
        {/if}
      </span>
    </div>

    {#if showNavigation}
      <div class="title-nav">
        <button
          type="button"
          class={`control-button nav ${$appStore.screen === 'home' ? 'active' : ''}`}
          aria-label="Home"
          on:click|stopPropagation={goHome}
        >
          <Home class="icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          class={`control-button nav ${isSettingsOpen ? 'active' : ''}`}
          aria-label="Settings"
          on:click|stopPropagation={goSettings}
        >
          <Settings class="icon" aria-hidden="true" />
        </button>
      </div>
    {/if}
  </div>

  <div class="title-controls" role="group" aria-label={$t('titleBar.controls')}>
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
