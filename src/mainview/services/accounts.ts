
import { accountState, snapshotState } from "../state/app.svelte";
import { savePersistedState } from "./persistence";
import { getNativeApi } from "./native";

export async function addOfflineAccount(username: string) {
  const normalized = username.trim();
  if (normalized.length < 3) {
    throw new Error("Nickname must have at least 3 characters");
  }

  const api = await getNativeApi();
  const state = await api.addOfflineAccount({ username: normalized });

  accountState.accounts = state.accounts;
  accountState.activeAccountId = state.activeAccountId ?? undefined;
  await savePersistedState(snapshotState());
}

export async function addMicrosoftAccount() {
  const api = await getNativeApi();

  // Opens the Microsoft OAuth window in the native (bun) process.
  // Blocks until the user completes or cancels login.
  const state = await api.addMicrosoftAccount();

  accountState.accounts = state.accounts;
  accountState.activeAccountId = state.activeAccountId ?? undefined;
  await savePersistedState(snapshotState());
}

export async function activateAccount(id: string) {
  const api = await getNativeApi();
  const state = await api.selectAccount({ accountId: id });

  accountState.accounts = state.accounts;
  accountState.activeAccountId = state.activeAccountId ?? undefined;
  await savePersistedState(snapshotState());
}

export async function removeAccount(id: string) {
  const api = await getNativeApi();
  const state = await api.removeAccount({ accountId: id });

  accountState.accounts = state.accounts;
  accountState.activeAccountId = state.activeAccountId ?? undefined;
  await savePersistedState(snapshotState());
}

export async function loadAccounts() {
  const api = await getNativeApi();
  const state = await api.getAccounts();

  accountState.accounts = state.accounts;
  accountState.activeAccountId = state.activeAccountId ?? undefined;
}
