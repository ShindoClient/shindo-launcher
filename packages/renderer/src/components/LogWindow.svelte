<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { fly } from 'svelte/transition'
  import X from 'lucide-svelte/icons/x'
  import Trash2 from 'lucide-svelte/icons/trash-2'

  export let visible = false
  export let logs: string[] = []

  const dispatch = createEventDispatcher<{ close: void; clear: void }>()

  function close() {
    dispatch('close')
  }

  function clear() {
    dispatch('clear')
  }
</script>

{#if visible}
  <div class="pointer-events-none fixed inset-0 z-40 flex items-end justify-end">
    <div class="pointer-events-auto m-6 w-[380px] max-w-full" transition:fly={{ x: 24, duration: 180 }}>
      <section
        class="flex max-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/95 shadow-[0_20px_45px_rgba(15,23,42,0.65)] backdrop-blur"
        role="log"
        aria-live="polite"
        aria-label="Logs do cliente"
      >
        <header class="flex items-center justify-between border-b border-slate-800/60 bg-slate-900/40 px-4 py-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-200">Logs do Cliente</h2>
            <p class="text-xs text-slate-500">Monitoramento em tempo real do processo</p>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="inline-flex items-center rounded-md border border-slate-800 bg-slate-900/70 px-2 py-1 text-xs text-slate-300 hover:border-slate-600 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70"
              on:click={clear}
              title="Limpar logs"
            >
              <Trash2 class="mr-1 h-3.5 w-3.5" />
              Limpar
            </button>
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-900/70 text-slate-300 transition hover:border-slate-600 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70"
              aria-label="Fechar janela de logs"
              on:click={close}
            >
              <X class="h-4 w-4" />
            </button>
          </div>
        </header>
        <div class="flex-1 overflow-y-auto bg-slate-950/80 px-4 py-3 text-xs text-slate-200">
          {#if logs.length === 0}
            <p class="text-slate-500">Os registros do cliente aparecerão aqui quando o jogo iniciar.</p>
          {:else}
            {#each logs as log, index (index)}
              <div class="whitespace-pre-wrap leading-relaxed">{log}</div>
            {/each}
          {/if}
        </div>
      </section>
    </div>
  </div>
{/if}
