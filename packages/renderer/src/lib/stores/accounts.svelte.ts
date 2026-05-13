import type { AccountsState, AccountProfile } from '@shindo/shared';

class AccountsStore {
  state = $state<AccountsState>({ accounts: [], activeAccountId: null, limit: 6 });
  loading = $state(false);
  adding = $state(false);
  error = $state<string | null>(null);

  accounts = $derived(this.state.accounts);
  activeId = $derived(this.state.activeAccountId);
  limit = $derived(this.state.limit);
  atLimit = $derived(this.state.accounts.length >= this.state.limit);

  activeAccount = $derived(
    this.state.accounts.find((a) => a.id === this.state.activeAccountId) ?? null,
  );

  async load(): Promise<void> {
    this.loading = true;
    try {
      this.state = await window.shindo.getAccounts();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  async addOffline(username: string): Promise<void> {
    this.adding = true;
    this.error = null;
    try {
      this.state = await window.shindo.addOfflineAccount({ username });
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this.adding = false;
    }
  }

  async addMicrosoft(): Promise<void> {
    this.adding = true;
    this.error = null;
    try {
      this.state = await window.shindo.addMicrosoftAccount();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this.adding = false;
    }
  }

  async remove(accountId: string): Promise<void> {
    try {
      this.state = await window.shindo.removeAccount({ accountId });
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async select(accountId: string): Promise<void> {
    // Optimistic
    const prev = this.state;
    this.state = { ...this.state, activeAccountId: accountId };
    try {
      this.state = await window.shindo.selectAccount({ accountId });
    } catch {
      this.state = prev;
    }
  }

  clearError(): void {
    this.error = null;
  }
}

export const accountsStore = new AccountsStore();
