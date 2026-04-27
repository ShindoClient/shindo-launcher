<script lang="ts">
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import Save from 'lucide-svelte/icons/save';
  import type { JavaValidationResult, LauncherConfig, ReleaseChannel } from '@shindo/shared';
  import ScrollArea from '../components/ScrollArea.svelte';
  import { appStore } from '../store/appStore';
  import { availableLanguages, t } from '../i18n';
  import { get } from 'svelte/store';
  import type { Language } from '../i18n';

  const { applyConfigPatch, setScreen } = appStore;

  $: config = $appStore.config;
  $: systemMemory = $appStore.systemMemory;

  let ramValue = config?.ramGB ?? 4;
  let jvmArgsDraft = config?.jvmArgs ?? '';
  let language: Language = config?.language ?? 'en';
  let releaseChannel: ReleaseChannel = config?.releaseChannel ?? 'stable';
  let savingJvmArgs = false;

  let customPathDraft = config?.javaCustomPath ?? '';
  let validationResult: JavaValidationResult | null = null;
  let validationError: string | null = null;
  let validating = false;
  let experimentalOpen = false;

  $: if (config) {
    ramValue = config.ramGB;
    language = (config.language as Language) ?? 'en';
    releaseChannel = (config.releaseChannel as ReleaseChannel) ?? 'stable';
    if (!savingJvmArgs) {
      jvmArgsDraft = config.jvmArgs ?? '';
    }
    if (!validating && !validationResult) {
      customPathDraft = config.javaCustomPath ?? '';
    }
  }

  const translate = (key: string, params?: Record<string, string | number>) => get(t)(key, params);

  $: javaPath = config?.javaPath ?? null;
  $: javaMajor = config?.javaRuntimeMajor ?? null;
  $: javaSource = config?.javaSource ?? 'auto';

  $: javaCardTitle =
    javaSource === 'custom' && javaPath
      ? translate('settings.javaCustomTitle')
      : translate('settings.javaAutoTitle');

  $: javaCardDetail =
    javaSource === 'custom' && javaPath
      ? translate('settings.javaCustomDetail', { path: javaPath })
      : javaPath
        ? translate('settings.javaAutoDetailReady', {
            version: javaMajor ?? '?',
            path: javaPath,
          })
        : translate('settings.javaAutoDetailPending');

  function parseMajor(versionText?: string | null): number | null {
    if (!versionText) return null;
    const match = versionText.match(/version\s+"?(\d+)(?:\.(\d+))?/i);
    if (!match) return null;
    const primary = Number(match[1]);
    const secondary = Number(match[2]);
    if (Number.isFinite(primary) && primary > 1) return primary;
    if (Number.isFinite(secondary)) return secondary;
    return null;
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

  async function handleReleaseChannelChange(event: Event) {
    const nextChannel = (event.target as HTMLSelectElement).value as ReleaseChannel;
    releaseChannel = nextChannel;
    try {
      await applyConfigPatch({ releaseChannel: nextChannel, selectedBuild: null });
    } catch (error) {
      console.error(error);
    }
  }

  function handleCustomPathInput(event: Event) {
    customPathDraft = (event.target as HTMLInputElement).value;
    validationResult = null;
    validationError = null;
  }

  async function handlePickJavaExecutable() {
    try {
      const selected = await window.shindo.chooseJavaExecutable({
        defaultPath: customPathDraft || config?.javaCustomPath || config?.javaPath || undefined,
      });
      if (selected) {
        customPathDraft = selected;
        validationResult = null;
        validationError = null;
      }
    } catch (error) {
      console.error('Failed to pick Java executable', error);
    }
  }

  async function handleValidateAndSave() {
    if (!customPathDraft.trim()) return;
    validating = true;
    validationError = null;
    try {
      const result = await window.shindo.validateJavaExecutable(customPathDraft.trim());
      validationResult = result;
      if (result.ok) {
        const major = parseMajor(result.versionText) ?? config?.javaRuntimeMajor ?? undefined;
        await applyConfigPatch({
          javaSource: 'custom',
          javaCustomPath: customPathDraft.trim(),
          javaPath: customPathDraft.trim(),
          javaRuntimeMajor: major as LauncherConfig['javaRuntimeMajor'],
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      validationError = message;
      validationResult = null;
    } finally {
      validating = false;
    }
  }

  async function handleUseAutoJava() {
    try {
      await applyConfigPatch({
        javaSource: 'auto',
        javaCustomPath: null,
        javaPath: null,
        javaRuntimeMajor: undefined,
      });
      customPathDraft = '';
      validationResult = null;
      validationError = null;
    } catch (error) {
      console.error('Failed to reset Java', error);
    }
  }
</script>

<style lang="scss">
  @use '../styles/variables' as v;
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
            <h2 class="text-2xl font-semibold text-white">{javaCardTitle}</h2>
            <p class="text-sm text-gray-400 mt-2">{javaCardDetail}</p>
            {#if javaPath}
              <p class="text-xs text-gray-500 mt-1">{$t('settings.javaPathLabel')}: {javaPath}</p>
            {:else}
              <p class="text-xs text-gray-500 mt-1">{$t('settings.javaAutoPendingHint')}</p>
            {/if}
          </div>
        </div>
        <div class="mt-6">
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-gray-200 transition hover:border-slate-700"
            on:click={() => (experimentalOpen = !experimentalOpen)}
          >
            <span>{$t('settings.javaExperimentalTitle')}</span>
            <span class="text-xs text-gray-400">{experimentalOpen ? '−' : '+'}</span>
          </button>

          {#if experimentalOpen}
            <div class="mt-4 space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div class="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  class="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  bind:value={customPathDraft}
                  on:input={handleCustomPathInput}
                  placeholder={$t('settings.javaCustomPlaceholder')}
                />
                <button
                  type="button"
                  class="rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-blue-400"
                  on:click={handlePickJavaExecutable}
                >
                  {$t('settings.runtimeActionLocate')}
                </button>
              </div>

              <div class="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-lg border border-transparent bg-blue-500 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-blue-400 disabled:opacity-60"
                  on:click={handleValidateAndSave}
                  disabled={!customPathDraft.trim() || validating}
                >
                  {validating ? $t('settings.jvmSaving') : $t('settings.javaValidate')}
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-200 transition hover:border-slate-500 disabled:opacity-60"
                  on:click={handleUseAutoJava}
                  disabled={config?.javaSource === 'auto' && !config?.javaCustomPath}
                >
                  {$t('settings.javaUseAuto')}
                </button>
                <span class="text-[11px] text-gray-500">{$t('settings.javaExperimentalHint')}</span>
              </div>

              {#if validationResult}
                <div
                  class={`rounded-lg border p-4 ${validationResult.ok ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-100' : 'border-amber-500/40 bg-amber-500/5 text-amber-100'}`}
                >
                  <p class="font-semibold">
                    {validationResult.ok
                      ? $t('settings.javaValidationOk')
                      : $t('settings.javaValidationFail')}
                  </p>
                  {#if validationResult.versionText}
                    <pre class="mt-2 whitespace-pre-wrap text-xs text-gray-200">{validationResult.versionText}</pre>
                  {/if}
                  {#if validationResult.error}
                    <p class="mt-1 text-xs text-red-200">{validationResult.error}</p>
                  {/if}
                </div>
              {/if}

              {#if validationError}
                <p class="text-xs text-red-300">{validationError}</p>
              {/if}
            </div>
          {/if}
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
        <div class="mb-5">
          <p class="text-xs uppercase tracking-[0.3em] text-gray-400">Release Channel</p>
          <h2 class="text-2xl font-semibold text-white">Update stream</h2>
          <p class="text-sm text-gray-400 mt-2">Controls which build channel the launcher tracks by default.</p>
        </div>
        <select
          class="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
          value={releaseChannel}
          on:change={handleReleaseChannelChange}
        >
          <option value="stable">Stable</option>
          <option value="snapshot">Snapshot</option>
          <option value="dev">Dev</option>
        </select>
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
