<script lang="ts">
  import { onMount } from 'svelte';
  import Search from 'lucide-svelte/icons/search';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import Minus from 'lucide-svelte/icons/minus';
  import X from 'lucide-svelte/icons/x';
  import { logStore, type ClientLogEntry } from '../store/logStore';
  import ScrollArea from '../components/ScrollArea.svelte';
  import { t } from '../i18n';

  type LevelFilter = Record<'debug' | 'info' | 'warn' | 'error', boolean>;
  const filterOrder: Array<keyof LevelFilter> = ['debug', 'info', 'warn', 'error'];

  const levelStyles: Record<
    ClientLogEntry['level'],
    { label: string; badge: string; text: string }
  > = {
    debug: {
      label: 'DEBUG',
      badge: 'bg-indigo-500/10 text-indigo-200 border-indigo-500/40',
      text: 'text-indigo-100',
    },
    info: {
      label: 'INFO',
      badge: 'bg-sky-500/10 text-sky-200 border-sky-500/40',
      text: 'text-sky-100',
    },
    warn: {
      label: 'WARN',
      badge: 'bg-amber-500/10 text-amber-200 border-amber-500/50',
      text: 'text-amber-100',
    },
    error: {
      label: 'ERROR',
      badge: 'bg-rose-500/10 text-rose-200 border-rose-500/50',
      text: 'text-rose-100',
    },
  };

  let search = '';
  let filters: LevelFilter = { debug: true, info: true, warn: true, error: true };

  $: logs = $logStore;
  $: normalizedSearch = search.trim().toLowerCase();
  $: filteredLogs = logs.filter((entry) => {
    if (!filters[entry.level]) return false;
    if (!normalizedSearch) return true;
    return entry.message.toLowerCase().includes(normalizedSearch);
  });

  function toggleLevel(level: keyof LevelFilter) {
    filters = { ...filters, [level]: !filters[level] };
  }

  function formatTime(timestamp: number): string {
    const formatter = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return formatter.format(new Date(timestamp));
  }

  async function clearLogs() {
    try {
      await logStore.clear();
    } catch (error) {
      console.error('Failed to clear log history', error);
    }
  }

  function minimize() {
    window.shindo
      .minimizeWindow()
      .catch((error) => console.error('Failed to minimize log window', error));
  }

  function closeWindow() {
    window.shindo
      .closeWindow()
      .catch((error) => console.error('Failed to close log window', error));
  }

  onMount(() => {
    logStore.init().catch((error) => console.error('Failed to initialise log store', error));
  });
</script>

<style lang="scss">
  @use '../styles/variables' as v;
  header {
    -webkit-user-select: none;
    user-select: none;
  }
  .no-drag {
    -webkit-app-region: no-drag;
  }
</style>

<div class="min-h-screen w-screen bg-slate-950 text-slate-100">
  <header
    class="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-5 py-4 backdrop-blur"
    style="-webkit-app-region: drag;"
  >
    <div class="flex flex-col gap-1">
      <p class="text-sm uppercase tracking-[0.2em] text-indigo-300">{$t('logWindow.title')}</p>
      <h1 class="text-xl font-semibold leading-tight text-slate-50">{$t('logWindow.subtitle')}</h1>
      <span class="text-xs text-slate-400">{$t('logWindow.helper')}</span>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="no-drag inline-flex items-center gap-2 rounded-lg border border-indigo-500/50 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-100 transition hover:border-indigo-400 hover:bg-indigo-500/20"
        on:click={clearLogs}
        title={$t('logWindow.clear')}
      >
        <Trash2 class="h-4 w-4" />
        <span>{$t('logWindow.clear')}</span>
      </button>
      <button
        type="button"
        class="no-drag flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 bg-slate-800/70 text-slate-200 transition hover:border-slate-500 hover:bg-slate-700/80"
        aria-label={$t('titleBar.minimize')}
        on:click={minimize}
      >
        <Minus class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="no-drag flex h-9 w-9 items-center justify-center rounded-md border border-rose-500/40 bg-rose-500/15 text-rose-100 transition hover:border-rose-400 hover:bg-rose-500/25"
        aria-label={$t('titleBar.close')}
        on:click={closeWindow}
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  </header>

  <main class="flex h-[calc(100vh-76px)] flex-col gap-4 px-5 py-4">
    <div class="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr]">
      <label
        class="group relative flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 ring-offset-2 ring-offset-slate-950 focus-within:border-indigo-400/70 focus-within:ring-2 focus-within:ring-indigo-500/40"
      >
        <Search
          class="h-4 w-4 text-slate-400 transition group-focus-within:text-indigo-300"
          aria-hidden="true"
        />
        <input
          type="search"
          class="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          placeholder={$t('logWindow.searchPlaceholder')}
          bind:value={search}
        />
      </label>

      <div
        class="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3"
      >
        {#each filterOrder as levelKey (levelKey)}
          <button
            type="button"
            class={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              filters[levelKey]
                ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-100'
                : 'border-slate-700 bg-slate-800/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
            aria-pressed={filters[levelKey]}
            on:click={() => toggleLevel(levelKey)}
          >
            <input
              type="checkbox"
              class="h-3.5 w-3.5 accent-indigo-500"
              checked={filters[levelKey]}
              aria-hidden="true"
              tabindex="-1"
              on:click|stopPropagation={() => toggleLevel(levelKey)}
            />
            <span class="tracking-wide">{levelStyles[levelKey].label}</span>
          </button>
        {/each}
      </div>
    </div>

    <section
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-[0_18px_48px_rgba(0,0,0,0.35)]"
    >
      <div
        class="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4 py-2"
      >
        <div class="flex items-center gap-3 text-xs text-slate-400">
          <span class="rounded-full bg-slate-800 px-2 py-1 font-semibold text-slate-200">
            {filteredLogs.length}
            {$t('logWindow.entries')}
          </span>
          <span class="text-slate-500">{$t('logWindow.filtersHint')}</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div class="space-y-2 px-4 py-3 text-sm leading-relaxed">
          {#if filteredLogs.length === 0}
            <p
              class="rounded-lg border border-dashed border-slate-700/70 bg-slate-900/80 px-4 py-6 text-center text-slate-500"
            >
              {$t('logWindow.empty')}
            </p>
          {:else}
            {#each filteredLogs as log (log.id)}
              <article
                class="flex gap-3 rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2"
              >
                <div
                  class={`mt-1 h-fit rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${levelStyles[log.level].badge}`}
                >
                  {levelStyles[log.level].label}
                </div>
                <div class="min-w-0 flex-1">
                  <div
                    class="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500"
                  >
                    <span>{formatTime(log.timestamp)}</span>
                  </div>
                  <p class={`mt-1 whitespace-pre-wrap break-words ${levelStyles[log.level].text}`}>
                    {log.message}
                  </p>
                </div>
              </article>
            {/each}
          {/if}
        </div>
      </ScrollArea>
    </section>
  </main>
</div>
