import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { BrowserView, BrowserWindow } from "electrobun/bun";
import { homedir } from "node:os";
import type { AccountProfile, AccountType } from "../shared/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNTS_LIMIT = 6;
const DATA_DIR = path.join(homedir(), ".shindo");
const STATE_FILE = path.join(DATA_DIR, "accounts.json");
const REDIRECT_URI = "https://login.live.com/oauth20_desktop.srf";
const MICROSOFT_CLIENT_ID = "00000000402b5328";
const MICROSOFT_SCOPE = "XboxLive.signin offline_access";

// ─── Stored types (disk representation, includes sensitive fields) ─────────────

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
  type: "offline";
}

interface StoredMicrosoftAccount extends StoredAccountBase {
  type: "microsoft";
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
}

type StoredAccount = StoredOfflineAccount | StoredMicrosoftAccount;

interface AccountsFileState {
  accounts: StoredAccount[];
  activeAccountId: string | null;
}

// ─── Auth API types ───────────────────────────────────────────────────────────

interface MicrosoftTokenResponse {
  token_type: string;
  scope: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

interface XboxAuthResponse {
  Token: string;
  DisplayClaims: { xui: Array<{ uhs: string }> };
}

interface MinecraftAuthResponse {
  access_token: string;
  expires_in: number;
}

interface MinecraftProfileResponse {
  id: string;
  name: string;
  skins?: Array<{ id: string; state: "ACTIVE" | "INACTIVE"; url: string }>;
}

export interface LaunchAccountContext {
  type: AccountType | "guest";
  username: string;
  uuid: string;
  accessToken?: string;
  clientToken: string;
}

// ─── Disk I/O ─────────────────────────────────────────────────────────────────

function readStateFromDisk(): AccountsFileState {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as AccountsFileState;
    if (!Array.isArray(parsed.accounts)) return createDefaultState();
    return parsed;
  } catch {
    return createDefaultState();
  }
}

function writeStateToDisk(state: AccountsFileState): void {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function createDefaultState(): AccountsFileState {
  return { accounts: [], activeAccountId: null };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

function normalizeUsername(input: string): string {
  return input.trim().replace(/\s+/g, "").slice(0, 16);
}

function generateOfflineUuid(username: string): string {
  const hash = crypto
    .createHash("md5")
    .update(`OfflinePlayer:${username}`)
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20),
  ].join("-");
}

function resolveSkinUrl(usernameOrUuid: string): string {
  return `https://mc-heads.net/avatar/${usernameOrUuid}/96`;
}

function generateClientToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

function mapToProfile(account: StoredAccount): AccountProfile {
  return {
    id: account.id,
    type: account.type,
    username: account.username,
    uuid: account.uuid,
    createdAt: account.createdAt,
    lastUsedAt: account.lastUsedAt ?? account.createdAt,
    skinUrl:
      account.skinUrl ?? resolveSkinUrl(account.uuid || account.username),
  };
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Request failed ${url}: ${response.status} ${response.statusText} - ${body}`,
    );
  }
  return (await response.json()) as T;
}

// ─── Microsoft OAuth token exchange ──────────────────────────────────────────

async function exchangeCodeForTokens(
  code: string,
): Promise<MicrosoftTokenResponse> {
  return fetchJson<MicrosoftTokenResponse>(
    "https://login.live.com/oauth20_token.srf",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        scope: MICROSOFT_SCOPE,
      }).toString(),
    },
  );
}

async function exchangeRefreshToken(
  refreshToken: string,
): Promise<MicrosoftTokenResponse> {
  return fetchJson<MicrosoftTokenResponse>(
    "https://login.live.com/oauth20_token.srf",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        redirect_uri: REDIRECT_URI,
        scope: MICROSOFT_SCOPE,
      }).toString(),
    },
  );
}

// ─── Xbox / Minecraft auth chain ──────────────────────────────────────────────

async function requestXboxUserToken(
  accessToken: string,
): Promise<XboxAuthResponse> {
  return fetchJson<XboxAuthResponse>(
    "https://user.auth.xboxlive.com/user/authenticate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        Properties: {
          AuthMethod: "RPS",
          SiteName: "user.auth.xboxlive.com",
          RpsTicket: `d=${accessToken}`,
        },
        RelyingParty: "http://auth.xboxlive.com",
        TokenType: "JWT",
      }),
    },
  );
}

async function requestXstsToken(userToken: string): Promise<XboxAuthResponse> {
  return fetchJson<XboxAuthResponse>(
    "https://xsts.auth.xboxlive.com/xsts/authorize",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        Properties: { SandboxId: "RETAIL", UserTokens: [userToken] },
        RelyingParty: "rp://api.minecraftservices.com/",
        TokenType: "JWT",
      }),
    },
  );
}

async function loginWithXbox(
  identityToken: string,
): Promise<MinecraftAuthResponse> {
  return fetchJson<MinecraftAuthResponse>(
    "https://api.minecraftservices.com/authentication/login_with_xbox",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identityToken }),
    },
  );
}

async function fetchMinecraftProfile(
  accessToken: string,
): Promise<MinecraftProfileResponse> {
  return fetchJson<MinecraftProfileResponse>(
    "https://api.minecraftservices.com/minecraft/profile",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}

// ─── Microsoft OAuth window (ElectroBun) ──────────────────────────────────────
//
// Electron used webContents.on('will-redirect') to intercept the redirect to
// login.live.com/oauth20_desktop.srf before the navigation happened.
//
// ElectroBun equivalent:
//   1. setNavigationRules — blocks the redirect URI at native level so the
//      webview never actually navigates to it (avoids a 404 flash).
//   2. webview.on('will-navigate') — fires for every navigation attempt,
//      including blocked ones. We read `event.data.url` to extract the auth
//      code or error from the query string.
//   3. BrowserWindow.on('close') — handles user cancellation.
//
// ElectroBun has no modal/parent concept, so we use setAlwaysOnTop to keep
// the login window above the launcher.
// ─────────────────────────────────────────────────────────────────────────────

async function performMicrosoftOAuth(): Promise<MicrosoftTokenResponse> {
  const authUrl = new URL("https://login.live.com/oauth20_authorize.srf");
  authUrl.searchParams.set("client_id", MICROSOFT_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", MICROSOFT_SCOPE);
  authUrl.searchParams.set("prompt", "select_account");

  return new Promise<MicrosoftTokenResponse>((resolve, reject) => {
    let completed = false;

    // A minimal RPC is required to enable rpc.request.evaluateJavascriptWithResponse,
    // which is the only way to read window.location.href from the bun side.
    const loginRpc = BrowserView.defineRPC<{
      bun: { requests: Record<string, never>; messages: Record<string, never> };
      webview: {
        requests: Record<string, never>;
        messages: Record<string, never>;
      };
    }>({
      maxRequestTime: 10_000,
      handlers: { requests: {} },
    });

    const loginWindow = new BrowserWindow({
      title: "Entrar com Microsoft",
      url: authUrl.toString(),
      frame: { width: 460, height: 640, x: 400, y: 180 },
      titleBarStyle: "default",
      rpc: loginRpc,
    });

    // Do NOT block the redirect URI via setNavigationRules.
    // On Linux/CEF, blocking a URL suppresses all navigation events for it,
    // so the code never arrives. Instead we let the navigation happen and
    // intercept it on did-navigate (which fires before the page renders).
    console.log(
      "[OAUTH] Navigation rules: none (redirect URI allowed to fire events)",
    );

    loginWindow.setAlwaysOnTop(true);
    console.log("[OAUTH] Login window opened:", authUrl.toString());

    function cleanup(): void {
      // Schedule close on next tick — closing synchronously inside a navigation
      // callback freezes CEF on Linux while it is still processing the event.
      console.log("[OAUTH] cleanup() — scheduling close via setTimeout");
      setTimeout(() => {
        console.log("[OAUTH] Closing login window now");
        try {
          loginWindow.close();
        } catch (err) {
          console.error("[OAUTH] Error closing login window:", err);
        }
      }, 0);
    }

    // ── URL extraction ────────────────────────────────────────────────────────
    // Confirmed shape from Linux/CEF logs:
    //   { name, data: { detail: string }, responseWasSet }
    //
    // detail is either:
    //   - JSON string '{"url":"https://...","allowed":true}'  (will-navigate)
    //   - plain URL string "https://..."                      (did-navigate etc.)

    function extractUrl(event: unknown, eventName: string): string | undefined {
      const e = event as Record<string, unknown> | null | undefined;
      const data = e?.data as Record<string, unknown> | null | undefined;
      const detail = data?.detail;

      if (typeof detail !== "string") {
        console.log(
          `[OAUTH] ${eventName} unexpected shape:`,
          JSON.stringify(event),
        );
        return undefined;
      }

      // will-navigate: detail is a JSON string containing { url, allowed }
      try {
        const inner = JSON.parse(detail) as Record<string, unknown>;
        if (typeof inner.url === "string") {
          console.log(`[OAUTH] ${eventName} url=${inner.url}`);
          return inner.url;
        }
      } catch {
        // Not JSON — detail is already a plain URL string
      }

      console.log(`[OAUTH] ${eventName} detail=${detail}`);
      return detail;
    }

    // ── Navigation handler ────────────────────────────────────────────────────

    function handleNavigation(navUrl: string | undefined): void {
      if (completed || !navUrl) return;
      if (!navUrl.startsWith(REDIRECT_URI)) return;

      console.log(`[OAUTH] Redirect URI matched: ${navUrl}`);

      let parsed: URL;
      try {
        parsed = new URL(navUrl);
      } catch (err) {
        console.error("[OAUTH] Failed to parse redirect URL:", err);
        return;
      }

      const code = parsed.searchParams.get("code");
      const oauthError = parsed.searchParams.get("error");

      console.log(
        `[OAUTH] code=${code ? "present" : "null"} oauthError=${oauthError}`,
      );

      if (code) {
        completed = true;
        console.log(
          "[OAUTH] Auth code received, closing window and exchanging token...",
        );
        cleanup();
        exchangeCodeForTokens(code)
          .then((tokens) => {
            console.log("[OAUTH] Token exchange successful");
            resolve(tokens);
          })
          .catch((err) => {
            console.error("[OAUTH] Token exchange failed:", err);
            reject(err);
          });
      } else if (oauthError) {
        completed = true;
        console.error(`[OAUTH] Auth error from Microsoft: ${oauthError}`);
        cleanup();
        reject(new Error(`Microsoft login failed: ${oauthError}`));
      }
    }

    // ── Strategy: event listeners + location polling ─────────────────────────
    // On Linux/CEF, the final redirect to oauth20_desktop.srf?code=... does not
    // reliably fire any navigation event. We use two complementary approaches:
    //
    // 1. Navigation events — catch redirects that do fire events
    // 2. Polling via executeJavascript — read window.location.href directly
    //    after each navigation settles, catches what events miss

    loginWindow.webview.on("will-navigate", (event) => {
      const url = extractUrl(event, "will-navigate");
      handleNavigation(url);
      // Each navigation may lead to the redirect — schedule a poll after settle
      schedulePoll();
    });

    loginWindow.webview.on("did-navigate", (event) => {
      const url = extractUrl(event, "did-navigate");
      handleNavigation(url);
      schedulePoll();
    });

    loginWindow.webview.on("did-navigate-in-page", (event) => {
      const url = extractUrl(event, "did-navigate-in-page");
      handleNavigation(url);
      schedulePoll();
    });

    loginWindow.webview.on("did-commit-navigation", (event) => {
      const url = extractUrl(event, "did-commit-navigation");
      handleNavigation(url);
      schedulePoll();
    });

    loginWindow.webview.on("dom-ready", (_event) => {
      console.log("[OAUTH] dom-ready — polling location");
      pollLocation();
    });

    // ── Polling ───────────────────────────────────────────────────────────────
    // Read window.location.href from inside the webview. This catches the
    // oauth20_desktop.srf redirect that CEF swallows without emitting events.

    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    function schedulePoll(): void {
      if (completed) return;
      if (pollTimer) clearTimeout(pollTimer);
      // Wait 300ms for the navigation to settle before reading location
      pollTimer = setTimeout(() => {
        pollTimer = null;
        pollLocation();
      }, 300);
    }

    function pollLocation(): void {
      if (completed) return;
      // evaluateJavascriptWithResponse requires RPC to be configured on the window.
      // loginWindow is created with loginRpc above so this method is available.
      loginWindow.webview.rpc.request
        .evaluateJavascriptWithResponse({ script: "window.location.href" })
        .then((href: unknown) => {
          if (typeof href === "string") {
            console.log(`[OAUTH] poll location=${href}`);
            handleNavigation(href);
            // Keep polling until completed or window closes
            if (!completed) {
              pollTimer = setTimeout(pollLocation, 500);
            }
          }
        })
        .catch((err: unknown) => {
          // Window was closed or JS execution failed — stop polling silently
          console.log("[OAUTH] poll error (window may be closed):", err);
        });
    }

    // Start polling immediately in case the window is already at the redirect
    schedulePoll();

    // User closed the window manually.
    loginWindow.on("close", () => {
      console.log(`[OAUTH] Window closed, completed=${completed}`);
      if (pollTimer) clearTimeout(pollTimer);
      if (!completed) {
        reject(new Error("Login cancelled by user."));
      }
    });
  });
}

// ─── AccountService ───────────────────────────────────────────────────────────

export interface AccountsStatePayload {
  accounts: AccountProfile[];
  activeAccountId: string | null;
  limit: number;
}

export interface OfflineAccountRequestPayload {
  username: string;
}

export interface AccountSelectionPayload {
  accountId: string;
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
      throw new Error(`Account limit of ${ACCOUNTS_LIMIT} reached.`);
    }
  }

  private findAccount(accountId: string): StoredAccount | undefined {
    return this.state.accounts.find((a) => a.id === accountId);
  }

  private upsertAccount(account: StoredAccount): void {
    const index = this.state.accounts.findIndex((a) => a.id === account.id);
    if (index >= 0) {
      this.state.accounts[index] = account;
    } else {
      this.state.accounts.push(account);
    }
  }

  private selectAccountInternal(accountId: string): void {
    this.state.activeAccountId = accountId;
  }

  // ── Public state ────────────────────────────────────────────────────────────

  getPublicState(): AccountsStatePayload {
    return {
      accounts: this.state.accounts.map(mapToProfile),
      activeAccountId: this.state.activeAccountId,
      limit: ACCOUNTS_LIMIT,
    };
  }

  // ── Offline account ─────────────────────────────────────────────────────────

  async addOfflineAccount(
    payload: OfflineAccountRequestPayload,
  ): Promise<AccountsStatePayload> {
    this.ensureLimitAvailable();
    const username = normalizeUsername(payload.username);
    if (!username) throw new Error("Provide a valid username.");

    const nowTs = now();
    const account: StoredOfflineAccount = {
      id: crypto.randomUUID(),
      type: "offline",
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

  // ── Microsoft account ───────────────────────────────────────────────────────

  async addMicrosoftAccount(): Promise<AccountsStatePayload> {
    this.ensureLimitAvailable();
    if (this.loginInFlight) {
      throw new Error("A Microsoft login is already in progress.");
    }

    this.loginInFlight = true;
    try {
      const tokenResponse = await performMicrosoftOAuth();
      const account = await this.buildMicrosoftAccountFromTokens(tokenResponse);
      this.upsertAccount(account);
      this.selectAccountInternal(account.id);
      this.persist();
      return this.getPublicState();
    } finally {
      this.loginInFlight = false;
    }
  }

  // ── Remove / select ─────────────────────────────────────────────────────────

  async removeAccount(
    payload: AccountSelectionPayload,
  ): Promise<AccountsStatePayload> {
    const previousLength = this.state.accounts.length;
    this.state.accounts = this.state.accounts.filter(
      (a) => a.id !== payload.accountId,
    );
    if (previousLength === this.state.accounts.length) {
      throw new Error("Account not found.");
    }
    if (this.state.activeAccountId === payload.accountId) {
      this.state.activeAccountId = this.state.accounts[0]?.id ?? null;
    }
    this.persist();
    return this.getPublicState();
  }

  async selectAccount(
    payload: AccountSelectionPayload,
  ): Promise<AccountsStatePayload> {
    const target = this.findAccount(payload.accountId);
    if (!target) throw new Error("Account not found.");
    this.selectAccountInternal(target.id);
    target.lastUsedAt = now();
    this.persist();
    return this.getPublicState();
  }

  getActiveAccount(): StoredAccount | null {
    if (!this.state.activeAccountId) return null;
    return this.findAccount(this.state.activeAccountId) ?? null;
  }

  // ── Launch context ──────────────────────────────────────────────────────────

  async getLaunchContext(): Promise<LaunchAccountContext> {
    const active = this.getActiveAccount();
    if (!active) {
      return {
        type: "guest",
        username: "ShindoPlayer",
        uuid: generateOfflineUuid("ShindoPlayer"),
        clientToken: generateClientToken(),
      };
    }

    if (active.type === "offline") {
      return {
        type: "offline",
        username: active.username,
        uuid: active.uuid,
        clientToken: active.clientToken,
      };
    }

    return this.refreshMicrosoftAccount(active);
  }

  // ── Private: Microsoft token/profile helpers ────────────────────────────────

  private async buildMicrosoftAccountFromTokens(
    tokenResponse: MicrosoftTokenResponse,
  ): Promise<StoredMicrosoftAccount> {
    const nowTs = now();
    const { profile, refreshToken, accessToken } =
      await this.resolveMinecraftProfileFromTokens(tokenResponse);

    return {
      id: crypto.randomUUID(),
      type: "microsoft",
      username: profile.name,
      uuid: profile.id,
      createdAt: nowTs,
      lastUsedAt: nowTs,
      skinUrl:
        profile.skins?.find((s) => s.state === "ACTIVE")?.url ??
        resolveSkinUrl(profile.id),
      refreshToken,
      accessToken,
      accessTokenExpiresAt: nowTs + (tokenResponse.expires_in - 60) * 1000,
      clientToken: generateClientToken(),
    };
  }

  private async resolveMinecraftProfileFromTokens(
    tokens: MicrosoftTokenResponse,
  ): Promise<{
    profile: MinecraftProfileResponse;
    accessToken: string;
    refreshToken: string;
  }> {
    const userToken = await requestXboxUserToken(tokens.access_token);
    const xsts = await requestXstsToken(userToken.Token);
    const uhs = xsts.DisplayClaims?.xui?.[0]?.uhs;
    if (!uhs) throw new Error("Invalid XSTS response: no UHS returned.");

    const identityToken = `XBL3.0 x=${uhs};${xsts.Token}`;
    const minecraftAuth = await loginWithXbox(identityToken);
    const profile = await fetchMinecraftProfile(minecraftAuth.access_token);
    if (!profile?.id) {
      throw new Error("Microsoft account does not own Minecraft Java Edition.");
    }

    return {
      profile,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
  }

  private async ensureFreshMicrosoftTokens(
    account: StoredMicrosoftAccount,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (account.accessToken && account.accessTokenExpiresAt > now() + 60_000) {
      return {
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
      };
    }
    const refreshed = await exchangeRefreshToken(account.refreshToken);
    account.refreshToken = refreshed.refresh_token ?? account.refreshToken;
    account.accessToken = refreshed.access_token;
    account.accessTokenExpiresAt = now() + (refreshed.expires_in - 60) * 1000;
    this.persist();
    return {
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
    };
  }

  private async refreshMicrosoftAccount(
    account: StoredMicrosoftAccount,
  ): Promise<LaunchAccountContext> {
    const tokens = await this.ensureFreshMicrosoftTokens(account);
    const userToken = await requestXboxUserToken(tokens.accessToken);
    const xsts = await requestXstsToken(userToken.Token);
    const uhs = xsts.DisplayClaims?.xui?.[0]?.uhs;
    if (!uhs) throw new Error("Failed to obtain player identifier.");

    const identityToken = `XBL3.0 x=${uhs};${xsts.Token}`;
    const minecraftAuth = await loginWithXbox(identityToken);
    const profile = await fetchMinecraftProfile(minecraftAuth.access_token);

    account.username = profile.name;
    account.uuid = profile.id;
    account.lastUsedAt = now();
    account.skinUrl =
      profile.skins?.find((s) => s.state === "ACTIVE")?.url ?? account.skinUrl;
    this.persist();

    return {
      type: "microsoft",
      username: profile.name,
      uuid: profile.id,
      accessToken: minecraftAuth.access_token,
      clientToken: account.clientToken,
    };
  }
}

export const accountService = new AccountService();
