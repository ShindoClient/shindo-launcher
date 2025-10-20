<script lang="ts">
  import Loader from 'lucide-svelte/icons/loader'
  import RefreshCw from 'lucide-svelte/icons/refresh-cw'
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle'
  import { appStore } from '../store/appStore'

  const { startUpdate } = appStore

  $: update = $appStore.update
  $: updateInFlight = $appStore.updateInFlight
  $: showError = update.status === 'error'
</script>

<div class="flex h-full w-full flex-col items-center justify-center px-6 text-slate-100">
  {#if showError}
    <AlertTriangle class="mb-6 h-12 w-12 text-red-400" />
  {:else}
    <Loader class="mb-6 h-12 w-12 animate-spin text-indigo-400" />
  {/if}

  <h1 class="mb-2 text-xl font-semibold">Atualizando Shindo Launcher</h1>
  <p class="mb-4 text-center text-sm text-slate-400">
    {#if showError}
      {update.errorMessage ?? 'Tente novamente em instantes.'}
    {:else}
      {update.message}
    {/if}
  </p>

  {#if !showError}
    <div class="w-64">
      <div class="h-2 rounded-full bg-slate-800">
        <div
          class="h-2 rounded-full bg-indigo-500 transition-all duration-200"
          style={`width: ${Math.min(100, Math.max(0, update.percent))}%`}
        />
      </div>
      <p class="mt-2 text-center text-xs text-slate-500">{Math.round(update.percent)}%</p>
    </div>
  {:else}
    <button
      type="button"
      class="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-900/40"
      on:click={() => startUpdate()}
      disabled={updateInFlight}
    >
      <RefreshCw class="mr-2 h-4 w-4" />
      {updateInFlight ? 'Reiniciando...' : 'Tentar novamente'}
    </button>
  {/if}
</div>
