export type AccountType = 'offline' | 'microsoft';
export interface AccountProfile {
    id: string;
    type: AccountType;
    username: string;
    uuid: string;
    createdAt: number;
    lastUsedAt?: number;
    skinUrl?: string | null;
}
export interface AccountsState {
    accounts: AccountProfile[];
    activeAccountId: string | null;
    limit: number;
}
export interface AddOfflineAccountPayload {
    username: string;
}
export interface AccountSelectionPayload {
    accountId: string;
}
