<script lang="ts">
  import { onMount } from 'svelte'
  import { appStore } from './store/appStore'
  import TitleBar from './components/TitleBar.svelte'
  import UpdateScreen from './screens/UpdateScreen.svelte'
  import HomeScreen from './screens/HomeScreen.svelte'
  import SettingsScreen from './screens/SettingsScreen.svelte'
  import AccountsScreen from './screens/AccountsScreen.svelte'
  import NavigationBar from './components/NavigationBar.svelte'

  const { init } = appStore

  onMount(() => {
    init().catch((error) => console.error('Failed to initialise app store', error))
  })
</script>

<div class="flex h-screen w-screen flex-col bg-slate-950">
  <TitleBar />
  <div class="flex w-full flex-1 flex-col min-h-0">
    {#if $appStore.screen !== 'update'}
      <NavigationBar />
    {/if}
    <div class="flex w-full flex-1 min-h-0">
      {#if $appStore.screen === 'update'}
        <UpdateScreen />
      {:else if $appStore.screen === 'home'}
        <HomeScreen />
      {:else if $appStore.screen === 'accounts'}
        <AccountsScreen />
      {:else}
        <SettingsScreen />
      {/if}
    </div>
  </div>
</div>
