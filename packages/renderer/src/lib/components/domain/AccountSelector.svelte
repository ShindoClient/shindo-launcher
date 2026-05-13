<script lang="ts">
  import { accountsStore } from '$lib/stores/accounts.svelte';
  import { t } from '$lib/i18n';
  import type { AccountProfile } from '@shindo/shared';

  let showPanel = $state(false);
  let confirmRemoveId = $state<string | null>(null);
  let offlineUsername = $state('');
  let addMode = $state<'none' | 'offline' | 'microsoft'>('none');

  async function selectAccount(id: string) {
    await accountsStore.select(id);
  }

  async function removeAccount(id: string) {
    if (confirmRemoveId !== id) {
      confirmRemoveId = id;
      setTimeout(() => {
        if (confirmRemoveId === id) confirmRemoveId = null;
      }, 3000);
      return;
    }
    confirmRemoveId = null;
    await accountsStore.remove(id);
  }

  async function addOffline() {
    if (!offlineUsername.trim()) return;
    await accountsStore.addOffline(offlineUsername.trim());
    offlineUsername = '';
    addMode = 'none';
  }

  async function addMicrosoft() {
    addMode = 'microsoft';
    await accountsStore.addMicrosoft().catch(() => {});
    addMode = 'none';
  }

  function avatarUrl(account: AccountProfile): string {
    if (account.skinUrl) return account.skinUrl;
    return `https://mc-heads.net/avatar/${account.uuid}/32`;
  }
</script>

<div class="account-selector">
  <button
    class="selector-toggle"
    onclick={() => {
      showPanel = !showPanel;
    }}
  >
    {#if accountsStore.activeAccount}
      <img
        src={avatarUrl(accountsStore.activeAccount)}
        alt={accountsStore.activeAccount.username}
        class="selector-avatar"
      />
      <span class="selector-name">{accountsStore.activeAccount.username}</span>
    {:else}
      <span class="selector-name selector-name--empty">{t('accounts.empty')}</span>
    {/if}
    <span class="selector-caret" class:selector-caret--open={showPanel}>▾</span>
  </button>

  {#if showPanel}
    <div class="account-panel">
      <div class="panel-header">
        <span class="panel-title">{t('accounts.title')}</span>
        <span class="panel-count">{accountsStore.accounts.length}/{accountsStore.limit}</span>
      </div>

      <ul class="account-list">
        {#each accountsStore.accounts as account (account.id)}
          <li
            class="account-item"
            class:account-item--active={account.id === accountsStore.activeId}
          >
            <button
              class="account-select-btn"
              onclick={() => selectAccount(account.id)}
              title={account.type === 'microsoft' ? 'Microsoft' : 'Offline'}
            >
              <img src={avatarUrl(account)} alt={account.username} class="account-avatar" />
              <div class="account-info">
                <span class="account-name">{account.username}</span>
                <span class="account-type">{account.type}</span>
              </div>
              {#if account.id === accountsStore.activeId}
                <span class="account-active-dot"></span>
              {/if}
            </button>

            <button
              class="account-remove-btn"
              class:account-remove-btn--confirm={confirmRemoveId === account.id}
              onclick={() => removeAccount(account.id)}
              title={confirmRemoveId === account.id
                ? t('accounts.confirmRemove')
                : t('accounts.remove')}
            >
              {confirmRemoveId === account.id ? '?' : '×'}
            </button>
          </li>
        {/each}

        {#if accountsStore.accounts.length === 0}
          <li class="account-empty">{t('accounts.empty')}</li>
        {/if}
      </ul>

      {#if !accountsStore.atLimit}
        <div class="add-section">
          {#if addMode === 'offline'}
            <div class="add-offline-form">
              <input
                class="add-input"
                bind:value={offlineUsername}
                placeholder={t('accounts.offlineNamePlaceholder')}
                maxlength={16}
                onkeydown={(e) => e.key === 'Enter' && addOffline()}
              />
              <button
                class="btn btn--sm btn--primary"
                onclick={addOffline}
                disabled={!offlineUsername.trim()}
              >
                {t('accounts.offlineAdd')}
              </button>
              <button
                class="btn btn--sm"
                onclick={() => {
                  addMode = 'none';
                  offlineUsername = '';
                }}
              >
                {t('common.cancel')}
              </button>
            </div>
          {:else}
            <button
              class="add-btn"
              onclick={() => {
                addMode = 'offline';
              }}
            >
              + {t('accounts.offline')}
            </button>
            <button
              class="add-btn add-btn--microsoft"
              onclick={addMicrosoft}
              disabled={accountsStore.adding}
            >
              {accountsStore.adding && addMode === 'microsoft'
                ? t('accounts.addingMicrosoft')
                : `+ ${t('accounts.microsoft')}`}
            </button>
          {/if}
        </div>
      {:else}
        <p class="add-limit">{t('accounts.limitReached', { limit: accountsStore.limit })}</p>
      {/if}

      {#if accountsStore.error}
        <p class="add-error">{accountsStore.error}</p>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  .account-selector {
    position: relative;
  }

  .selector-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    background: rgba(255 255 255 / 0.07);
    border: 1px solid var(--color-border-subtle);
    border-radius: 8px;
    cursor: pointer;
    color: var(--color-text-primary);
    transition:
      background 0.12s,
      border-color 0.12s;
    min-width: 180px;

    &:hover {
      background: rgba(255 255 255 / 0.11);
      border-color: var(--color-border);
    }
  }

  .selector-avatar {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    image-rendering: pixelated;
  }

  .selector-name {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    text-align: left;

    &--empty {
      color: var(--color-text-muted);
      font-weight: 400;
    }
  }

  .selector-caret {
    font-size: 11px;
    color: var(--color-text-muted);
    transition: transform 0.15s;

    &--open {
      transform: scaleY(-1);
    }
  }

  .account-panel {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    width: 280px;
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0 0 0 / 0.45);
    z-index: 100;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 8px;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .panel-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    text-transform: uppercase;
  }

  .panel-count {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .account-list {
    list-style: none;
    margin: 0;
    padding: 6px;
    max-height: 220px;
    overflow-y: auto;
  }

  .account-item {
    display: flex;
    align-items: center;
    border-radius: 6px;
    overflow: hidden;

    &--active {
      background: rgba(255 255 255 / 0.06);
    }
  }

  .account-select-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    color: var(--color-text-primary);
    border-radius: 6px;
    transition: background 0.1s;

    &:hover {
      background: rgba(255 255 255 / 0.06);
    }
  }

  .account-avatar {
    width: 32px;
    height: 32px;
    border-radius: 4px;
    image-rendering: pixelated;
    flex-shrink: 0;
  }

  .account-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .account-name {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .account-type {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: capitalize;
  }

  .account-active-dot {
    width: 6px;
    height: 6px;
    background: var(--color-success);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .account-remove-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 4px;
    font-size: 16px;
    flex-shrink: 0;
    margin-right: 4px;
    transition:
      background 0.1s,
      color 0.1s;

    &:hover {
      background: rgba(255 255 255 / 0.08);
      color: var(--color-danger);
    }
    &--confirm {
      color: var(--color-danger);
      background: rgba(var(--color-danger-rgb) / 0.15);
    }
  }

  .account-empty {
    padding: 16px;
    text-align: center;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .add-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px 10px;
    border-top: 1px solid var(--color-border-subtle);
  }

  .add-btn {
    width: 100%;
    padding: 8px 12px;
    background: rgba(255 255 255 / 0.05);
    border: 1px solid var(--color-border-subtle);
    border-radius: 6px;
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    transition:
      background 0.1s,
      border-color 0.1s;

    &:hover:not(:disabled) {
      background: rgba(255 255 255 / 0.09);
      border-color: var(--color-border);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &--microsoft {
      border-color: rgba(255 255 255 / 0.12);
      color: var(--color-text-primary);
    }
  }

  .add-offline-form {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .add-input {
    flex: 1;
    padding: 7px 10px;
    background: var(--color-bg-input);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-primary);
    font-size: 12px;
    outline: none;
    min-width: 0;

    &:focus {
      border-color: var(--color-accent);
    }
  }

  .btn {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    background: rgba(255 255 255 / 0.08);
    color: var(--color-text-secondary);
    transition: opacity 0.1s;

    &:hover:not(:disabled) {
      opacity: 0.8;
    }
    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    &--primary {
      background: var(--color-accent);
      color: #fff;
    }
    &--sm {
      padding: 5px 10px;
      font-size: 11px;
    }
  }

  .add-limit,
  .add-error {
    font-size: 11px;
    text-align: center;
    margin: 0;
    padding: 4px 10px 8px;
  }

  .add-limit {
    color: var(--color-text-muted);
  }
  .add-error {
    color: var(--color-danger);
  }
</style>
