<script lang="ts">
  import type { AccountProfile } from '@shindo/shared'
  import PlusCircle from 'lucide-svelte/icons/plus-circle'
  import Shield from 'lucide-svelte/icons/shield'
  import Loader2 from 'lucide-svelte/icons/loader-2'
  import RefreshCw from 'lucide-svelte/icons/refresh-cw'
  import UserCheck from 'lucide-svelte/icons/user-check'
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle'
  import User from 'lucide-svelte/icons/user'
  import X from 'lucide-svelte/icons/x'
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
    return `https://minotar.net/avatar/${account.username}/64.png`
  }

  function typeLabel(account: AccountProfile): string {
    return account.type === 'microsoft' ? 'Microsoft' : 'Offline'
  }

  function formatTimestamp(timestamp?: number): string {
    if (!timestamp) return 'Never used'
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(timestamp))
  }

  async function handleOfflineSubmit(e: Event) {
    e.preventDefault()
    if (!offlineName.trim() || !canAddMore) return
    try {
      await addOfflineAccount(offlineName.trim())
      offlineName = ''
    } catch {
      // handled by store
    }
  }

  async function handleMicrosoftLogin() {
    if (!canAddMore) return
    try {
      await addMicrosoftAccount()
    } catch {
      // handled by store
    }
  }

  async function handleSelect(accountId: string) {
    if (accountId === activeAccountId) return
    try {
      await selectAccount(accountId)
    } catch {
      // handled by store
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
      // handled by store
    }
  }
</script>

<div class="flex h-full w-full min-h-0 flex-col">
  <ScrollArea className="flex-1 min-h-0">
    <div class="w-full p-6 space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Accounts</h1>
          <p class="text-gray-400 text-sm">Manage your Minecraft accounts</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="bg-gray-900/50 rounded-lg px-4 py-2">
            <div class="text-xs text-gray-400">Accounts</div>
            <div class="text-lg font-bold text-white">{state.entries.length} / {state.limit}</div>
          </div>
        </div>
      </div>

      <!-- Add Account Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Offline Account -->
        <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-blue-500/20 rounded-lg">
              <PlusCircle class="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-white">Offline Account</h3>
              <p class="text-sm text-gray-400">Play with any username</p>
            </div>
          </div>
          
          <form on:submit|preventDefault={handleOfflineSubmit}>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Username</label>
                <input
                  bind:value={offlineName}
                  type="text"
                  maxlength="16"
                  class="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                  placeholder="Enter username"
                  disabled={!canAddMore || state.loading}
                />
              </div>
              <button
                type="submit"
                disabled={!canAddMore || state.loading}
                class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.loading ? 'Adding...' : 'Add Offline Account'}
              </button>
            </div>
          </form>
        </div>

        <!-- Microsoft Account -->
        <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-green-500/20 rounded-lg">
              <Shield class="h-5 w-5 text-green-400" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-white">Microsoft Account</h3>
              <p class="text-sm text-gray-400">Sign in with Microsoft</p>
            </div>
          </div>
          
          <button
            on:click={handleMicrosoftLogin}
            disabled={!canAddMore || state.loginInProgress}
            class="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {#if state.loginInProgress}
              <Loader2 class="h-4 w-4 animate-spin" />
              <span>Authenticating...</span>
            {:else}
              <Shield class="h-4 w-4" />
              <span>Sign in with Microsoft</span>
            {/if}
          </button>
        </div>
      </div>

      <!-- Error Messages -->
      {#if state.error}
        <div class="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle class="h-5 w-5 text-red-400" />
          <span class="text-red-300 text-sm">{state.error}</span>
        </div>
      {/if}

      <!-- Account List -->
      <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-semibold text-white">Your Accounts</h3>
            <p class="text-sm text-gray-400">Select an account to use with the launcher</p>
          </div>
          <button
            on:click={() => reloadAccounts()}
            disabled={state.loading}
            class="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-800/80 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw class={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {#if state.entries.length === 0}
          <div class="text-center py-12">
            <User class="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p class="text-gray-400">No accounts yet. Add one above to get started.</p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each state.entries as account}
              <div class={`p-4 rounded-xl border ${account.id === activeAccountId ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-gray-900/50'} transition`}>
                <div class="flex items-start gap-3">
                  <img
                    src={avatarFor(account)}
                    alt={account.username}
                    class="w-12 h-12 rounded-lg border border-gray-700"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <h4 class="font-semibold text-white truncate">{account.username}</h4>
                      {#if account.id === activeAccountId}
                        <span class="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded font-medium">
                          Active
                        </span>
                      {/if}
                    </div>
                    <p class="text-sm text-gray-400">{typeLabel(account)}</p>
                    <p class="text-xs text-gray-500 mt-1">
                      Last used: {formatTimestamp(account.lastUsedAt)}
                    </p>
                  </div>
                </div>
                
                <div class="flex gap-2 mt-4">
                  {#if account.id !== activeAccountId}
                    <button
                      on:click={() => handleSelect(account.id)}
                      class="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                    >
                      Select
                    </button>
                  {/if}
                  <button
                    on:click={() => handleRemove(account.id)}
                    class="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-sm font-medium transition"
                  >
                    {confirmationTarget === account.id ? 'Confirm' : 'Remove'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
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