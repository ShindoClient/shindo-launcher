<script lang="ts">
  import { onMount } from 'svelte'
  import type { AccountProfile } from '@shindo/shared'
  import Play from 'lucide-svelte/icons/play'
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import Plus from 'lucide-svelte/icons/plus'
  import Shield from 'lucide-svelte/icons/shield'
  import Loader2 from 'lucide-svelte/icons/loader-2'
  import User from 'lucide-svelte/icons/user'
  import Trash2 from 'lucide-svelte/icons/trash-2'
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle'
  import X from 'lucide-svelte/icons/x'
  import { appStore } from '../store/appStore'
  import { resolveVersionPresentation } from '../config/versionCatalog'
  import { t } from '../i18n'
  import bannerUrl from '../assets/Banner.png'

  const {
    launch,
    applyConfigPatch,
    selectAccount,
    removeAccount,
    addMicrosoftAccount,
    addOfflineAccount,
  } = appStore

  $: state = $appStore
  $: config = state.config
  $: clientState = state.clientState
  $: launching = state.launching
  $: launcherStatus = state.launcherStatus
  $: playStatusLabel = noAccountSelected ? $t('home.status.accountRequired') : launcherStatus
  $: update = state.update
  $: updateStatus = update.status
  $: accountsState = $appStore.accounts
  $: activeAccount = accountsState.entries.find((entry) => entry.id === accountsState.activeAccountId)
  $: noAccountSelected = !activeAccount
  $: canAddMore = accountsState.entries.length < accountsState.limit

  function minotarHead(id?: string | null, size = 96): string {
    const safeId = id && id.trim() ? id : 'Steve'
    return `https://minotar.net/helm/${safeId}/${size}`
  }

  function accountAvatar(account: AccountProfile | null | undefined, size = 96): string {
    if (!account) return minotarHead(undefined, size)
    return minotarHead(account.uuid || account.username, size)
  }

  $: avatarUrl = accountAvatar(activeAccount)
  $: versionPresentation = resolveVersionPresentation(clientState)

  $: versionOptions = clientState
    ? [{ id: clientState.versionId, label: versionPresentation.optionLabel }]
    : []
  $: selectedVersionId = config?.versionId ?? clientState?.versionId ?? ''
  $: selectedVersionLabel =
    versionOptions.find((option) => option.id === selectedVersionId)?.label ?? $t('home.selectVersion')

  $: playDisabled = launching || updateStatus !== 'completed' || noAccountSelected

  let versionMenuOpen = false
  let accountMenuOpen = false
  let versionDropdownRef: HTMLDivElement | null = null
  let accountDropdownRef: HTMLDivElement | null = null
  let addPanelOpen = false
  let addPanelMode: 'options' | 'offline' = 'options'
  let offlineName = ''
  let removeConfirmId: string | null = null

  onMount(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (versionDropdownRef && !versionDropdownRef.contains(target)) {
        versionMenuOpen = false
      }
      if (accountDropdownRef && !accountDropdownRef.contains(target)) {
        accountMenuOpen = false
      }
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  })

  function toggleVersionMenu(event: MouseEvent) {
    event.stopPropagation()
    versionMenuOpen = !versionMenuOpen
    if (versionMenuOpen) {
      accountMenuOpen = false
    }
  }

  function toggleAccountMenu(event: MouseEvent) {
    event.stopPropagation()
    accountMenuOpen = !accountMenuOpen
    if (accountMenuOpen) {
      versionMenuOpen = false
    }
  }

  async function selectVersion(optionId: string) {
    versionMenuOpen = false
    if (optionId !== selectedVersionId) {
      await applyConfigPatch({ versionId: optionId })
    }
  }

  async function handleSelectAccount(accountId: string) {
    accountMenuOpen = false
    if (accountId === accountsState.activeAccountId) return
    try {
      await selectAccount(accountId)
    } catch {
      // handled by store
    }
  }

  async function handleRemoveAccount(accountId: string, event: MouseEvent) {
    event.stopPropagation()
    if (removeConfirmId !== accountId) {
      removeConfirmId = accountId
      setTimeout(() => {
        if (removeConfirmId === accountId) {
          removeConfirmId = null
        }
      }, 3500)
      return
    }

    removeConfirmId = null
    try {
      await removeAccount(accountId)
    } catch {
      // handled by store
    }
  }

  function openAddPanel() {
    if (!canAddMore) return
    accountMenuOpen = false
    addPanelOpen = true
    addPanelMode = 'options'
    offlineName = ''
  }

  function closeAddPanel() {
    addPanelOpen = false
    addPanelMode = 'options'
    offlineName = ''
  }

  function handlePanelOverlayKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      closeAddPanel()
    }
  }

  async function handleMicrosoftLogin() {
    if (!canAddMore) return
    closeAddPanel()
    try {
      await addMicrosoftAccount()
    } catch {
      // handled by store
    }
  }

  async function handleOfflineSubmit(event: SubmitEvent) {
    event.preventDefault()
    if (!offlineName.trim() || !canAddMore) return

    try {
      await addOfflineAccount(offlineName.trim())
      closeAddPanel()
    } catch {
      // handled by store
    }
  }

  function handlePlay() {
    launch().catch(() => undefined)
  }
</script>

<div class="home-container">
  <div class="account-section" bind:this={accountDropdownRef}>
    <button
      type="button"
      class="account-toggle"
      on:click={toggleAccountMenu}
      aria-expanded={accountMenuOpen}
      aria-label="Open account menu"
    >
      <img
        class="account-avatar"
        src={avatarUrl}
        alt={activeAccount?.username || 'No account'}
        draggable="false"
      />
      <div class="account-info">
        <span class="account-name">{activeAccount?.username || 'No account selected'}</span>
        <span class="account-type">
          {activeAccount ? (activeAccount.type === 'microsoft' ? 'Microsoft' : 'Offline') : 'Choose or add an account'}
        </span>
      </div>
      <ChevronDown class={`account-chevron ${accountMenuOpen ? 'open' : ''}`} />
    </button>

    {#if accountMenuOpen}
      <div class="account-dropdown">
        <div class="account-dropdown-header">
          Accounts {accountsState.entries.length}/{accountsState.limit}
        </div>

        {#if accountsState.entries.length === 0}
          <div class="account-empty">No saved accounts</div>
        {:else}
          {#each accountsState.entries as account}
            <div class="account-row">
              <button
                type="button"
                class={`account-option ${account.id === accountsState.activeAccountId ? 'active' : ''}`}
                on:click={() => handleSelectAccount(account.id)}
              >
                <img
                  class="account-option-avatar"
                  src={accountAvatar(account, 48)}
                  alt={account.username}
                  draggable="false"
                />
                <span class="account-option-name">{account.username}</span>
                {#if account.id === accountsState.activeAccountId}
                  <span class="account-active-badge">Active</span>
                {/if}
              </button>
              <button
                type="button"
                class={`account-remove ${removeConfirmId === account.id ? 'confirm' : ''}`}
                on:click={(event) => handleRemoveAccount(account.id, event)}
                title={removeConfirmId === account.id ? 'Confirm remove' : 'Remove account'}
              >
                {#if removeConfirmId === account.id}
                  Confirm
                {:else}
                  <Trash2 class="account-remove-icon" />
                {/if}
              </button>
            </div>
          {/each}
        {/if}

        <button
          type="button"
          class="account-add-option"
          on:click={openAddPanel}
          disabled={!canAddMore}
        >
          <Plus class="account-add-icon" />
          <span>{canAddMore ? 'Add account' : 'Account limit reached'}</span>
        </button>
      </div>
    {/if}
  </div>

  <div class="launch-area">
    <div class="banner-background">
      <img src={bannerUrl} alt="Banner" class="banner-image" />
      <div class="banner-overlay"></div>
    </div>

    <button
      type="button"
      class="launch-button"
      on:click={handlePlay}
      disabled={playDisabled}
    >
      <div class="launch-content">
        <span class="launch-text">{launching ? 'LAUNCHING...' : 'LAUNCH'}</span>
        <div class="version-selector-inline" bind:this={versionDropdownRef}>
          <button
            type="button"
            class="version-button-inline"
            on:click={(event) => {
              event.stopPropagation()
              toggleVersionMenu(event)
            }}
          >
            <span>{selectedVersionLabel}</span>
            <ChevronDown class={`chevron-inline ${versionMenuOpen ? 'open' : ''}`} />
          </button>
        </div>
      </div>
      <div class="launch-icon">
        <Play class="play-icon" />
      </div>
    </button>

    {#if versionOptions.length > 0 && versionMenuOpen}
      <div class="version-dropdown-external">
        {#each versionOptions as option}
          <button
            type="button"
            class="version-option"
            on:click={() => selectVersion(option.id)}
          >
            <span>{option.label}</span>
            {#if option.id === selectedVersionId}
              <span class="active-badge">ACTIVE</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    {#if updateStatus !== 'completed'}
      <div class="update-status">
        <div class="pulse-dot"></div>
        <span>UPDATE IN PROGRESS...</span>
      </div>
    {/if}

    {#if playStatusLabel && !accountsState.loading && state.accounts.error === undefined && noAccountSelected}
      <div class="account-warning">
        <AlertTriangle class="account-warning-icon" />
        <span>{playStatusLabel}</span>
      </div>
    {/if}

    {#if accountsState.error}
      <div class="account-error">
        <AlertTriangle class="account-warning-icon" />
        <span>{accountsState.error}</span>
      </div>
    {/if}
  </div>

  {#if addPanelOpen}
    <div
      class="panel-overlay"
      on:click|self={closeAddPanel}
      on:keydown={handlePanelOverlayKeydown}
      role="button"
      tabindex="0"
      aria-label="Close add account panel"
    >
      <div class="panel-card">
        <button type="button" class="panel-close" on:click={closeAddPanel} aria-label="Close add account panel">
          <X class="panel-close-icon" />
        </button>

        {#if addPanelMode === 'options'}
          <h3 class="panel-title">Add account</h3>
          <p class="panel-subtitle">Choose the login type</p>
          <div class="panel-actions">
            <button
              type="button"
              class="panel-action microsoft"
              on:click={handleMicrosoftLogin}
              disabled={accountsState.loginInProgress}
            >
              {#if accountsState.loginInProgress}
                <Loader2 class="panel-action-icon spinning" />
                <span>Opening Microsoft login...</span>
              {:else}
                <Shield class="panel-action-icon" />
                <span>Login with Microsoft</span>
              {/if}
            </button>

            <button type="button" class="panel-action offline" on:click={() => (addPanelMode = 'offline')}>
              <User class="panel-action-icon" />
              <span>Login offline</span>
            </button>
          </div>
        {:else}
          <h3 class="panel-title">Offline account</h3>
          <p class="panel-subtitle">Type the username (max 16 chars)</p>
          <form class="offline-form" on:submit={handleOfflineSubmit}>
            <input
              type="text"
              bind:value={offlineName}
              maxlength="16"
              class="offline-input"
              placeholder="Username"
              disabled={accountsState.loading}
            />
            <div class="offline-form-actions">
              <button type="button" class="secondary-btn" on:click={() => (addPanelMode = 'options')}>
                Back
              </button>
              <button
                type="submit"
                class="primary-btn"
                disabled={!offlineName.trim() || accountsState.loading}
              >
                {accountsState.loading ? 'Adding...' : 'Add offline account'}
              </button>
            </div>
          </form>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .home-container {
    width: 100%;
    height: 100%;
    background: #000000;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .account-section {
    position: absolute;
    top: 20px;
    right: 30px;
    z-index: 20;
  }

  .account-toggle {
    min-width: 270px;
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 8px 14px;
    color: #ffffff;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  .account-toggle:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .account-avatar {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    flex-shrink: 0;
  }

  .account-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .account-name {
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
  }

  .account-type {
    font-size: 11px;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
  }

  .account-chevron {
    width: 16px;
    height: 16px;
    color: #d1d5db;
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  .account-chevron.open {
    transform: rotate(180deg);
  }

  .account-dropdown {
    margin-top: 10px;
    width: 320px;
    background: #121212;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
    overflow: hidden;
  }

  .account-dropdown-header {
    padding: 10px 14px;
    font-size: 11px;
    font-weight: 700;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .account-empty {
    padding: 14px;
    font-size: 13px;
    color: #9ca3af;
  }

  .account-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
  }

  .account-option {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 8px 10px;
    color: #ffffff;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  .account-option:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .account-option.active {
    border-color: rgba(59, 130, 246, 0.45);
    background: rgba(59, 130, 246, 0.12);
  }

  .account-option-avatar {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    flex-shrink: 0;
  }

  .account-option-name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .account-active-badge {
    font-size: 10px;
    font-weight: 700;
    color: #60a5fa;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .account-remove {
    height: 34px;
    min-width: 34px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
    font-size: 11px;
    font-weight: 700;
  }

  .account-remove:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #fecaca;
  }

  .account-remove.confirm {
    min-width: 62px;
    color: #fee2e2;
    border-color: rgba(248, 113, 113, 0.6);
  }

  .account-remove-icon {
    width: 14px;
    height: 14px;
  }

  .account-add-option {
    width: calc(100% - 20px);
    margin: 8px 10px 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(34, 197, 94, 0.14);
    border: 1px solid rgba(34, 197, 94, 0.35);
    border-radius: 8px;
    color: #86efac;
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;
  }

  .account-add-option:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.24);
    color: #bbf7d0;
  }

  .account-add-option:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .account-add-icon {
    width: 14px;
    height: 14px;
  }

  .launch-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    position: relative;
    padding: 80px 40px 40px 40px;
  }

  .banner-background {
    position: absolute;
    width: 1000px;
    height: 250px;
    border-radius: 20px;
    overflow: hidden;
    z-index: 1;
  }

  .banner-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .banner-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.7));
  }

  .launch-button {
    position: relative;
    z-index: 2;
    width: 400px;
    height: 80px;
    background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
    border: none;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 30px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 8px 30px rgba(0, 255, 136, 0.3);
  }

  .launch-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(0, 255, 136, 0.4);
  }

  .launch-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .launch-button:disabled {
    background: linear-gradient(135deg, #333333 0%, #222222 100%);
    cursor: not-allowed;
    box-shadow: none;
  }

  .launch-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .launch-text {
    font-size: 28px;
    font-weight: 800;
    color: #000000;
    letter-spacing: 1px;
  }

  .version-selector-inline {
    display: flex;
    align-items: center;
  }

  .version-button-inline {
    background: rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 6px;
    padding: 4px 10px;
    color: rgba(0, 0, 0, 0.7);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }

  .version-button-inline:hover {
    background: rgba(0, 0, 0, 0.15);
  }

  .chevron-inline {
    width: 12px;
    height: 12px;
    transition: transform 0.2s;
  }

  .chevron-inline.open {
    transform: rotate(180deg);
  }

  .launch-icon {
    width: 50px;
    height: 50px;
    background: rgba(0, 0, 0, 0.15);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .play-icon {
    width: 24px;
    height: 24px;
    color: #000000;
  }

  .version-dropdown-external {
    position: absolute;
    top: 160px;
    z-index: 3;
    width: 300px;
    background: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  }

  .version-option {
    width: 100%;
    background: none;
    border: none;
    padding: 12px 20px;
    color: #ffffff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: background 0.2s;
  }

  .version-option:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .active-badge {
    font-size: 10px;
    font-weight: 700;
    color: #00ff88;
  }

  .update-status {
    position: absolute;
    bottom: 30px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 165, 0, 0.1);
    border: 1px solid rgba(255, 165, 0, 0.3);
    border-radius: 8px;
    padding: 12px 24px;
    color: #ffaa00;
    font-size: 12px;
    font-weight: 600;
    z-index: 3;
  }

  .account-warning,
  .account-error {
    position: absolute;
    left: 30px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 600;
    z-index: 3;
    max-width: 420px;
  }

  .account-warning {
    top: 24px;
    background: rgba(245, 158, 11, 0.13);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fbbf24;
  }

  .account-error {
    top: 64px;
    background: rgba(239, 68, 68, 0.14);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
  }

  .account-warning-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .panel-overlay {
    position: absolute;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .panel-card {
    width: 100%;
    max-width: 430px;
    background: #121212;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow: 0 24px 56px rgba(0, 0, 0, 0.5);
    padding: 22px;
    position: relative;
  }

  .panel-close {
    position: absolute;
    top: 10px;
    right: 10px;
    border: none;
    background: transparent;
    color: #9ca3af;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;
  }

  .panel-close:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f3f4f6;
  }

  .panel-close-icon {
    width: 16px;
    height: 16px;
  }

  .panel-title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
  }

  .panel-subtitle {
    margin: 8px 0 18px;
    font-size: 13px;
    color: #9ca3af;
  }

  .panel-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .panel-action {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 12px 14px;
    color: #f9fafb;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .panel-action.microsoft {
    background: rgba(34, 197, 94, 0.16);
    border-color: rgba(34, 197, 94, 0.38);
  }

  .panel-action.microsoft:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.24);
  }

  .panel-action.offline {
    background: rgba(59, 130, 246, 0.17);
    border-color: rgba(59, 130, 246, 0.38);
  }

  .panel-action.offline:hover {
    background: rgba(59, 130, 246, 0.25);
  }

  .panel-action:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .panel-action-icon {
    width: 16px;
    height: 16px;
  }

  .panel-action-icon.spinning {
    animation: spin 1.1s linear infinite;
  }

  .offline-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .offline-input {
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.04);
    color: #f9fafb;
    border-radius: 10px;
    padding: 11px 12px;
    outline: none;
    font-size: 14px;
    box-sizing: border-box;
  }

  .offline-input:focus {
    border-color: rgba(96, 165, 250, 0.75);
    box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
  }

  .offline-form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .secondary-btn,
  .primary-btn {
    border: none;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 700;
    padding: 10px 14px;
    cursor: pointer;
    transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease;
  }

  .secondary-btn {
    background: rgba(255, 255, 255, 0.1);
    color: #d1d5db;
  }

  .secondary-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .primary-btn {
    background: #2563eb;
    color: #ffffff;
  }

  .primary-btn:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.5;
      transform: scale(1.2);
    }
  }
</style>
