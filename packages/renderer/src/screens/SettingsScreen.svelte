<script lang="ts">
  import ChevronLeft from 'lucide-svelte/icons/chevron-left'
  import Save from 'lucide-svelte/icons/save'
  import type { LauncherConfig } from '@shindo/shared'
  import ScrollArea from '../components/ScrollArea.svelte'
  import ToggleButton from '../components/ToggleButton.svelte'
  import { appStore } from '../store/appStore'
  import { availableLanguages, t } from '../i18n'
  import type { Language } from '../i18n'

  const { applyConfigPatch, setScreen } = appStore

  $: config = $appStore.config
  $: systemMemory = $appStore.systemMemory

  let ramValue = config?.ramGB ?? 4
  let jvmArgsDraft = config?.jvmArgs ?? ''
  let showLogsOnLaunch = config?.showLogsOnLaunch ?? true
  let language: Language = config?.language ?? 'en'
  let savingJvmArgs = false

  $: if (config) {
    ramValue = config.ramGB
    showLogsOnLaunch = config.showLogsOnLaunch
    language = (config.language as Language) ?? 'en'
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

  async function handleLanguageChange(event: Event) {
    const nextLanguage = (event.target as HTMLSelectElement).value as Language
    language = nextLanguage
    try {
      await applyConfigPatch({ language: nextLanguage })
    } catch (error) {
      console.error(error)
    }
  }
</script>

<div class="flex w-full h-full min-h-0 flex-col p-6 text-white">
  <!-- Header -->
  <div class="flex items-center justify-between mb-8">
    <div class="flex items-center gap-4">
      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 rounded-lg text-sm font-medium transition"
        on:click={() => setScreen('home')}
      >
        <ChevronLeft class="h-4 w-4" />
        Back
      </button>
      <h1 class="text-2xl font-bold">Settings</h1>
    </div>
    <div class="text-sm text-gray-400 bg-gray-900/50 px-4 py-2 rounded-lg">
      Total Memory: <span class="font-bold text-white">{systemMemory?.totalGB || 8} GB</span>
    </div>
  </div>

  <ScrollArea className="flex-1 min-h-0">
    <div class="max-w-4xl mx-auto space-y-6">
      <!-- RAM Settings -->
      <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 class="text-lg font-semibold text-white mb-4">Memory Allocation</h2>
        <p class="text-sm text-gray-400 mb-6">Adjust how much RAM is allocated to Minecraft</p>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-300">Allocated RAM</span>
            <span class="text-xl font-bold text-blue-400">{ramValue} GB</span>
          </div>
          <input
            type="range"
            min="1"
            max={systemMemory?.totalGB || 8}
            step="1"
            value={ramValue}
            class="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            on:input={handleRamInput}
          />
          <div class="flex justify-between text-xs text-gray-500">
            <span>1 GB</span>
            <span>{systemMemory?.totalGB || 8} GB</span>
          </div>
        </div>
      </div>

      <!-- Java Runtime -->
      <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 class="text-lg font-semibold text-white mb-4">Java Runtime</h2>
        <p class="text-sm text-gray-400 mb-6">Choose which Java version to use</p>
        
        <select
          class="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={config?.jrePreference || 'system'}
          on:change={handleJreChange}
        >
          <option value="system">System JRE</option>
          <option value="zulu">Azul Zulu</option>
          <option value="temurin">Eclipse Temurin</option>
        </select>
        
        {#if config?.jrePath}
          <div class="mt-4 p-3 bg-gray-800/30 rounded-lg">
            <div class="text-xs text-gray-400 mb-1">Current Java Path</div>
            <div class="text-sm text-gray-200 font-mono break-all">{config.jrePath}</div>
          </div>
        {/if}
      </div>

      <!-- JVM Arguments -->
      <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-white">JVM Arguments</h2>
          {#if savingJvmArgs}
            <span class="inline-flex items-center text-sm text-green-400">
              <Save class="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </span>
          {/if}
        </div>
        <p class="text-sm text-gray-400 mb-4">Advanced Java Virtual Machine arguments</p>
        
        <textarea
          class="w-full h-32 resize-none px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          bind:value={jvmArgsDraft}
          on:blur={() => handleJvmBlur()}
          placeholder="-Xmx4G -XX:+UseG1GC -XX:+UnlockExperimentalVMOptions"
        />
        
        <div class="mt-3 text-xs text-gray-500">
          Press Enter to save changes. Common arguments: -Xmx4G (max memory), -Xms2G (min memory), -XX:+UseG1GC (G1 garbage collector)
        </div>
      </div>

      <!-- Interface Settings -->
      <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h2 class="text-lg font-semibold text-white mb-4">Interface</h2>
        <p class="text-sm text-gray-400 mb-6">Customize the launcher interface</p>
        
        <div class="space-y-4">
          <!-- Log Window Toggle -->
          <div class="flex items-center justify-between p-4 rounded-lg border border-gray-800 bg-gray-900/30">
            <div>
              <div class="text-sm font-medium text-gray-200">Show Log Window on Launch</div>
              <p class="text-xs text-gray-500 mt-1">
                Automatically open the log window when launching the game
              </p>
            </div>
            <ToggleButton
              checked={showLogsOnLaunch}
              label="Show Logs"
              on:change={handleLogWindowToggle}
            />
          </div>

          <!-- Language Selector -->
          <div class="flex items-center justify-between p-4 rounded-lg border border-gray-800 bg-gray-900/30">
            <div>
              <div class="text-sm font-medium text-gray-200">Language</div>
              <p class="text-xs text-gray-500 mt-1">
                Choose your preferred language
              </p>
            </div>
            <select
              class="w-48 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={language}
              on:change={handleLanguageChange}
            >
              {#each availableLanguages as option}
                <option value={option.code} selected={option.code === language}>{option.label}</option>
              {/each}
            </select>
          </div>
        </div>
      </div>
    </div>
  </ScrollArea>
</div>

<style>
  :global(body) {
    background: #000;
    color: #fff;
  }
</style>