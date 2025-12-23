import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { BrowserWindow } from 'electron';
import type {
  AccountProfile,
  AccountsStatePayload,
  AccountSelectionPayload,
  AccountType,
  OfflineAccountRequestPayload,
} from '@shindo/shared';
import { getBaseDataDir } from '../utils/pathResolver';

interface StoredAccountBase {
  id: string;
  type: AccountType;
  username: string;
  uuid: string;
  createdAt: number;
  lastUsedAt?: number;
  skinUrl?: string | null;
  clientToken: string;
}

interface StoredOfflineAccount extends StoredAccountBase {
  type: 'offline';
}

interface StoredMicrosoftAccount extends StoredAccountBase {
  type: 'microsoft';
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
}

type StoredAccount = StoredOfflineAccount | StoredMicrosoftAccount;

interface AccountsFileState {
  accounts: StoredAccount[];
  activeAccountId: string | null;
}

interface MicrosoftTokenResponse {
  token_type: string;
  scope: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

interface XboxAuthResponse {
  Token: string;
  DisplayClaims: {
    xui: Array<{ uhs: string }>;
  };
  NotAfter?: string;
}

interface MinecraftAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface MinecraftProfileResponse {
  id: string;
  name: string;
  skins?: Array<{ id: string; state: 'ACTIVE' | 'INACTIVE'; url: string }>;
}

export interface LaunchAccountContext {
  type: AccountType | 'guest';
  username: string;
  uuid: string;
  accessToken?: string;
  clientToken: string;
}

type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

type FetchFn = (input: string, init?: Record<string, unknown>) => Promise<FetchResponse>;

let cachedFetch: FetchFn | null = null;

const ACCOUNTS_LIMIT = 6;
const STATE_FILE = path.join(getBaseDataDir(), 'accounts.json');
const DEFAULT_REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
const MICROSOFT_CLIENT_ID = '00000000402b5328';
const MICROSOFT_SCOPE = 'XboxLive.signin offline_access';

function now(): number {
  return Date.now();
}

function createDefaultState(): AccountsFileState {
  return {
    accounts: [],
    activeAccountId: null,
  };
}

function ensureDirectory(): void {
  const dir = path.dirname(STATE_FILE);
  fs.mkdirSync(dir, { recursive: true });
}

function readStateFromDisk(): AccountsFileState {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as AccountsFileState;
    if (!parsed.accounts || !Array.isArray(parsed.accounts)) {
      return createDefaultState();
    }
    return parsed;
  } catch {
    return createDefaultState();
  }
}

function writeStateToDisk(state: AccountsFileState): void {
  ensureDirectory();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function normalizeUsername(input: string): string {
  return input.trim().replace(/\s+/g, '').slice(0, 16);
}

function generateOfflineUuid(username: string): string {
  const hash = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.toString('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20),
  ].join('-');
}

function resolveSkinUrl(usernameOrUuid: string): string {
  return `https://mc-heads.net/avatar/${usernameOrUuid}/96`;
}

function generateClientToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function getFetch(): Promise<FetchFn> {
  if (cachedFetch) return cachedFetch;

  const nativeFetch = (globalThis as Record<string, unknown>).fetch;
  if (typeof nativeFetch === 'function') {
    cachedFetch = nativeFetch as FetchFn;
    return cachedFetch;
  }

  const mod = await import('node-fetch');
  const impl = (mod as Record<string, unknown>).default ?? mod;
  cachedFetch = impl as FetchFn;
  return cachedFetch;
}

function mapToProfile(account: StoredAccount): AccountProfile {
  return {
    id: account.id,
    type: account.type,
    username: account.username,
    uuid: account.uuid,
    createdAt: account.createdAt,
    lastUsedAt: account.lastUsedAt,
    skinUrl: account.skinUrl ?? resolveSkinUrl(account.uuid || account.username),
  };
}

async function fetchJson<T>(url: string, init: Record<string, unknown> = {}): Promise<T> {
  const fetch = await getFetch();
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao chamar ${url}: ${response.status} ${response.statusText} - ${body}`);
  }
  return (await response.json()) as T;
}

async function exchangeCodeForTokens(authCode: string): Promise<MicrosoftTokenResponse> {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    code: authCode,
    grant_type: 'authorization_code',
    redirect_uri: DEFAULT_REDIRECT_URI,
    scope: MICROSOFT_SCOPE,
  });

  return fetchJson<MicrosoftTokenResponse>('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
}

async function exchangeRefreshToken(refreshToken: string): Promise<MicrosoftTokenResponse> {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    redirect_uri: DEFAULT_REDIRECT_URI,
    scope: MICROSOFT_SCOPE,
  });

  return fetchJson<MicrosoftTokenResponse>('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
}

async function requestXboxUserToken(accessToken: string): Promise<XboxAuthResponse> {
  return fetchJson<XboxAuthResponse>('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${accessToken}`,
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }),
  });
}

async function requestXstsToken(userToken: string): Promise<XboxAuthResponse> {
  return fetchJson<XboxAuthResponse>('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [userToken],
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    }),
  });
}

async function loginWithXbox(identityToken: string): Promise<MinecraftAuthResponse> {
  return fetchJson<MinecraftAuthResponse>('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityToken }),
  });
}

async function fetchMinecraftProfile(accessToken: string): Promise<MinecraftProfileResponse> {
  return fetchJson<MinecraftProfileResponse>('https://api.minecraftservices.com/minecraft/profile', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function performMicrosoftOAuth(parent?: BrowserWindow): Promise<MicrosoftTokenResponse> {
  const authUrl = new URL('https://login.live.com/oauth20_authorize.srf');
  authUrl.searchParams.set('client_id', MICROSOFT_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', DEFAULT_REDIRECT_URI);
  authUrl.searchParams.set('scope', MICROSOFT_SCOPE);
  authUrl.searchParams.set('prompt', 'select_account');

  return new Promise<MicrosoftTokenResponse>((resolve, reject) => {
    let completed = false;
    const loginWindow = new BrowserWindow({
      parent,
      modal: true,
      width: 460,
      height: 640,
      title: 'Entrar com Microsoft',
      resizable: false,
      backgroundColor: '#0f172a',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    function cleanup(): void {
      loginWindow.removeAllListeners();
      if (!loginWindow.isDestroyed()) {
        loginWindow.close();
      }
    }

    loginWindow.webContents.on('will-redirect', (_event, url) => {
      if (!url.startsWith(DEFAULT_REDIRECT_URI)) {
        return;
      }

      const nextUrl = new URL(url);
      const code = nextUrl.searchParams.get('code');
      const error = nextUrl.searchParams.get('error');

      if (code) {
        _event.preventDefault();
        completed = true;
        cleanup();
        exchangeCodeForTokens(code).then(resolve).catch(reject);
      } else if (error) {
        completed = true;
        cleanup();
        reject(new Error(`Login Microsoft falhou: ${error}`));
      }
    });

    loginWindow.on('closed', () => {
      if (!completed) {
        reject(new Error('Login cancelado pelo usuario.'));
      }
    });

    loginWindow.loadURL(authUrl.toString()).catch((error) => {
      cleanup();
      reject(error);
    });
  });
}

export class AccountService {
  private state: AccountsFileState;
  private loginInFlight = false;

  constructor() {
    this.state = readStateFromDisk();
  }

  private persist(): void {
    writeStateToDisk(this.state);
  }

  private ensureLimitAvailable(): void {
    if (this.state.accounts.length >= ACCOUNTS_LIMIT) {
      throw new Error(`Limite de ${ACCOUNTS_LIMIT} contas atingido.`);
    }
  }

  private findAccount(accountId: string): StoredAccount | undefined {
    return this.state.accounts.find((account) => account.id === accountId);
  }

  private upsertAccount(account: StoredAccount): void {
    const index = this.state.accounts.findIndex((item) => item.id === account.id);
    if (index >= 0) {
      this.state.accounts[index] = account;
    } else {
      this.state.accounts.push(account);
    }
  }

  private selectAccountInternal(accountId: string): void {
    this.state.activeAccountId = accountId;
  }

  private get parentWindow(): BrowserWindow | undefined {
    return BrowserWindow.getAllWindows().find((wnd) => wnd.isVisible()) ?? undefined;
  }

  getPublicState(): AccountsStatePayload {
    return {
      accounts: this.state.accounts.map(mapToProfile),
      activeAccountId: this.state.activeAccountId,
      limit: ACCOUNTS_LIMIT,
    };
  }

  async addOfflineAccount(payload: OfflineAccountRequestPayload): Promise<AccountsStatePayload> {
    this.ensureLimitAvailable();
    const username = normalizeUsername(payload.username);
    if (!username) {
      throw new Error('Informe um nome valido.');
    }

    const nowTs = now();
    const account: StoredOfflineAccount = {
      id: crypto.randomUUID(),
      type: 'offline',
      username,
      uuid: generateOfflineUuid(username),
      createdAt: nowTs,
      lastUsedAt: nowTs,
      clientToken: generateClientToken(),
      skinUrl: resolveSkinUrl(username),
    };

    this.upsertAccount(account);
    if (!this.state.activeAccountId) {
      this.selectAccountInternal(account.id);
    }
    this.persist();
    return this.getPublicState();
  }

  async addMicrosoftAccount(): Promise<AccountsStatePayload> {
    this.ensureLimitAvailable();
    if (this.loginInFlight) {
      throw new Error('Ja existe um login Microsoft em andamento.');
    }

    this.loginInFlight = true;
    try {
      const parent = this.parentWindow;
      const tokenResponse = await performMicrosoftOAuth(parent);

      const account = await this.buildMicrosoftAccountFromTokens(tokenResponse);
      this.upsertAccount(account);
      this.selectAccountInternal(account.id);
      this.persist();
      return this.getPublicState();
    } finally {
      this.loginInFlight = false;
    }
  }

  async removeAccount(payload: AccountSelectionPayload): Promise<AccountsStatePayload> {
    const previousLength = this.state.accounts.length;
    this.state.accounts = this.state.accounts.filter((account) => account.id !== payload.accountId);
    if (previousLength === this.state.accounts.length) {
      throw new Error('Conta nao encontrada.');
    }

    if (this.state.activeAccountId === payload.accountId) {
      this.state.activeAccountId = this.state.accounts[0]?.id ?? null;
    }

    this.persist();
    return this.getPublicState();
  }

  async selectAccount(payload: AccountSelectionPayload): Promise<AccountsStatePayload> {
    const target = this.findAccount(payload.accountId);
    if (!target) {
      throw new Error('Conta nao encontrada.');
    }
    this.selectAccountInternal(target.id);
    target.lastUsedAt = now();
    this.persist();
    return this.getPublicState();
  }

  getActiveAccount(): StoredAccount | null {
    if (!this.state.activeAccountId) return null;
    return this.findAccount(this.state.activeAccountId) ?? null;
  }

  private async buildMicrosoftAccountFromTokens(
    tokenResponse: MicrosoftTokenResponse,
  ): Promise<StoredMicrosoftAccount> {
    const nowTs = now();
    const accessTokenExpiresAt = nowTs + (tokenResponse.expires_in - 60) * 1000;

    const { profile, refreshToken, accessToken } =
      await this.resolveMinecraftProfileFromTokens(tokenResponse);

    return {
      id: crypto.randomUUID(),
      type: 'microsoft',
      username: profile.name,
      uuid: profile.id,
      createdAt: nowTs,
      lastUsedAt: nowTs,
      skinUrl: profile.skins?.find((skin) => skin.state === 'ACTIVE')?.url ?? resolveSkinUrl(profile.id),
      refreshToken,
      accessToken,
      accessTokenExpiresAt,
      clientToken: generateClientToken(),
    };
  }

  private async ensureFreshMicrosoftTokens(
    account: StoredMicrosoftAccount,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (account.accessToken && account.accessTokenExpiresAt > now() + 60000) {
      return { accessToken: account.accessToken, refreshToken: account.refreshToken };
    }

    const refreshed = await exchangeRefreshToken(account.refreshToken);
    account.refreshToken = refreshed.refresh_token ?? account.refreshToken;
    account.accessToken = refreshed.access_token;
    account.accessTokenExpiresAt = now() + (refreshed.expires_in - 60) * 1000;
    this.persist();
    return { accessToken: account.accessToken, refreshToken: account.refreshToken };
  }

  private async resolveMinecraftProfileFromTokens(tokens: MicrosoftTokenResponse): Promise<{
    profile: MinecraftProfileResponse;
    accessToken: string;
    refreshToken: string;
  }> {
    const userToken = await requestXboxUserToken(tokens.access_token);
    const xsts = await requestXstsToken(userToken.Token);
    const uhs = xsts.DisplayClaims?.xui?.[0]?.uhs;
    if (!uhs) {
      throw new Error('Resposta XSTS invalida. Nenhum UHS retornado.');
    }
    const identityToken = `XBL3.0 x=${uhs};${xsts.Token}`;
    const minecraftAuth = await loginWithXbox(identityToken);
    const profile = await fetchMinecraftProfile(minecraftAuth.access_token);
    if (!profile?.id) {
      throw new Error('Conta Microsoft nao possui Minecraft Java.');
    }

    return {
      profile,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
  }

  private async refreshMicrosoftAccount(
    account: StoredMicrosoftAccount,
  ): Promise<LaunchAccountContext> {
    const tokens = await this.ensureFreshMicrosoftTokens(account);
    const userToken = await requestXboxUserToken(tokens.accessToken);
    const xsts = await requestXstsToken(userToken.Token);
    const uhs = xsts.DisplayClaims?.xui?.[0]?.uhs;
    if (!uhs) {
      throw new Error('Falha ao obter identificador do jogador.');
    }
    const identityToken = `XBL3.0 x=${uhs};${xsts.Token}`;
    const minecraftAuth = await loginWithXbox(identityToken);
    const profile = await fetchMinecraftProfile(minecraftAuth.access_token);

    account.username = profile.name;
    account.uuid = profile.id;
    account.lastUsedAt = now();
    account.skinUrl = profile.skins?.find((skin) => skin.state === 'ACTIVE')?.url ?? account.skinUrl;

    this.persist();

    return {
      type: 'microsoft',
      username: profile.name,
      uuid: profile.id,
      accessToken: minecraftAuth.access_token,
      clientToken: account.clientToken,
    };
  }

  async getLaunchContext(): Promise<LaunchAccountContext> {
    const active = this.getActiveAccount();
    if (!active) {
      return {
        type: 'guest',
        username: 'ShindoPlayer',
        uuid: generateOfflineUuid('ShindoPlayer'),
        clientToken: generateClientToken(),
      };
    }

    if (active.type === 'offline') {
      return {
        type: 'offline',
        username: active.username,
        uuid: active.uuid,
        clientToken: active.clientToken,
      };
    }

    return this.refreshMicrosoftAccount(active);
  }
}

export const accountService = new AccountService();

