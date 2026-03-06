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
  <div class="max-w-md w-full">
    <div class="text-center mb-8">
      {#if showError}
        <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 mb-6">
          <AlertTriangle class="h-10 w-10 text-red-400" />
        </div>
      {:else}
        <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/10 mb-6">
          <Loader class="h-10 w-10 animate-spin text-indigo-400" />
        </div>
      {/if}

      <h1 class="text-2xl font-bold text-white mb-3">Updating Shindo Launcher</h1>
      <p class="text-slate-400 mb-6">
        {#if showError}
          {update.errorMessage ?? 'Please try again in a moment.'}
        {:else}
          {update.message}
        {/if}
      </p>
    </div>

    {#if !showError}
      <div class="space-y-4">
        <div>
          <div class="flex justify-between text-sm text-slate-400 mb-2">
            <span>Progress</span>
            <span class="font-semibold text-white">{Math.round(update.percent)}%</span>
          </div>
          <div class="h-3 rounded-full bg-slate-800 overflow-hidden">
            <div
              class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300 ease-out"
              style={`width: ${Math.min(100, Math.max(0, update.percent))}%`}
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="bg-slate-800/30 rounded-lg p-3">
            <div class="text-xs text-slate-400">Current Step</div>
            <div class="text-sm font-semibold text-white">{update.step || '--'}</div>
          </div>
          <div class="bg-slate-800/30 rounded-lg p-3">
            <div class="text-xs text-slate-400">Phases</div>
            <div class="text-sm font-semibold text-white">{update.phaseIndex} / {update.phaseTotal}</div>
          </div>
        </div>
      </div>
    {:else}
      <div class="text-center">
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-900/40 transition"
          on:click={() => startUpdate()}
          disabled={updateInFlight}
        >
          <RefreshCw class={`h-4 w-4 ${updateInFlight ? 'animate-spin' : ''}`} />
          {updateInFlight ? 'Restarting...' : 'Try Again'}
        </button>
        <p class="mt-4 text-xs text-slate-500">
          If the problem persists, check your internet connection and try again.
        </p>
      </div>
    {/if}
  </div>
</div>
