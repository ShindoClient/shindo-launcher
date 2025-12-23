<script lang="ts">
  import type { AccountProfile } from '@shindo/shared'
  import PlusCircle from 'lucide-svelte/icons/plus-circle'
  import ShieldCheck from 'lucide-svelte/icons/shield-check'
  import Loader2 from 'lucide-svelte/icons/loader-2'
  import RefreshCw from 'lucide-svelte/icons/refresh-cw'
  import UserCheck from 'lucide-svelte/icons/user-check'
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle'
  import { appStore } from '../store/appStore'
  import ScrollArea from '../components/ScrollArea.svelte'
  import { t } from '../i18n'

  const { addOfflineAccount, addMicrosoftAccount, removeAccount, selectAccount, reloadAccounts } = appStore

  let offlineName = ''
  let confirmationTarget: string | null = null

  $: state = $appStore.accounts
  $: canAddMore = state.entries.length < state.limit
  $: activeAccountId = state.activeAccountId

  function avatarFor(account: AccountProfile): string {
    return `https://minotar.net/helm/${account.uuid || account.username}/96`
  }

  function typeLabel(account: AccountProfile): string {
    return account.type === 'microsoft' ? $t('account.microsoft') : $t('account.offline')
  }

  function formatTimestamp(timestamp?: number): string {
    if (!timestamp) return $t('accounts.neverUsed')
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(timestamp))
  }

  async function handleOfflineSubmit(event: Event) {
    event.preventDefault()
    if (!offlineName.trim() || !canAddMore) return
    try {
      await addOfflineAccount(offlineName.trim())
      offlineName = ''
    } catch {
      // handled pelo store
    }
  }

  async function handleMicrosoftLogin() {
    if (!canAddMore) return
    try {
      await addMicrosoftAccount()
    } catch {
      // handled pelo store
    }
  }

  async function handleSelect(accountId: string) {
    if (accountId === activeAccountId) return
    try {
      await selectAccount(accountId)
    } catch {
      // handled pelo store
    }
  }

  async function handleRemove(accountId: string) {
    if (confirmationTarget !== accountId) {
      confirmationTarget = accountId
      setTimeout(() => {
        if (confirmationTarget === accountId) {
          confirmationTarget = null
        }
      }, 4000)
      return
    }
    confirmationTarget = null
    try {
      await removeAccount(accountId)
    } catch {
      // handled pelo store
    }
  }
</script>

<div class="flex h-full w-full min-h-0 flex-col">
  <ScrollArea className="flex-1 min-h-0">
    <div class="flex w-full flex-col gap-5 px-6 py-5">
      <div class="grid gap-4 md:grid-cols-2">
        <form
          class="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-inner shadow-slate-950/40"
          on:submit|preventDefault={handleOfflineSubmit}
        >
          <div class="flex items-center gap-3">
            <PlusCircle class="h-6 w-6 text-indigo-300" />
            <div>
              <h2 class="text-base font-semibold text-slate-50">{$t('accounts.addOfflineTitle')}</h2>
              <p class="text-sm text-slate-400">{$t('accounts.addOfflineDescription')}</p>
            </div>
          </div>
          <label class="mt-4 flex flex-col gap-2 text-sm font-medium text-slate-300">
            {$t('accounts.playerName')}
            <input
              class="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-base text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-60"
              type="text"
              bind:value={offlineName}
              maxlength={16}
              placeholder={$t('accounts.offlinePlaceholder')}
              required
              disabled={!canAddMore || state.loading}
            />
          </label>
          <button
            type="submit"
            class="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/90 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-900/60 disabled:text-emerald-200"
            disabled={!canAddMore || state.loading}
          >
            <UserCheck class="h-4 w-4" />
            <span>{$t('accounts.saveOffline')}</span>
          </button>
          <p class="mt-2 text-xs text-slate-400">
            {$t('accounts.offlineInfo')}
          </p>
        </form>

        <div class="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-5 shadow-inner shadow-slate-950/40">
          <div class="flex items-center gap-3">
            <ShieldCheck class="h-6 w-6 text-sky-300" />
            <div>
              <h2 class="text-base font-semibold text-slate-50">{$t('accounts.microsoftTitle')}</h2>
              <p class="text-sm text-slate-400">
                {$t('accounts.microsoftDescription')}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500/90 px-4 py-3 text-sm font-semibold text-sky-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-900/60 disabled:text-sky-100"
            on:click={handleMicrosoftLogin}
            disabled={!canAddMore || state.loginInProgress}
          >
            {#if state.loginInProgress}
              <Loader2 class="h-4 w-4 animate-spin" />
              <span>{$t('accounts.loginAuthenticating')}</span>
            {:else}
              <ShieldCheck class="h-4 w-4" />
              <span>{$t('accounts.loginButton')}</span>
            {/if}
          </button>
          <p class="mt-2 text-xs text-slate-400">
            {$t('accounts.loginNotice')}
          </p>
          <div class="mt-4 flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
            <span>{$t('accounts.totalAccounts')}</span>
            <span class="font-semibold text-slate-50">{state.entries.length} / {state.limit}</span>
          </div>
        </div>
      </div>

      {#if !canAddMore}
        <div class="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
          <AlertTriangle class="h-4 w-4" />
          <span>{$t('accounts.limitReached', { limit: state.limit })}</span>
        </div>
      {/if}

      {#if state.error}
        <div class="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-100">
          <AlertTriangle class="h-4 w-4" />
          <span>{state.error}</span>
        </div>
      {/if}

      <section class="rounded-2xl border border-slate-800/80 bg-slate-950/40 p-5">
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <div>
            <h2 class="text-base font-semibold text-slate-50">{$t('accounts.yourAccounts')}</h2>
            <p class="text-sm text-slate-400">{$t('accounts.chooseProfile')}</p>
          </div>
          <button
            type="button"
            class="ml-auto inline-flex items-center gap-2 rounded-full border border-slate-700/70 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-indigo-500 hover:text-white"
            on:click={() => reloadAccounts().catch(() => undefined)}
            disabled={state.loading}
          >
            <RefreshCw class={`h-3.5 w-3.5 ${state.loading ? 'animate-spin' : ''}`} />
            <span>{$t('accounts.sync')}</span>
          </button>
        </div>

        {#if state.entries.length === 0}
          <div class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700/70 bg-slate-900/40 px-6 py-10 text-center">
            <UserCheck class="h-8 w-8 text-slate-500" />
            <p class="text-sm text-slate-400">{$t('accounts.empty')}</p>
          </div>
        {:else}
          <div class="grid gap-4 md:grid-cols-2">
            {#each state.entries as account}
              <article
                class={`flex flex-col gap-3 rounded-xl border bg-slate-900/60 p-4 transition ${
                  account.id === activeAccountId
                    ? 'border-indigo-500/70 shadow shadow-indigo-900/40'
                    : 'border-slate-800/80'
                }`}
              >
                <div class="flex items-center gap-3">
                  <img
                    src={avatarFor(account)}
                    alt={`Avatar de ${account.username}`}
                    class="h-12 w-12 rounded-xl border border-slate-800/60 object-cover"
                    draggable="false"
                  />
                  <div class="flex flex-col">
                    <span class="text-base font-semibold text-slate-50">{account.username}</span>
                    <span class="text-xs font-medium uppercase tracking-wide text-slate-400">{typeLabel(account)}</span>
                  </div>
                </div>

                <div class="rounded-lg border border-slate-800/70 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
                  {$t('accounts.lastUse')}: <strong class="font-semibold text-slate-200">{formatTimestamp(account.lastUsedAt)}</strong>
                </div>

                <div class="mt-auto flex gap-2">
                  {#if account.id !== activeAccountId}
                    <button
                      type="button"
                      class="flex-1 rounded-lg border border-emerald-400/60 bg-emerald-500/90 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-70"
                      on:click={() => handleSelect(account.id)}
                      disabled={state.loading}
                    >
                      {$t('accounts.setActive')}
                    </button>
                  {:else}
                    <div class="flex flex-1 items-center justify-center rounded-lg border border-indigo-500/60 bg-indigo-500/10 text-sm font-semibold text-indigo-200">
                      {$t('accounts.active')}
                    </div>
                  {/if}
                  <button
                    type="button"
                    class={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      confirmationTarget === account.id
                        ? 'border-red-500/70 bg-red-500/10 text-red-100'
                        : 'border-slate-700/70 text-slate-300 hover:border-red-400 hover:text-red-200'
                    }`}
                    on:click={() => handleRemove(account.id)}
                    disabled={state.loading}
                  >
                    {confirmationTarget === account.id ? $t('accounts.confirmRemove') : $t('accounts.remove')}
                  </button>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </ScrollArea>
</div>
