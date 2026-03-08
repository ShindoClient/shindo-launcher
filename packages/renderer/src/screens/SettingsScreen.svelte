<script lang="ts">
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import Save from 'lucide-svelte/icons/save';
  import type { LauncherConfig } from '@shindo/shared';
  import ScrollArea from '../components/ScrollArea.svelte';
  import ToggleButton from '../components/ToggleButton.svelte';
  import { appStore } from '../store/appStore';
  import { availableLanguages, t } from '../i18n';
  import type { Language } from '../i18n';

  const { applyConfigPatch, setScreen } = appStore;

  $: config = $appStore.config;
  $: systemMemory = $appStore.systemMemory;

  let ramValue = config?.ramGB ?? 4;
  let jvmArgsDraft = config?.jvmArgs ?? '';
  let showLogsOnLaunch = config?.showLogsOnLaunch ?? true;
  let language: Language = config?.language ?? 'en';
  let javaVersion = config?.javaVersion ?? 8;
  let javaPackage: LauncherConfig['javaPackage'] = config?.javaPackage ?? 'jre';
  let savingJvmArgs = false;

  $: if (config) {
    ramValue = config.ramGB;
    showLogsOnLaunch = config.showLogsOnLaunch;
    language = (config.language as Language) ?? 'en';
    javaVersion = config.javaVersion ?? 8;
    javaPackage = config.javaPackage ?? 'jre';
    if (!savingJvmArgs) {
      jvmArgsDraft = config.jvmArgs ?? '';
    }
  }

  function handleRamInput(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    handleRamChange(value).catch(() => undefined);
  }

  async function handleRamChange(value: number) {
    ramValue = value;
    try {
      await applyConfigPatch({ ramGB: value });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleJreChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as LauncherConfig['jrePreference'];
    try {
      await applyConfigPatch({ jrePreference: value });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleJavaVersionChange(event: Event) {
    const value = Number(
      (event.target as HTMLSelectElement).value,
    ) as LauncherConfig['javaVersion'];
    javaVersion = value;
    try {
      await applyConfigPatch({ javaVersion: value });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleJavaPackageChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as LauncherConfig['javaPackage'];
    javaPackage = value;
    try {
      await applyConfigPatch({ javaPackage: value });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleLogWindowToggle(event: CustomEvent<boolean>) {
    const nextValue = event.detail;
    showLogsOnLaunch = nextValue;
    try {
      await applyConfigPatch({ showLogsOnLaunch: nextValue });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleJvmBlur() {
    if (savingJvmArgs) return;
    savingJvmArgs = true;
    try {
      await applyConfigPatch({ jvmArgs: jvmArgsDraft });
    } finally {
      savingJvmArgs = false;
    }
  }

  async function handleLanguageChange(event: Event) {
    const nextLanguage = (event.target as HTMLSelectElement).value as Language;
    language = nextLanguage;
    try {
      await applyConfigPatch({ language: nextLanguage });
    } catch (error) {
      console.error(error);
    }
  }
</script>

<style>
  :global(body) {
    background: #000;
    color: #fff;
  }
</style>

<div class="flex h-full min-h-0 w-full flex-col p-6 text-white">
  <!-- Header -->
  <div class="mb-8 flex items-center justify-between">
    <div class="flex items-center gap-4">
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium transition hover:bg-gray-800"
        on:click={() => setScreen('home')}
      >
        <ChevronLeft class="h-4 w-4" />
        Back
      </button>
      <h1 class="text-2xl font-bold">Settings</h1>
    </div>
    <div class="rounded-lg bg-gray-900/50 px-4 py-2 text-sm text-gray-400">
      Total Memory: <span class="font-bold text-white">{systemMemory?.totalGB || 8} GB</span>
    </div>
  </div>

  <ScrollArea className="flex-1 min-h-0">
    <div class="mx-auto max-w-4xl space-y-6">
      <!-- RAM Settings -->
      <div class="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h2 class="mb-4 text-lg font-semibold text-white">Memory Allocation</h2>
        <p class="mb-6 text-sm text-gray-400">Adjust how much RAM is allocated to Minecraft</p>

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
            class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-800 accent-blue-500"
            on:input={handleRamInput}
          />
          <div class="flex justify-between text-xs text-gray-500">
            <span>1 GB</span>
            <span>{systemMemory?.totalGB || 8} GB</span>
          </div>
        </div>
      </div>

      <!-- Java Runtime -->
      <div class="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h2 class="mb-4 text-lg font-semibold text-white">Java Runtime</h2>
        <p class="mb-6 text-sm text-gray-400">Choose which Java version to use</p>

        <select
          class="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={config?.jrePreference || 'system'}
          on:change={handleJreChange}
        >
          <option value="system">System JRE</option>
          <option value="zulu">Azul Zulu</option>
          <option value="temurin">Eclipse Temurin</option>
          <option value="liberica">BellSoft Liberica</option>
        </select>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div class="mb-2 text-xs uppercase tracking-[0.08em] text-gray-400">Java Version</div>
            <select
              class="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              value={javaVersion}
              on:change={handleJavaVersionChange}
              disabled={(config?.jrePreference || 'system') === 'system'}
            >
              <option value="8">Java 8</option>
              <option value="11">Java 11</option>
              <option value="17">Java 17</option>
              <option value="21">Java 21</option>
            </select>
          </div>

          <div>
            <div class="mb-2 text-xs uppercase tracking-[0.08em] text-gray-400">Package</div>
            <select
              class="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              value={javaPackage}
              on:change={handleJavaPackageChange}
              disabled={(config?.jrePreference || 'system') === 'system'}
            >
              <option value="jre">JRE</option>
              <option value="jdk">JDK</option>
              <option value="jdk-full">JDK Full</option>
            </select>
          </div>
        </div>

        {#if config?.jrePath}
          <div class="mt-4 rounded-lg bg-gray-800/30 p-3">
            <div class="mb-1 text-xs text-gray-400">Current Java Path</div>
            <div class="break-all font-mono text-sm text-gray-200">{config.jrePath}</div>
          </div>
        {/if}
      </div>

      <!-- JVM Arguments -->
      <div class="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-white">JVM Arguments</h2>
          {#if savingJvmArgs}
            <span class="inline-flex items-center text-sm text-green-400">
              <Save class="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </span>
          {/if}
        </div>
        <p class="mb-4 text-sm text-gray-400">Advanced Java Virtual Machine arguments</p>

        <textarea
          class="h-32 w-full resize-none rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 font-mono text-sm text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          bind:value={jvmArgsDraft}
          on:blur={() => handleJvmBlur()}
          placeholder="-Xmx4G -XX:+UseG1GC -XX:+UnlockExperimentalVMOptions"
        />

        <div class="mt-3 text-xs text-gray-500">
          Press Enter to save changes. Common arguments: -Xmx4G (max memory), -Xms2G (min memory),
          -XX:+UseG1GC (G1 garbage collector)
        </div>
      </div>

      <!-- Interface Settings -->
      <div class="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <h2 class="mb-4 text-lg font-semibold text-white">Interface</h2>
        <p class="mb-6 text-sm text-gray-400">Customize the launcher interface</p>

        <div class="space-y-4">
          <!-- Log Window Toggle -->
          <div
            class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/30 p-4"
          >
            <div>
              <div class="text-sm font-medium text-gray-200">Show Log Window on Launch</div>
              <p class="mt-1 text-xs text-gray-500">
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
          <div
            class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/30 p-4"
          >
            <div>
              <div class="text-sm font-medium text-gray-200">Language</div>
              <p class="mt-1 text-xs text-gray-500">Choose your preferred language</p>
            </div>
            <select
              class="w-48 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={language}
              on:change={handleLanguageChange}
            >
              {#each availableLanguages as option}
                <option value={option.code} selected={option.code === language}
                  >{option.label}</option
                >
              {/each}
            </select>
          </div>
        </div>
      </div>
    </div>
  </ScrollArea>
</div>
