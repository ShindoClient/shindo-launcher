<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore } from './store/appStore';
  import TitleBar from './components/TitleBar.svelte';
  import UpdateScreen from './screens/UpdateScreen.svelte';
  import HomeScreen from './screens/HomeScreen.svelte';
  import SettingsScreen from './screens/SettingsScreen.svelte';
  import Sidebar from './components/Sidebar.svelte';

  const { init } = appStore;

  onMount(() => {
    init().catch((error) => console.error('Failed to initialise app store', error));
  });
</script>

<div class="flex h-screen w-screen flex-col bg-black">
  <TitleBar />
  <div class="flex min-h-0 w-full flex-1">
    {#if $appStore.screen !== 'update'}
      <Sidebar />
    {/if}
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
