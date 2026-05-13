import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { BrowserWindow } from 'electron';
import { getBaseDataDir } from '../../utils/paths';
import { logMessage } from '../log';
import type {
  AccountProfile,
  AccountsState,
  AddOfflineAccountPayload,
  AccountSelectionPayload,
  AccountType,
} from '@shindo/shared';

const ACCOUNTS_FILE = 'accounts.json';
const ACCOUNTS_LIMIT = 6;
const MS_CLIENT_ID = '00000000402b5328';
const MS_REDIRECT = 'https://login.live.com/oauth20_desktop.srf';
const MS_SCOPE = 'XboxLive.signin offline_access';

// ─── Storage types ────────────────────────────────────────────────────────────

interface StoredBase {
  id: string;
  type: AccountType;
  username: string;
  uuid: string;
  createdAt: number;
  lastUsedAt?: number;
  skinUrl?: string | null;
  clientToken: string;
}

interface StoredOffline extends StoredBase {
  type: 'offline';
}

interface StoredMicrosoft extends StoredBase {
  type: 'microsoft';
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
}

type StoredAccount = StoredOffline | StoredMicrosoft;

interface AccountsFile {
  accounts: StoredAccount[];
  activeAccountId: string | null;
}

// ─── File I/O ─────────────────────────────────────────────────────────────────

function accountsFilePath(): string {
  return path.join(getBaseDataDir(), ACCOUNTS_FILE);
}

function readFile(): AccountsFile {
  try {
    const raw = JSON.parse(fs.readFileSync(accountsFilePath(), 'utf8')) as AccountsFile;
    if (!Array.isArray(raw.accounts)) return { accounts: [], activeAccountId: null };
    return raw;
  } catch {
    return { accounts: [], activeAccountId: null };
  }
}

function writeFile(state: AccountsFile): void {
  fs.mkdirSync(path.dirname(accountsFilePath()), { recursive: true });
  fs.writeFileSync(accountsFilePath(), JSON.stringify(state, null, 2), 'utf8');
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function toProfile(stored: StoredAccount): AccountProfile {
  return {
    id: stored.id,
    type: stored.type,
    username: stored.username,
    uuid: stored.uuid,
    createdAt: stored.createdAt,
    lastUsedAt: stored.lastUsedAt,
    skinUrl: stored.skinUrl ?? null,
  };
}

function buildState(file: AccountsFile): AccountsState {
  return {
    accounts: file.accounts.map(toProfile),
    activeAccountId: file.activeAccountId,
    limit: ACCOUNTS_LIMIT,
  };
}

// ─── Microsoft auth helpers ───────────────────────────────────────────────────

async function exchangeMsCodeForTokens(
  code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    code,
    grant_type: 'authorization_code',
    redirect_uri: MS_REDIRECT,
  });
  const res = await fetch('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`MS token exchange failed: ${res.status}`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

async function xblAuth(msAccessToken: string): Promise<{ token: string; uhs: string }> {
  const res = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: msAccessToken,
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }),
  });
  if (!res.ok) throw new Error(`XBL auth failed: ${res.status}`);
  const data = (await res.json()) as {
    Token: string;
    DisplayClaims: { xui: Array<{ uhs: string }> };
  };
  return { token: data.Token, uhs: data.DisplayClaims.xui[0]?.uhs ?? '' };
}

async function xstsAuth(xblToken: string): Promise<{ token: string; uhs: string }> {
  const res = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    }),
  });
  if (!res.ok) throw new Error(`XSTS auth failed: ${res.status}`);
  const data = (await res.json()) as {
    Token: string;
    DisplayClaims: { xui: Array<{ uhs: string }> };
  };
  return { token: data.Token, uhs: data.DisplayClaims.xui[0]?.uhs ?? '' };
}

async function mcAuth(
  xstsToken: string,
  uhs: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${uhs};${xstsToken}` }),
  });
  if (!res.ok) throw new Error(`MC auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

async function fetchMcProfile(
  accessToken: string,
): Promise<{ id: string; name: string; skinUrl: string | null }> {
  const res = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`MC profile fetch failed: ${res.status}`);
  const data = (await res.json()) as {
    id: string;
    name: string;
    skins?: Array<{ state: string; url: string }>;
  };
  const activeSkin = data.skins?.find((s) => s.state === 'ACTIVE');
  return { id: data.id, name: data.name, skinUrl: activeSkin?.url ?? null };
}

function openMicrosoftAuthWindow(): Promise<string> {
  return new Promise((resolve, reject) => {
    const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${MS_CLIENT_ID}&response_type=code&scope=${encodeURIComponent(MS_SCOPE)}&redirect_uri=${encodeURIComponent(MS_REDIRECT)}`;

    const win = new BrowserWindow({
      width: 520,
      height: 660,
      show: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    win.loadURL(authUrl);

    win.webContents.on('will-redirect', (_e, url) => {
      const parsed = new URL(url);
      if (parsed.hostname === 'login.live.com' && parsed.pathname === '/oauth20_desktop.srf') {
        const code = parsed.searchParams.get('code');
        win.close();
        if (code) resolve(code);
        else reject(new Error('Auth cancelled or code missing'));
      }
    });

    win.on('closed', () => reject(new Error('Auth window closed')));
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAccountsState(): AccountsState {
  return buildState(readFile());
}

export function addOfflineAccount(payload: AddOfflineAccountPayload): AccountsState {
  const file = readFile();
  const username = payload.username.trim();

  if (!username || username.length < 2 || username.length > 16) {
    throw new Error('Invalid username (2–16 characters)');
  }
  if (file.accounts.length >= ACCOUNTS_LIMIT) {
    throw new Error(`Account limit reached (${ACCOUNTS_LIMIT})`);
  }
  if (
    file.accounts.some(
      (a) => a.type === 'offline' && a.username.toLowerCase() === username.toLowerCase(),
    )
  ) {
    throw new Error('An offline account with that username already exists');
  }

  const account: StoredOffline = {
    id: crypto.randomUUID(),
    type: 'offline',
    username,
    uuid: crypto.randomUUID(),
    createdAt: Date.now(),
    clientToken: crypto.randomBytes(16).toString('hex'),
    skinUrl: null,
  };

  file.accounts.push(account);
  if (!file.activeAccountId) file.activeAccountId = account.id;

  writeFile(file);
  logMessage('info', `Added offline account: ${username}`);
  return buildState(file);
}

export async function addMicrosoftAccount(): Promise<AccountsState> {
  const file = readFile();

  if (file.accounts.length >= ACCOUNTS_LIMIT) {
    throw new Error(`Account limit reached (${ACCOUNTS_LIMIT})`);
  }

  const code = await openMicrosoftAuthWindow();
  const msTokens = await exchangeMsCodeForTokens(code);
  const xbl = await xblAuth(msTokens.accessToken);
  const xsts = await xstsAuth(xbl.token);
  const mc = await mcAuth(xsts.token, xsts.uhs);
  const profile = await fetchMcProfile(mc.accessToken);

  const account: StoredMicrosoft = {
    id: crypto.randomUUID(),
    type: 'microsoft',
    username: profile.name,
    uuid: profile.id,
    createdAt: Date.now(),
    clientToken: crypto.randomBytes(16).toString('hex'),
    skinUrl: profile.skinUrl,
    refreshToken: msTokens.refreshToken,
    accessToken: mc.accessToken,
    accessTokenExpiresAt: Date.now() + mc.expiresIn * 1000,
  };

  file.accounts.push(account);
  if (!file.activeAccountId) file.activeAccountId = account.id;

  writeFile(file);
  logMessage('info', `Added Microsoft account: ${profile.name}`);
  return buildState(file);
}

export function removeAccount(payload: AccountSelectionPayload): AccountsState {
  const file = readFile();
  const idx = file.accounts.findIndex((a) => a.id === payload.accountId);
  if (idx === -1) throw new Error('Account not found');

  file.accounts.splice(idx, 1);

  if (file.activeAccountId === payload.accountId) {
    file.activeAccountId = file.accounts[0]?.id ?? null;
  }

  writeFile(file);
  return buildState(file);
}

export function selectAccount(payload: AccountSelectionPayload): AccountsState {
  const file = readFile();
  const account = file.accounts.find((a) => a.id === payload.accountId);
  if (!account) throw new Error('Account not found');

  account.lastUsedAt = Date.now();
  file.activeAccountId = account.id;

  writeFile(file);
  return buildState(file);
}

export interface LaunchAccountContext {
  username: string;
  uuid: string;
  accessToken: string | undefined;
  clientToken: string;
  type: AccountType | 'guest';
}

export async function getLaunchContext(): Promise<LaunchAccountContext> {
  const file = readFile();
  const active = file.accounts.find((a) => a.id === file.activeAccountId) ?? file.accounts[0];

  if (!active) {
    return {
      type: 'guest',
      username: 'Player',
      uuid: crypto.randomUUID(),
      accessToken: undefined,
      clientToken: crypto.randomBytes(16).toString('hex'),
    };
  }

  // Refresh Microsoft token if expired
  if (active.type === 'microsoft') {
    const ms = active as StoredMicrosoft;
    if (ms.accessTokenExpiresAt <= Date.now() + 60_000) {
      try {
        const refreshed = await refreshMicrosoftToken(ms.refreshToken);
        ms.accessToken = refreshed.accessToken;
        ms.accessTokenExpiresAt = refreshed.expiresAt;
        writeFile(file);
      } catch (err) {
        logMessage('warn', `Failed to refresh Microsoft token: ${String(err)}`);
      }
    }
    return {
      type: 'microsoft',
      username: ms.username,
      uuid: ms.uuid,
      accessToken: ms.accessToken,
      clientToken: ms.clientToken,
    };
  }

  return {
    type: 'offline',
    username: active.username,
    uuid: active.uuid,
    accessToken: undefined,
    clientToken: active.clientToken,
  };
}

async function refreshMicrosoftToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
}
