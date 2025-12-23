<script lang="ts">
  import type { AccountProfile } from '@shindo/shared'
  import { appStore } from '../store/appStore'
  import UserPlus from 'lucide-svelte/icons/user-plus'
  import Check from 'lucide-svelte/icons/check'
  import { t } from '../i18n'

  const NAV_ITEMS: Array<{ id: 'home' | 'accounts'; label: string }> = [
    { id: 'home', label: 'nav.home' },
    { id: 'accounts', label: 'nav.accounts' },
  ]

  const { setScreen } = appStore

  $: currentScreen = $appStore.screen
  $: accountsState = $appStore.accounts
  $: activeAccount = accountsState.entries.find((entry) => entry.id === accountsState.activeAccountId)

  function avatarUrl(account?: AccountProfile | null): string {
    const identifier = account ? account.uuid || account.username : 'Steve'
    return `https://minotar.net/helm/${identifier}/64`
  }

  $: accountAvatar = avatarUrl(activeAccount)
  $: accountLabel = activeAccount
    ? activeAccount.type === 'microsoft'
      ? $t('account.microsoft')
      : $t('account.offline')
    : $t('account.noneSelected')
</script>

<nav class="flex h-14 items-center justify-between border-b border-slate-900/70 bg-slate-950/80 px-6">
  <div class="flex items-center gap-3">
    {#each NAV_ITEMS as item}
      <button
        type="button"
        class={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
          currentScreen === item.id
            ? 'bg-indigo-600/80 text-white shadow shadow-indigo-900/40'
            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
        }`}
        on:click={() => setScreen(item.id)}
      >
        {$t(item.label)}
      </button>
    {/each}
  </div>

  <div class="flex items-center gap-3">
    <div class="flex items-center gap-3 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5">
      <img
        class="h-8 w-8 rounded-full border border-slate-800/60 object-cover"
        src={accountAvatar}
        alt={activeAccount ? accountLabel : $t('account.noneSelected')}
        draggable="false"
      />
      <div class="flex flex-col">
        <span class="text-sm font-semibold text-slate-100">
          {activeAccount ? activeAccount.username : $t('account.none')}
        </span>
        <span class="text-[11px] font-medium uppercase tracking-wide text-slate-400">{accountLabel}</span>
      </div>
      {#if activeAccount}
        <Check class="h-4 w-4 text-emerald-400" aria-hidden="true" />
      {:else}
        <button
          type="button"
          class="ml-2 inline-flex items-center gap-1 rounded-full border border-indigo-500/50 px-3 py-1 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-600/20"
          on:click={() => setScreen('accounts')}
        >
          <UserPlus class="h-3.5 w-3.5" aria-hidden="true" />
          <span>{$t('account.add')}</span>
        </button>
      {/if}
    </div>
  </div>
</nav>

