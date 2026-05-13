<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore } from '$lib/stores/app.svelte';
  import TitleBar from '$lib/components/layout/TitleBar.svelte';
  import UpdateScreen from './screens/UpdateScreen.svelte';
  import HomeScreen from './screens/HomeScreen.svelte';
  import SettingsScreen from './screens/SettingsScreen.svelte';

  onMount(() => {
    appStore.init().catch(console.error);
  });
</script>

<div class="launcher-shell">
  <TitleBar />

  <main class="launcher-content">
    {#if !appStore.initialized && !appStore.initError}
      <div class="launcher-boot">
        <div class="boot-spinner"></div>
      </div>
    {:else if appStore.initError}
      <div class="launcher-error">
        <p>Failed to initialize launcher</p>
        <code>{appStore.initError}</code>
      </div>
    {:else if appStore.screen === 'update'}
      <UpdateScreen />
    {:else if appStore.screen === 'home'}
      <HomeScreen />
    {:else}
      <SettingsScreen />
    {/if}
  </main>
</div>

<style lang="scss">
  :global(*) {
    box-sizing: border-box;
  }

  .launcher-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background: var(--color-bg-app);
    border-radius: 3px;
    overflow: hidden;
  }

  .launcher-content {
    flex: 1;
    min-height: 0;
    display: flex;
    width: 100%;
    position: relative;
  }

  .launcher-boot {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .boot-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .launcher-error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px;

    p {
      color: var(--color-danger);
      font-weight: 600;
      margin: 0;
    }

    code {
      font-size: 11px;
      color: var(--color-text-muted);
      background: var(--color-bg-surface);
      padding: 8px 14px;
      border-radius: 6px;
      max-width: 520px;
      word-break: break-all;
    }
  }
</style>
