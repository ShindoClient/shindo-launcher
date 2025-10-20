<script lang="ts">
  import { onMount } from 'svelte'
  import { appStore } from './store/appStore'
  import TitleBar from './components/TitleBar.svelte'
  import UpdateScreen from './screens/UpdateScreen.svelte'
  import HomeScreen from './screens/HomeScreen.svelte'
  import SettingsScreen from './screens/SettingsScreen.svelte'
  import LogWindow from './components/LogWindow.svelte'

  const { init, setLogWindowVisible, clearClientLogs } = appStore

  $: clientLogs = $appStore.clientLogs
  $: logWindowVisible = $appStore.logWindowVisible

  onMount(() => {
    init().catch((error) => console.error('Failed to initialise app store', error))
  })

  function handleLogWindowClose() {
    setLogWindowVisible(false)
  }

  function handleLogWindowClear() {
    clearClientLogs()
  }
</script>

<div class="h-screen w-screen bg-slate-950">
  <TitleBar />
  <div class="flex h-[calc(100%-48px)] w-full">
    {#if $appStore.screen === 'update'}
      <UpdateScreen />
    {:else if $appStore.screen === 'home'}
      <HomeScreen />
    {:else}
      <SettingsScreen />
    {/if}
  </div>
  <LogWindow
    visible={logWindowVisible}
    logs={clientLogs}
    on:close={handleLogWindowClose}
    on:clear={handleLogWindowClear}
  />
</div>
