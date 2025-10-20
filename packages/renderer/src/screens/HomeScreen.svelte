<script lang="ts">
  import { onMount } from 'svelte'
  import Play from 'lucide-svelte/icons/play'
  import AlertCircle from 'lucide-svelte/icons/alert-circle'
  import ChevronUp from 'lucide-svelte/icons/chevron-up'
  import { appStore } from '../store/appStore'
  import { resolveVersionPresentation } from '../config/versionCatalog'

  const { launch, applyConfigPatch } = appStore

  $: state = $appStore
  $: config = state.config
  $: clientState = state.clientState
  $: launching = state.launching
  $: launcherStatus = state.launcherStatus
  $: update = state.update
  $: updateStatus = update.status
  $: updateMessage = update.message
  $: updatePercent = update.percent
  $: updatePercentValue = Math.min(100, Math.max(0, updatePercent))
  $: updatePercentDisplay = `${Math.round(updatePercentValue)}%`
  $: phaseIndex = update.phaseIndex
  $: phaseTotal = update.phaseTotal
  $: phaseValue = phaseTotal > 0 ? Math.min(phaseIndex, phaseTotal) : 0
  $: phaseIndicator = phaseTotal > 0 ? `${phaseValue} / ${phaseTotal}` : '--'
  $: versionPresentation = resolveVersionPresentation(clientState)

  $: versionOptions = clientState
    ? [{ id: clientState.versionId, label: versionPresentation.optionLabel }]
    : []
  $: selectedVersionId = config?.versionId ?? clientState?.versionId ?? ''
  $: selectedVersionLabel =
    versionOptions.find((option) => option.id === selectedVersionId)?.label ?? 'Selecione uma versao'

  $: playDisabled = launching || updateStatus !== 'completed'

  let versionMenuOpen = false
  let dropdownRef: HTMLDivElement | null = null

  onMount(() => {
    const handleClick = (event: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
        versionMenuOpen = false
      }
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  })

  function toggleVersionMenu(event: MouseEvent) {
    event.stopPropagation()
    versionMenuOpen = !versionMenuOpen
  }

  async function selectVersion(optionId: string) {
    versionMenuOpen = false
    if (optionId !== selectedVersionId) {
      await applyConfigPatch({ versionId: optionId })
    }
  }

  function handlePlay() {
    launch().catch(() => undefined)
  }
</script>

<div class="flex h-full w-full">
  <div class="flex w-full flex-col gap-5 px-6 py-5">
    {#if updateStatus !== 'completed'}
      <div class="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
        <AlertCircle class="h-4 w-4 shrink-0" />
        <span>{updateMessage}</span>
      </div>
    {/if}

    <div class="flex flex-col gap-4">


      <div
        class="relative flex min-h-[14.5rem] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-lg"
        style={`background-image: ${versionPresentation.backgroundImage}; background-size: cover; background-position: center;`}
      >
        <div class="absolute inset-0 bg-slate-950/65" />
        <div class="relative z-10 flex w-full flex-col justify-center px-8 py-5">
          <span class="text-[11px] uppercase tracking-[0.35em] text-slate-300/90">Destacado</span>
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <h2 class="text-3xl font-bold text-slate-50">{versionPresentation.name}</h2>
            <span
              class="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]"
              style={`border-color: ${versionPresentation.accent}; color: ${versionPresentation.accent};`}
            >
              Minecraft {versionPresentation.baseVersion}
            </span>
          </div>
          <p class="mt-3 text-sm text-slate-200/90">{versionPresentation.headline}</p>
          {#if versionPresentation.description}
            <p class="mt-3 max-w-xl text-sm text-slate-300/90">{versionPresentation.description}</p>
          {/if}
          <p class="mt-4 text-xs uppercase tracking-[0.3em] text-slate-400">
            Build {versionPresentation.buildLabel}
          </p>
        </div>
      </div>

      <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div class="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
          <span>Atualizacao</span>
          <span class="text-slate-200">{updateMessage}</span>
        </div>
        <div
          class="relative mt-3 h-[10px] overflow-hidden rounded-full border border-slate-800/70 bg-slate-900/80"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(updatePercentValue)}
        >
          <div
            class="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-200 ease-out"
            style={`width: ${updatePercentValue}%`}
          />
        </div>
        <div class="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>Fases: <strong class="font-semibold text-slate-200">{phaseIndicator}</strong></span>
          <span class="font-semibold text-emerald-300">{updatePercentDisplay}</span>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="group inline-flex min-w-[200px] items-center gap-4 rounded-xl border border-emerald-400/40 bg-emerald-500/90 px-7 py-3.5 text-left font-semibold text-emerald-950 shadow-md shadow-emerald-900/40 transition hover:-translate-y-[1px] hover:shadow-emerald-900/60 disabled:cursor-not-allowed disabled:border-emerald-500/10 disabled:bg-emerald-900/50 disabled:text-emerald-200"
          on:click={handlePlay}
          disabled={playDisabled}
        >
          <Play class="h-6 w-6" />
          <div class="flex min-w-[160px] flex-col">
            <span class="text-lg leading-tight">{launching ? 'Iniciando...' : 'Jogar'}</span>
            <span class="mt-1 max-w-[240px] truncate text-xs font-medium text-emerald-950/80 group-disabled:text-emerald-200/80">
              {launcherStatus}
            </span>
          </div>
        </button>

        <div class="relative w-60" bind:this={dropdownRef}>
          <button
            type="button"
            class="group inline-flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-4 text-sm font-medium text-slate-100 hover:border-indigo-500 focus:outline-none focus-visible:border-indigo-500"
            on:click={toggleVersionMenu}
          >
            <span class="truncate">{selectedVersionLabel}</span>
            <ChevronUp class={`h-4 w-4 transition-transform ${versionMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {#if versionOptions.length > 0 && versionMenuOpen}
            <div class="absolute bottom-full z-20 mb-2 w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-xl">
              {#each versionOptions as option}
                <button
                  type="button"
                  class="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-900/80"
                  on:click={() => selectVersion(option.id)}
                >
                  <span class="truncate">{option.label}</span>
                  {#if option.id === selectedVersionId}
                    <span class="text-xs font-semibold text-indigo-400">Ativo</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
