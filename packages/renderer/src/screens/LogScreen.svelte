<script lang="ts">
  import { onMount } from 'svelte';
  import { launchStore } from '$lib/stores/launch.svelte';
  import { t } from '$lib/i18n';
  import type { LaunchLogEntry } from '@shindo/shared';

  let scrollEl = $state<HTMLElement | null>(null);
  let autoScroll = $state(true);
  let filter = $state<'all' | 'error' | 'warn'>('all');

  const filtered = $derived(
    filter === 'all' ? launchStore.logs : launchStore.logs.filter((e) => e.level === filter),
  );

  // Auto-scroll on new logs
  $effect(() => {
    if (autoScroll && filtered.length > 0 && scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  });

  function onScroll() {
    if (!scrollEl) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollEl;
    autoScroll = scrollTop + clientHeight >= scrollHeight - 20;
  }

  async function clearLogs() {
    await launchStore.clearLogs();
  }

  function levelClass(level: LaunchLogEntry['level']): string {
    return `log-line--${level}`;
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  onMount(async () => {
    // Hydrate with historical logs on mount
    const history = await window.shindo.getLaunchLogs();
    for (const entry of history) {
      if (
        !launchStore.logs.some(
          (e) => e.timestamp === entry.timestamp && e.message === entry.message,
        )
      ) {
        launchStore.onLog(entry);
      }
    }
  });
</script>

<div class="log-screen">
  <header class="log-header">
    <span class="log-title">{t('logs.title')}</span>
    <div class="log-toolbar">
      <div class="filter-tabs">
        {#each ['all', 'warn', 'error'] as f}
          <button
            class="filter-tab"
            class:filter-tab--active={filter === f}
            onclick={() => {
              filter = f as typeof filter;
            }}
          >
            {f}
          </button>
        {/each}
      </div>
      <button class="log-btn" onclick={clearLogs}>{t('logs.clear')}</button>
      <button class="log-btn" onclick={() => window.shindo.closeLogWindow()}
        >{t('logs.close')}</button
      >
    </div>
  </header>

  <!-- eslint-disable-next-line svelte/no-unused-svelte-ignore -->
  <div class="log-body" bind:this={scrollEl} onscroll={onScroll} role="log" aria-live="polite">
    {#if filtered.length === 0}
      <p class="log-empty">{t('logs.empty')}</p>
    {:else}
      {#each filtered as entry (entry.timestamp + entry.message)}
        <div class="log-line {levelClass(entry.level)}">
          <span class="log-time">{formatTime(entry.timestamp)}</span>
          <span class="log-level">{entry.level.toUpperCase()}</span>
          <span class="log-msg">{entry.message}</span>
        </div>
      {/each}
    {/if}
  </div>

  {#if !autoScroll}
    <button
      class="scroll-btn"
      onclick={() => {
        autoScroll = true;
        scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
      }}
    >
      ↓ Latest
    </button>
  {/if}
</div>

<style lang="scss">
  .log-screen {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--color-bg-app);
    font-family: monospace;
    overflow: hidden;
  }

  .log-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--color-bg-titlebar);
    border-bottom: 1px solid var(--color-border-subtle);
    flex-shrink: 0;
    -webkit-app-region: drag;
    user-select: none;
  }

  .log-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text-primary);
    font-family: var(--font-sans);
  }

  .log-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    -webkit-app-region: no-drag;
  }

  .filter-tabs {
    display: flex;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
    overflow: hidden;
  }

  .filter-tab {
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    font-family: monospace;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    text-transform: uppercase;
    transition:
      background 0.1s,
      color 0.1s;

    &--active {
      background: var(--color-bg-hover);
      color: var(--color-text-primary);
    }
  }

  .log-btn {
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-sans);
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition:
      color 0.1s,
      background 0.1s;

    &:hover {
      color: var(--color-text-primary);
      background: var(--color-bg-hover);
    }
  }

  .log-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: 3px;
    }
  }

  .log-empty {
    padding: 24px;
    text-align: center;
    color: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: 13px;
  }

  .log-line {
    display: grid;
    grid-template-columns: 72px 44px 1fr;
    gap: 10px;
    padding: 2px 14px;
    font-size: 12px;
    line-height: 1.55;
    transition: background 0.05s;

    &:hover {
      background: rgba(255 255 255 / 0.03);
    }

    &--debug {
      color: var(--color-text-muted);
    }
    &--info {
      color: var(--color-text-secondary);
    }
    &--warn {
      color: var(--color-warn);
    }
    &--error {
      color: var(--color-danger);
    }
  }

  .log-time {
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .log-level {
    font-weight: 700;
    flex-shrink: 0;
    font-size: 10px;
    letter-spacing: 0.04em;
  }

  .log-msg {
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  .scroll-btn {
    position: absolute;
    bottom: 16px;
    right: 20px;
    padding: 6px 14px;
    background: var(--color-accent);
    color: #fff;
    border: none;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0 0 0 / 0.4);
    transition: opacity 0.1s;

    &:hover {
      opacity: 0.85;
    }
  }
</style>
