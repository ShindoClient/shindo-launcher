<script lang="ts">
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import Save from 'lucide-svelte/icons/save';
  import type { LauncherConfig } from '@shindo/shared';
  import ScrollArea from '../components/ScrollArea.svelte';
  import { appStore } from '../store/appStore';
  import { availableLanguages, t } from '../i18n';
  import { get } from 'svelte/store';
  import type { Language } from '../i18n';

  type JavaStatusTone = 'info' | 'warning';
  type JavaStatusInfo = {
    title: string;
    detail: string;
    tone: JavaStatusTone;
  };

  const supportedVersions = ['8', '11', '17', '21'];

  const { applyConfigPatch, setScreen } = appStore;

  $: config = $appStore.config;
  $: systemMemory = $appStore.systemMemory;

  let ramValue = config?.ramGB ?? 4;
  let jvmArgsDraft = config?.jvmArgs ?? '';
  let language: Language = config?.language ?? 'en';
  let jrePreference: LauncherConfig['jrePreference'] = config?.jrePreference ?? 'system';
  let javaVersion = config?.javaVersion ?? 8;
  let javaPackage: LauncherConfig['javaPackage'] = config?.javaPackage ?? 'jre';
  let savingJvmArgs = false;
  let javaPathDraft = config?.jrePath ?? '';
  let manualPathDirty = false;
  let savingJavaPath = false;

  $: if (config) {
    ramValue = config.ramGB;
    language = (config.language as Language) ?? 'en';
    jrePreference = config.jrePreference ?? 'system';
    javaVersion = config.javaVersion ?? 8;
    javaPackage = config.javaPackage ?? 'jre';
    if (!savingJvmArgs) {
      jvmArgsDraft = config.jvmArgs ?? '';
    }
    if (!manualPathDirty) {
      javaPathDraft = config.jrePath ?? '';
    }
  }

  const translate = (key: string, params?: Record<string, string | number>) => {
    return get(t)(key, params);
  };

  function buildJavaStatus(conf: LauncherConfig | null): JavaStatusInfo {
    if (!conf) {
      return {
        title: translate('settings.runtimeCurrent'),
        detail: translate('settings.loading'),
        tone: 'info',
      };
    }
    if (conf.jrePreference !== 'system' && !conf.jrePath) {
      return {
        title: `${conf.jrePreference.toUpperCase()} · Java ${conf.javaVersion}`,
        detail: translate('settings.runtimeStatusPreparing'),
        tone: 'warning',
      };
    }
    if (!conf.jrePath) {
      return {
        title: translate('settings.runtimeCurrent'),
        detail: translate('settings.runtimeStatusSystem'),
        tone: 'warning',
      };
    }
    return {
      title: `${translate('settings.runtimeCurrent')} · Java ${conf.javaVersion}`,
      detail: translate('settings.runtimeStatusReady', { path: conf.jrePath }),
      tone: 'info',
    };
  }

  $: packageListText =
    jrePreference === 'system'
      ? translate('settings.runtimeAvailabilitySystemPackage')
      : translate('settings.runtimeAvailabilityPackages', { list: 'JRE, JDK, JDK Full (when available)' });

  $: availabilityNote =
    jrePreference === 'system'
      ? translate('settings.runtimeAvailabilitySystemNote')
      : translate('settings.runtimeAvailabilityNote', { provider: jrePreference });

  $: javaStatus = buildJavaStatus(config);

  const statusToneClasses: Record<JavaStatusTone, string> = {
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-100',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  } as const;

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
    jrePreference = value;
    try {
      await applyConfigPatch({ jrePreference: value });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleJavaVersionChange(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value) as LauncherConfig['javaVersion'];
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

  function handleJavaPathInput(event: Event) {
    javaPathDraft = (event.target as HTMLInputElement).value;
    manualPathDirty = true;
  }

  async function handlePickJavaExecutable() {
    try {
      const selected = await window.shindo.chooseJavaExecutable({
        defaultPath: javaPathDraft || config?.jrePath,
      });
      if (selected) {
        javaPathDraft = selected;
        manualPathDirty = true;
      }
    } catch (error) {
      console.error('Failed to pick Java executable', error);
    }
  }

  async function handleJavaPathSave() {
    if (!javaPathDraft.trim()) return;
    savingJavaPath = true;
    try {
      await applyConfigPatch({ jrePath: javaPathDraft.trim() });
      manualPathDirty = false;
    } catch (error) {
      console.error('Failed to save Java path', error);
    } finally {
      savingJavaPath = false;
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
  <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium transition hover:bg-gray-800"
        on:click={() => setScreen('home')}
      >
        <ChevronLeft class="h-4 w-4" />
        <span>{$t('settings.back')}</span>
      </button>
      <h1 class="text-2xl font-bold">{$t('settings.title')}</h1>
    </div>
    <div class="rounded-lg bg-slate-900/70 px-4 py-2 text-sm text-gray-300">
      {$t('settings.totalMemory')}: <span class="font-bold text-white">{systemMemory?.totalGB || 8} GB</span>
    </div>
  </div>

  <ScrollArea className="flex-1 min-h-0">
    <div class="mx-auto max-w-4xl space-y-6">
      <section class="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.8)]">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-gray-400">{$t('settings.ramTitle')}</p>
            <h2 class="text-2xl font-semibold text-white">{$t('settings.ramDescription')}</h2>
          </div>
          <span class="text-xl font-bold text-blue-400">{ramValue} GB</span>
        </div>
        <div class="mt-4 space-y-4">
          <input
            type="range"
            min="1"
            max={systemMemory?.totalGB || 8}
            step="1"
            value={ramValue}
            class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-blue-500"
            on:input={handleRamInput}
          />
          <div class="flex justify-between text-xs text-gray-500">
            <span>1 GB</span>
            <span>{systemMemory?.totalGB || 8} GB</span>
          </div>
        </div>
      </section>

      <section class="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.7)]">
        <div class="mb-3 flex items-start justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-gray-400">{$t('settings.runtimeTitle')}</p>
            <h2 class="text-2xl font-semibold text-white">{javaStatus.title}</h2>
          </div>
          <span class={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] ${statusToneClasses[javaStatus.tone]}`}>
            {javaStatus.tone === 'warning' ? 'Aviso' : 'OK'}
          </span>
        </div>
        <p class="text-sm text-gray-400 mb-6">{javaStatus.detail}</p>
        <div class="space-y-4">
          <div>
            <label
              class="text-xs uppercase tracking-[0.3em] text-gray-400"
              for="runtime-select"
            >{$t('settings.runtimeDescription')}</label>
            <select
              class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500"
              id="runtime-select"
              value={jrePreference}
                on:change={handleJreChange}
              >
              <option value="system">{$t('settings.runtimeSystem')}</option>
              <option value="zulu">{$t('settings.runtimeZulu')}</option>
              <option value="temurin">{$t('settings.runtimeTemurin')}</option>
            </select>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs uppercase tracking-[0.3em] text-gray-400" for="java-version-select">
                Java Version
              </label>
              <select
                id="java-version-select"
                class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                value={javaVersion}
                on:change={handleJavaVersionChange}
                disabled={jrePreference === 'system'}
              >
                <option value="8">Java 8</option>
                <option value="11">Java 11</option>
                <option value="17">Java 17</option>
                <option value="21">Java 21</option>
              </select>
            </div>
            <div>
              <label class="text-xs uppercase tracking-[0.3em] text-gray-400" for="java-package-select">
                Package
              </label>
              <select
                id="java-package-select"
                class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                value={javaPackage}
                on:change={handleJavaPackageChange}
                disabled={jrePreference === 'system'}
              >
                <option value="jre">JRE</option>
                <option value="jdk">JDK</option>
                <option value="jdk-full">JDK Full</option>
              </select>
            </div>
          </div>

          <div class="rounded-lg border border-slate-800 bg-slate-950/50 p-4 space-y-2 text-sm">
            <p class="text-xs uppercase tracking-[0.3em] text-gray-400">{$t('settings.runtimeAvailabilityTitle')}</p>
            <p class="text-sm text-gray-200">{availabilityNote}</p>
            <p class="text-xs text-gray-400">
              {$t('settings.runtimeAvailabilityVersions', { list: supportedVersions.join(', ') })}
            </p>
            <p class="text-xs text-gray-400">{packageListText}</p>
          </div>

          <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                class="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
                value={javaPathDraft}
                on:input={handleJavaPathInput}
                placeholder={$t('settings.runtimePathManual')}
              />
              <button
                type="button"
                class="rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-blue-400"
                on:click={handlePickJavaExecutable}
              >
                {$t('settings.runtimeActionLocate')}
              </button>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-transparent bg-blue-500 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-blue-400 disabled:opacity-60"
                on:click={handleJavaPathSave}
                disabled={!javaPathDraft.trim() || savingJavaPath}
              >
                {savingJavaPath ? $t('settings.jvmSaving') : $t('settings.runtimeActionSave')}
              </button>
              <span>{config?.jrePath ? $t('settings.runtimePathAuto') : $t('settings.runtimePathManual')}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.65)]">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-2xl font-semibold text-white">{$t('settings.jvmArgsTitle')}</h2>
          {#if savingJvmArgs}
            <span class="inline-flex items-center gap-2 text-sm text-emerald-400">
              <Save class="h-4 w-4 animate-spin" />
              {$t('settings.jvmSaving')}
            </span>
          {/if}
        </div>
        <p class="text-sm text-gray-400 mb-4">{$t('settings.jvmArgsDescription')}</p>
        <textarea
          class="h-32 w-full resize-none rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 font-mono text-sm text-white outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
          bind:value={jvmArgsDraft}
          on:blur={() => handleJvmBlur()}
          placeholder="-Xmx4G -XX:+UseG1GC"
        />
        <div class="mt-3 text-xs text-gray-500">{$t('settings.jvmArgsTip')}</div>
      </section>

      <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.65)]">
        <div class="flex flex-col gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-gray-400">{$t('settings.interfaceTitle')}</p>
            <h2 class="text-2xl font-semibold text-white">{$t('settings.interfaceDescription')}</h2>
          </div>
          <p class="text-sm text-gray-400">{$t('settings.logsDisabled')}</p>
        </div>
        <div class="mt-5">
          <label class="text-sm font-semibold text-white" for="language-select">
            {$t('settings.languageLabel')}
          </label>
          <p class="text-xs text-gray-400 mb-3">{$t('settings.languageDescription')}</p>
          <select
            class="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
            id="language-select"
            value={language}
            on:change={handleLanguageChange}
          >
            {#each availableLanguages as option}
              <option value={option.code}>{option.flag} {option.label}</option>
            {/each}
          </select>
        </div>
      </section>
    </div>
  </ScrollArea>
</div>
