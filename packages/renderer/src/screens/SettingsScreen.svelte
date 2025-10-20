<script lang="ts">
  import ChevronLeft from 'lucide-svelte/icons/chevron-left'
  import Save from 'lucide-svelte/icons/save'
  import type { LauncherConfig } from '@shindo/shared'
  import ScrollArea from '../components/ScrollArea.svelte'
  import ToggleButton from '../components/ToggleButton.svelte'
  import { appStore } from '../store/appStore'

  const { applyConfigPatch, setScreen } = appStore

  $: config = $appStore.config
  $: systemMemory = $appStore.systemMemory

  let ramValue = config?.ramGB ?? 4
  let jvmArgsDraft = config?.jvmArgs ?? ''
  let showLogsOnLaunch = config?.showLogsOnLaunch ?? true
  let savingJvmArgs = false

  $: if (config) {
    ramValue = config.ramGB
    showLogsOnLaunch = config.showLogsOnLaunch
    if (!savingJvmArgs) {
      jvmArgsDraft = config.jvmArgs ?? ''
    }
  }

  function handleRamInput(event: Event) {
    const value = Number((event.target as HTMLInputElement).value)
    handleRamChange(value).catch(() => undefined)
  }

  async function handleRamChange(value: number) {
    ramValue = value
    try {
      await applyConfigPatch({ ramGB: value })
    } catch (error) {
      console.error(error)
    }
  }

  async function handleJreChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as LauncherConfig['jrePreference']
    try {
      await applyConfigPatch({ jrePreference: value })
    } catch (error) {
      console.error(error)
    }
  }

  async function handleLogWindowToggle(event: CustomEvent<boolean>) {
    const nextValue = event.detail
    showLogsOnLaunch = nextValue
    try {
      await applyConfigPatch({ showLogsOnLaunch: nextValue })
    } catch (error) {
      console.error(error)
    }
  }

  async function handleJvmBlur() {
    if (savingJvmArgs) return
    savingJvmArgs = true
    try {
      await applyConfigPatch({ jvmArgs: jvmArgsDraft })
    } finally {
      savingJvmArgs = false
    }
  }
</script>

{#if !config || !systemMemory}
  <div class="flex h-full w-full items-center justify-center text-slate-100">
    <p class="text-sm text-slate-400">Carregando configuracoes...</p>
  </div>
{:else}
  <div class="flex w-full h-full min-h-0 flex-col px-4 py-2 text-slate-100">
    <header class="mb-4 flex items-center justify-between gap-2">
      <button
        type="button"
        class="inline-flex items-center rounded-md bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700"
        on:click={() => setScreen('home')}
      >
        <ChevronLeft class="mr-2 h-4 w-4" />
        Voltar
      </button>
      <h1 class="text-lg font-semibold text-slate-200">Configuracoes</h1>
      <span class="text-xs text-slate-500">Memoria total: {systemMemory.totalGB} GB</span>
    </header>

    <ScrollArea className="flex-1 min-h-0 px-5">
      <section class="mx-auto grid w-full max-w-3xl grid-cols-1 gap-5 px-2 md:grid-cols-2 md:px-4">
        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 class="text-base font-semibold text-slate-200">Alocacao de RAM</h2>
          <p class="mt-1 text-sm text-slate-400">Defina quanta RAM o Minecraft podera utilizar.</p>
          <div class="mt-6 flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={systemMemory.totalGB}
              step={1}
              value={ramValue}
              class="flex-1 accent-indigo-500"
              on:input={handleRamInput}
            />
            <span class="w-16 text-right text-sm font-semibold text-indigo-400">{ramValue} GB</span>
          </div>
        </div>

        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 class="text-base font-semibold text-slate-200">Runtime Java</h2>
          <p class="mt-1 text-sm text-slate-400">Escolha qual distribuicao de JRE utilizar ao iniciar o jogo.</p>
          <select
            class="mt-6 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            value={config.jrePreference}
            on:change={handleJreChange}
          >
            <option value="system">JRE do Sistema</option>
            <option value="zulu">Azul Zulu</option>
            <option value="temurin">Eclipse Temurin</option>
          </select>
          {#if config.jrePath}
            <p class="mt-3 break-all text-xs text-slate-500">Runtime atual: {config.jrePath}</p>
          {/if}
        </div>

        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
          <div class="mb-2 flex items-center justify-between">
            <h2 class="text-base font-semibold text-slate-200">Argumentos JVM</h2>
            {#if savingJvmArgs}
              <span class="inline-flex items-center text-xs text-slate-400">
                <Save class="mr-1 h-3 w-3" />
                Salvando...
              </span>
            {/if}
          </div>
          <p class="text-sm text-slate-400">Argumentos adicionais aplicados ao iniciar o Java.</p>
          <textarea
            class="mt-4 h-32 w-full resize-none rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            bind:value={jvmArgsDraft}
            on:blur={() => handleJvmBlur()}
            placeholder="Ex: -Xmx4G -XX:+UseG1GC"
          />
        </div>

        <div class="rounded-xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
          <h2 class="text-base font-semibold text-slate-200">Interface do Launcher</h2>
          <p class="mt-1 text-sm text-slate-400">
            Ajuste como as janelas complementares do launcher se comportam.
          </p>
          <div class="mt-5 flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
            <div class="max-w-[70%]">
              <span class="text-sm font-medium text-slate-200">Mostrar janela de logs automaticamente</span>
              <p class="mt-1 text-xs text-slate-500">
                Exibe a janela de logs do cliente assim que o jogo for iniciado.
              </p>
            </div>
            <ToggleButton
              checked={showLogsOnLaunch}
              label="Alternar exibicao automatica da janela de logs"
              on:change={handleLogWindowToggle}
            />
          </div>
        </div>
      </section>
    </ScrollArea>
  </div>
{/if}
