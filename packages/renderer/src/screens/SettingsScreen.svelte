<script lang="ts">
  import { appStore } from '$lib/stores/app.svelte';
  import { configStore } from '$lib/stores/config.svelte';
  import { t, availableLocales } from '$lib/i18n';
  import type { JavaValidationResult } from '@shindo/shared';
  import { ArrowLeft } from '@lucide/svelte';

  let javaValidation = $state<JavaValidationResult | null>(null);
  let validating = $state(false);
  let savedFlash = $state(false);
  let flashTimer = 0;

  const totalMemory = $derived(appStore.memory?.totalGB ?? 0);
  const maxRam = $derived(Math.max(1, totalMemory - 1));
  const ramGB = $derived(configStore.ramGB);

  async function patch(update: Parameters<typeof configStore.patch>[0]) {
    await configStore.patch(update);
    clearTimeout(flashTimer);
    savedFlash = true;
    flashTimer = setTimeout(() => {
      savedFlash = false;
    }, 1800) as unknown as number;
  }

  async function browseJava() {
    const picked = await window.shindo.chooseJavaExecutable();
    if (picked) {
      await patch({ javaSource: 'custom', javaCustomPath: picked });
      javaValidation = null;
    }
  }

  async function validateJava() {
    const path = configStore.data?.javaCustomPath;
    if (!path) return;
    validating = true;
    javaValidation = null;
    try {
      javaValidation = await window.shindo.validateJavaExecutable(path);
    } finally {
      validating = false;
    }
  }

  function back() {
    appStore.navigate('home');
  }
</script>

<div class="settings-screen">
  <div class="settings-header">
    <button class="back-btn" onclick={back}>
      <ArrowLeft size={16} />
      {t('settings.back')}
    </button>
    <h1 class="settings-title">{t('settings.title')}</h1>
    {#if savedFlash}
      <span class="saved-flash">{t('settings.save')} ✓</span>
    {/if}
  </div>

  {#if configStore.data}
    <div class="settings-body">
      <!-- ── Memory ─────────────────────────────────────────────────────── -->
      <section class="settings-section">
        <h2 class="section-title">{t('settings.section.memory')}</h2>

        <div class="field-row">
          <label class="field-label" for="ram-slider">
            {t('settings.ram.label')}
            <span class="field-label-hint">{t('settings.ram.system', { total: totalMemory })}</span>
          </label>
          <div class="ram-control">
            <input
              id="ram-slider"
              type="range"
              min={1}
              max={maxRam}
              step={1}
              value={ramGB}
              oninput={(e) => patch({ ramGB: Number(e.target.value) })}
              class="slider"
            />
            <span class="ram-value">{ramGB} {t('settings.ram.unit')}</span>
          </div>
        </div>
      </section>

      <!-- ── Java ──────────────────────────────────────────────────────── -->
      <section class="settings-section">
        <h2 class="section-title">{t('settings.section.java')}</h2>

        <div class="field-row">
          <label class="field-label">{t('settings.java.source')}</label>
          <div class="radio-group">
            <label class="radio-label">
              <input
                type="radio"
                name="javaSource"
                value="auto"
                checked={configStore.data.javaSource === 'auto'}
                onchange={() => patch({ javaSource: 'auto' })}
              />
              {t('settings.java.auto')}
            </label>
            <label class="radio-label">
              <input
                type="radio"
                name="javaSource"
                value="custom"
                checked={configStore.data.javaSource === 'custom'}
                onchange={() => patch({ javaSource: 'custom' })}
              />
              {t('settings.java.custom')}
            </label>
          </div>
        </div>

        {#if configStore.data.javaSource === 'custom'}
          <div class="field-row field-row--vertical">
            <label class="field-label">{t('settings.java.path')}</label>
            <div class="path-control">
              <input
                type="text"
                class="text-input"
                value={configStore.data.javaCustomPath ?? ''}
                placeholder="/usr/lib/jvm/java-8-openjdk/bin/java"
                onchange={(e) =>
                  patch({ javaCustomPath: (e.target as HTMLInputElement).value || null })}
                readonly
              />
              <button class="btn btn--secondary" onclick={browseJava}>
                {t('settings.java.browse')}
              </button>
              <button
                class="btn btn--secondary"
                onclick={validateJava}
                disabled={validating || !configStore.data.javaCustomPath}
              >
                {validating ? '...' : t('settings.java.validate')}
              </button>
            </div>
            {#if javaValidation}
              <span
                class="java-validation"
                class:java-validation--ok={javaValidation.ok}
                class:java-validation--err={!javaValidation.ok}
              >
                {javaValidation.ok
                  ? t('settings.java.valid', {
                      version: javaValidation.versionText?.split('\n')[0] ?? '',
                    })
                  : t('settings.java.invalid', { error: javaValidation.error ?? '' })}
              </span>
            {/if}
          </div>
        {/if}
      </section>

      <!-- ── Advanced ──────────────────────────────────────────────────── -->
      <section class="settings-section">
        <h2 class="section-title">{t('settings.section.advanced')}</h2>

        <div class="field-row field-row--vertical">
          <label class="field-label" for="jvm-args">{t('settings.jvm.label')}</label>
          <textarea
            id="jvm-args"
            class="text-input text-input--mono"
            rows={3}
            value={configStore.data.jvmArgs}
            placeholder={t('settings.jvm.placeholder')}
            onchange={(e) => patch({ jvmArgs: (e.target as HTMLTextAreaElement).value })}
          ></textarea>
        </div>
      </section>

      <!-- ── Launcher ──────────────────────────────────────────────────── -->
      <section class="settings-section">
        <h2 class="section-title">{t('settings.section.launcher')}</h2>

        <div class="field-row">
          <label class="field-label" for="lang-select">{t('settings.language.label')}</label>
          <select
            id="lang-select"
            class="select-input"
            value={configStore.data.language}
            onchange={(e) =>
              patch({ language: (e.target as HTMLSelectElement).value as 'en' | 'pt' })}
          >
            {#each availableLocales as locale}
              <option value={locale.code}>{locale.flag} {locale.label}</option>
            {/each}
          </select>
        </div>

        <div class="field-row">
          <label class="field-label" for="channel-select">{t('settings.channel.label')}</label>
          <select
            id="channel-select"
            class="select-input"
            value={configStore.data.releaseChannel}
            onchange={(e) =>
              patch({
                releaseChannel: (e.target as HTMLSelectElement).value as
                  | 'stable'
                  | 'snapshot'
                  | 'dev',
              })}
          >
            <option value="stable">{t('settings.channel.stable')}</option>
            <option value="snapshot">{t('settings.channel.snapshot')}</option>
            <option value="dev">{t('settings.channel.dev')}</option>
          </select>
        </div>

        <div class="field-row">
          <label class="field-label" for="show-logs">{t('settings.showLogs.label')}</label>
          <input
            id="show-logs"
            type="checkbox"
            class="checkbox-input"
            checked={configStore.data.showLogsOnLaunch}
            onchange={(e) => patch({ showLogsOnLaunch: (e.target as HTMLInputElement).checked })}
          />
        </div>
      </section>
    </div>
  {:else}
    <div class="settings-loading">{t('common.loading')}</div>
  {/if}
</div>

<style lang="scss">
  .settings-screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-bg-app);
  }

  .settings-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 32px 16px;
    border-bottom: 1px solid var(--color-border-subtle);
    flex-shrink: 0;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    font-size: 13px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition:
      color 0.1s,
      background 0.1s;

    &:hover {
      color: var(--color-text-primary);
      background: var(--color-bg-hover);
    }
  }

  .settings-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin: 0;
  }

  .saved-flash {
    margin-left: auto;
    font-size: 12px;
    color: var(--color-success);
    font-weight: 600;
    animation: fade-in-out 1.8s ease forwards;
  }

  @keyframes fade-in-out {
    0% {
      opacity: 0;
      transform: translateY(4px);
    }
    15% {
      opacity: 1;
      transform: translateY(0);
    }
    75% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  .settings-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px 40px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--color-text-muted);
    text-transform: uppercase;
    margin: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: 16px;

    &--vertical {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
  }

  .field-label {
    font-size: 13px;
    color: var(--color-text-secondary);
    font-weight: 500;
    flex-shrink: 0;
    min-width: 180px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .field-label-hint {
    font-size: 11px;
    color: var(--color-text-muted);
    font-weight: 400;
  }

  .ram-control {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .slider {
    flex: 1;
    accent-color: var(--color-accent);
    cursor: pointer;
  }

  .ram-value {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text-primary);
    min-width: 40px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .radio-group {
    display: flex;
    gap: 16px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--color-text-secondary);
    cursor: pointer;

    input {
      accent-color: var(--color-accent);
    }
  }

  .path-control {
    display: flex;
    gap: 8px;
    width: 100%;
    align-items: center;
  }

  .text-input {
    flex: 1;
    padding: 8px 12px;
    background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-primary);
    font-size: 12px;
    outline: none;
    transition: border-color 0.1s;
    width: 100%;

    &:focus {
      border-color: var(--color-accent);
    }

    &--mono {
      font-family: monospace;
      resize: vertical;
      min-height: 60px;
    }
  }

  .select-input {
    padding: 7px 10px;
    background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-primary);
    font-size: 13px;
    outline: none;
    cursor: pointer;
    min-width: 140px;

    &:focus {
      border-color: var(--color-accent);
    }

    option {
      background: var(--color-bg-surface);
    }
  }

  .checkbox-input {
    width: 18px;
    height: 18px;
    accent-color: var(--color-accent);
    cursor: pointer;
  }

  .java-validation {
    font-size: 11px;
    font-weight: 600;

    &--ok {
      color: var(--color-success);
    }
    &--err {
      color: var(--color-danger);
    }
  }

  .btn {
    padding: 7px 14px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s;

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &--secondary {
      background: var(--color-bg-surface);
      color: var(--color-text-secondary);
      &:hover:not(:disabled) {
        background: var(--color-bg-hover);
      }
    }
  }

  .settings-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    font-size: 13px;
  }
</style>
