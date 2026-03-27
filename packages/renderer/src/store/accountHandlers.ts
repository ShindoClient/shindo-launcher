import type { Writable } from 'svelte/store';
import type { AccountsStatePayload } from '@shindo/shared';
import type { AppState } from './appStore';

function applyAccountsPayload(state: AppState, payload: AccountsStatePayload): AppState {
  return {
    ...state,
    accounts: {
      entries: payload.accounts,
      activeAccountId: payload.activeAccountId,
      limit: payload.limit,
      loading: false,
      loginInProgress: false,
      error: undefined,
    },
  };
}

interface AccountDeps {
  store: Writable<AppState>;
}

export function createAccountHandlers({ store }: AccountDeps) {
  async function refreshAccounts(): Promise<void> {
    store.update((state) => ({
      ...state,
      accounts: {
        ...state.accounts,
        loading: true,
        error: undefined,
      },
    }));

    try {
      const payload = await window.shindo.getAccounts();
      store.update((state) => applyAccountsPayload(state, payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.update((state) => ({
        ...state,
        accounts: {
          ...state.accounts,
          loading: false,
          error: message,
        },
      }));
      throw error;
    }
  }

  async function addOfflineAccount(username: string): Promise<void> {
    store.update((state) => ({
      ...state,
      accounts: {
        ...state.accounts,
        loading: true,
        error: undefined,
      },
    }));

    try {
      const payload = await window.shindo.addOfflineAccount({ username });
      store.update((state) => applyAccountsPayload(state, payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.update((state) => ({
        ...state,
        accounts: {
          ...state.accounts,
          loading: false,
          error: message,
        },
      }));
      throw error;
    }
  }

  async function addMicrosoftAccount(): Promise<void> {
    store.update((state) => ({
      ...state,
      accounts: {
        ...state.accounts,
        loginInProgress: true,
        error: undefined,
      },
    }));

    try {
      const payload = await window.shindo.addMicrosoftAccount();
      store.update((state) => applyAccountsPayload(state, payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.update((state) => ({
        ...state,
        accounts: {
          ...state.accounts,
          loginInProgress: false,
          error: message,
        },
      }));
      throw error;
    }
  }

  async function removeAccount(accountId: string): Promise<void> {
    store.update((state) => ({
      ...state,
      accounts: {
        ...state.accounts,
        loading: true,
        error: undefined,
      },
    }));

    try {
      const payload = await window.shindo.removeAccount({ accountId });
      store.update((state) => applyAccountsPayload(state, payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.update((state) => ({
        ...state,
        accounts: {
          ...state.accounts,
          loading: false,
          error: message,
        },
      }));
      throw error;
    }
  }

  async function selectAccount(accountId: string): Promise<void> {
    store.update((state) => ({
      ...state,
      accounts: {
        ...state.accounts,
        loading: true,
        error: undefined,
      },
    }));

    try {
      const payload = await window.shindo.selectAccount({ accountId });
      store.update((state) => applyAccountsPayload(state, payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      store.update((state) => ({
        ...state,
        accounts: {
          ...state.accounts,
          loading: false,
          error: message,
        },
      }));
      throw error;
    }
  }

  return {
    refreshAccounts,
    addOfflineAccount,
    addMicrosoftAccount,
    removeAccount,
    selectAccount,
  };
}
