import { ipcMain } from 'electron';
import { IpcChannel } from '@shindo/shared';
import type { AddOfflineAccountPayload, AccountSelectionPayload } from '@shindo/shared';
import {
  getAccountsState,
  addOfflineAccount,
  addMicrosoftAccount,
  removeAccount,
  selectAccount,
} from '../../services/account/accountService';

export function registerAccountHandlers(): void {
  ipcMain.handle(IpcChannel.AccountsList, () => getAccountsState());

  ipcMain.handle(IpcChannel.AccountsAddOffline, (_e, payload: AddOfflineAccountPayload) =>
    addOfflineAccount(payload),
  );

  ipcMain.handle(IpcChannel.AccountsAddMicrosoft, () => addMicrosoftAccount());

  ipcMain.handle(IpcChannel.AccountsRemove, (_e, payload: AccountSelectionPayload) =>
    removeAccount(payload),
  );

  ipcMain.handle(IpcChannel.AccountsSelect, (_e, payload: AccountSelectionPayload) =>
    selectAccount(payload),
  );
}
