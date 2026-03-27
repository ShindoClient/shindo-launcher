<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore } from './store/appStore';
  import TitleBar from './components/TitleBar.svelte';
  import UpdateScreen from './screens/UpdateScreen.svelte';
  import HomeScreen from './screens/HomeScreen.svelte';
  import SettingsScreen from './screens/SettingsScreen.svelte';
  import NotificationCenter from './components/NotificationCenter.svelte';

  const { init } = appStore;

  onMount(() => {
    init().catch((error) => console.error('Failed to initialise app store', error));
  });
</script>

<div class="launcher-shell">
  <TitleBar />
  <NotificationCenter />
  <div class="content-area">
    <div class="flex min-h-0 w-full flex-1">
      {#if $appStore.screen === 'update'}
        <UpdateScreen />
      {:else if $appStore.screen === 'home'}
        <HomeScreen />
      {:else}
        <SettingsScreen />
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  @use './styles/variables' as v;

  .launcher-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background: v.$color-bg-app;
    border-radius: 3px;
    overflow: hidden;
  }

  .content-area {
    flex: 1;
    min-height: 0;
    display: flex;
    width: 100%;
  }
</style>
