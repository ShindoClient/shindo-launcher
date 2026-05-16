import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { homedir, platform } from "node:os";
import { basename, dirname, extname, join, parse } from "node:path";
import { promisify } from "node:util";
import { BrowserView, BrowserWindow, Updater } from "electrobun/bun";
import type {
  LaunchRequest,
  NativeDownloadRequest,
  NativeState,
  ProgressPayload,
  ShindoRPCSchema,
} from "../shared/types";
import { ensureLaunchWrapperJar, ensureRequiredLibraries } from "./helper";
import { accountService } from "./accounts";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
const DATA_DIR = join(homedir(), ".shindo");
const STATE_FILE = join(DATA_DIR, "state.json");
const VERSIONS_DIR = join(DATA_DIR, "versions");
const RUNTIMES_DIR = join(DATA_DIR, "java");
const ADOPTIUM_ASSETS_URL = "https://api.adoptium.net/v3/assets/latest";
const execFileAsync = promisify(execFile);

let mainWindow: BrowserWindow | null = null;

async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  return "views://mainview/index.html";
}

async function readState(): Promise<NativeState> {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8")) as NativeState;
  } catch {
    return {};
  }
}

async function saveState(state: NativeState) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  return { ok: true };
}

function sendProgress(progress: ProgressPayload) {
  getWebviewSender()?.downloadProgress(progress);
}

function getWebviewSender() {
  return (
    mainWindow?.webview.rpc as unknown as {
      send?: ShindoRPCSchema["webview"]["messages"] extends infer Messages
        ? { [K in keyof Messages]: (payload: Messages[K]) => void }
        : never;
    }
  )?.send;
}

function sendLauncherLog(
  level: "info" | "debug" | "warn" | "error",
  message: unknown,
) {
  const text =
    typeof message === "string" ? message : JSON.stringify(message, null, 2);
  getWebviewSender()?.launcherLog({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    level,
    message: text,
    timestamp: Date.now(),
  });
}

async function downloadToFile(url: string, target: string, label: string) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: ${response.status} ${url}`);
  }

  await mkdir(dirname(target), { recursive: true });
  const total = Number(response.headers.get("content-length") ?? 0);
  let current = 0;
  const writer = createWriteStream(target);
  const reader = response.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    current += value.byteLength;
    writer.write(value);
    sendProgress({
      current: total > 0 ? Math.round((current / total) * 100) : 0,
      total: 100,
      label,
    });
  }

  await new Promise<void>((resolve, reject) => {
    writer.end((error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function downloadClient({
  release,
  versionJsonUrl,
}: NativeDownloadRequest) {
  const versionSource = versionJsonUrl || release.versionJsonUrl;
  if (!versionSource)
    throw new Error("Release has no downloadable version JSON");

  const sourceJsonName =
    parse(new URL(versionSource).pathname).base || `${release.id}.json`;
  const versionId = parse(sourceJsonName).name;
  const versionDir = join(VERSIONS_DIR, versionId);
  const versionJsonPath = join(versionDir, `${versionId}.json`);

  sendProgress({ current: 0, total: 100, label: release.id });
  await downloadToFile(versionSource, versionJsonPath, sourceJsonName);
  await normalizeVersionJson(versionJsonPath, versionId);
  sendProgress({ current: 100, total: 100, label: release.id });
  return { installPath: versionDir, versionId, versionJsonPath };
}

async function normalizeVersionJson(
  versionJsonPath: string,
  versionId: string,
) {
  const raw = await readFile(versionJsonPath, "utf8");
  const manifest = JSON.parse(raw) as { id?: string };
  if (manifest.id === versionId) return;

  if (manifest.id) {
    const manifestDir = join(VERSIONS_DIR, manifest.id);
    const manifestPath = join(manifestDir, `${manifest.id}.json`);
    await mkdir(manifestDir, { recursive: true });
    await rename(versionJsonPath, manifestPath);
    return;
  }

  manifest.id = versionId;
  await writeFile(versionJsonPath, JSON.stringify(manifest, null, 2));
}

async function ensureJava({ javaVersion }: { javaVersion: number }) {
  const os = adoptiumOs();
  const arch = adoptiumArch();
  const runtimeDir = join(RUNTIMES_DIR, `temurin-${javaVersion}-${os}-${arch}`);
  const existingJava = await readRuntimeJavaPath(runtimeDir);
  if (existingJava) return { ok: true, path: existingJava };

  await rm(runtimeDir, { recursive: true, force: true });
  await mkdir(runtimeDir, { recursive: true });
  const asset = await getTemurinAsset(javaVersion, os, arch);
  const archivePath = join(runtimeDir, basename(new URL(asset.link).pathname));
  sendProgress({ current: 0, total: 100, label: `Temurin ${javaVersion}` });
  await downloadToFile(asset.link, archivePath, `Temurin ${javaVersion}`);
  await verifyChecksum(archivePath, asset.checksum);
  await extractArchive(archivePath, runtimeDir);
  await rm(archivePath, { force: true });

  const javaPath = await findJavaExecutable(runtimeDir);
  if (!javaPath)
    throw new Error("Temurin runtime extracted without java executable");
  if (platform() !== "win32") await chmod(javaPath, 0o755);
  await writeFile(
    join(runtimeDir, "runtime.json"),
    JSON.stringify({ javaPath }, null, 2),
  );
  return { ok: true, path: javaPath };
}

type TemurinAsset = {
  link: string;
  checksum?: string;
};

async function getTemurinAsset(
  javaVersion: number,
  os: string,
  arch: string,
): Promise<TemurinAsset> {
  const url = new URL(`${ADOPTIUM_ASSETS_URL}/${javaVersion}/hotspot`);
  url.searchParams.set("architecture", arch);
  url.searchParams.set("image_type", "jre");
  url.searchParams.set("os", os);
  url.searchParams.set("vendor", "eclipse");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Temurin lookup failed: ${response.status}`);
  }
  const assets = (await response.json()) as Array<{
    binary?: { package?: { link?: string; checksum?: string } };
  }>;
  const pkg = assets[0]?.binary?.package;
  if (!pkg?.link) {
    throw new Error(
      `No Temurin JRE found for Java ${javaVersion} ${os}/${arch}`,
    );
  }
  return { link: pkg.link, checksum: pkg.checksum };
}

function adoptiumOs() {
  const current = platform();
  if (current === "darwin") return "mac";
  if (current === "win32") return "windows";
  return "linux";
}

function adoptiumArch() {
  if (process.arch === "x64") return "x64";
  if (process.arch === "arm64") return "aarch64";
  if (process.arch === "ia32") return "x86";
  return process.arch;
}

async function verifyChecksum(filePath: string, expected?: string) {
  if (!expected) return;
  const file = await readFile(filePath);
  const actual = createHash("sha256").update(file).digest("hex");
  if (actual !== expected) {
    throw new Error("Temurin checksum mismatch");
  }
}

async function extractArchive(archivePath: string, targetDir: string) {
  const lower = archivePath.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
    await execFileAsync("tar", ["-xzf", archivePath, "-C", targetDir]);
    return;
  }
  if (extname(lower) === ".zip") {
    if (platform() === "win32") {
      await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-Command",
        "Expand-Archive",
        "-LiteralPath",
        archivePath,
        "-DestinationPath",
        targetDir,
        "-Force",
      ]);
      return;
    }
    await execFileAsync("unzip", ["-q", archivePath, "-d", targetDir]);
    return;
  }
  throw new Error(`Unsupported Temurin archive: ${archivePath}`);
}

async function findJavaExecutable(root: string): Promise<string | undefined> {
  const javaName = platform() === "win32" ? "java.exe" : "java";
  const entries = await walk(root);
  const candidates = entries.filter(
    (entry) =>
      entry.endsWith(`/bin/${javaName}`) ||
      entry.endsWith(`\\bin\\${javaName}`),
  );
  return candidates.sort((a, b) => a.length - b.length)[0];
}

async function readRuntimeJavaPath(runtimeDir: string) {
  try {
    const metadata = JSON.parse(
      await readFile(join(runtimeDir, "runtime.json"), "utf8"),
    ) as { javaPath?: string };
    if (metadata.javaPath) {
      await readFile(metadata.javaPath);
      return metadata.javaPath;
    }
  } catch {}

  const javaPath = await findJavaExecutable(runtimeDir);
  if (!javaPath) return undefined;
  await writeFile(
    join(runtimeDir, "runtime.json"),
    JSON.stringify({ javaPath }, null, 2),
  );
  return javaPath;
}

async function walk(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const results = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(root, entry.name);
        if (entry.isDirectory()) return walk(fullPath);
        return [fullPath];
      }),
    );
    return results.flat();
  } catch {
    return [];
  }
}

async function launchGame({ version, account, settings }: LaunchRequest) {
  const module = await import("minecraft-launcher-core");
  const Client =
    (module as { Client?: unknown; default?: { Client?: unknown } }).Client ??
    (module as { default?: { Client?: unknown } }).default?.Client;
  if (typeof Client !== "function") {
    throw new Error("minecraft-launcher-core Client export not found");
  }

  const launcher = new (Client as new () => {
    launch(options: unknown): { pid?: number; on?: Function };
    on?: Function;
  })();
  const versionId = getVersionIdFromRelease(version);
  await ensureVersionJsonAvailable(version);

  const java =
    settings.javaMode === "manual" && settings.javaPath
      ? { path: settings.javaPath }
      : await ensureJava({ javaVersion: version.javaVersion });
  console.log(
    `Launching ${versionId} with Java: ${java.path ?? "system java"}`,
  );

  await ensureLaunchWrapperJar(DATA_DIR);
  await ensureRequiredLibraries(DATA_DIR);

  const child = await launcher.launch({
    root: DATA_DIR,
    javaPath: java.path,
    authorization: authorizationFor(account),
    version: {
      number: version.minecraftVersion,
      type: version.channel,
      custom: versionId,
    },
    memory: {
      min: `${settings.ramMinMb}M`,
      max: `${settings.ramMaxMb}M`,
    },
    overrides: {
      versionName: versionId,
      assetIndex: version.assetsIndex,
    },
  });

  launcher.on?.("debug", (message: unknown) =>
    sendLauncherLog("debug", message),
  );
  launcher.on?.("data", (message: unknown) => sendLauncherLog("info", message));
  launcher.on?.("download", (message: unknown) =>
    sendLauncherLog("info", message),
  );
  launcher.on?.("download-status", (message: unknown) =>
    sendLauncherLog("debug", message),
  );
  launcher.on?.("progress", (message: unknown) =>
    sendLauncherLog("debug", message),
  );

  getWebviewSender()?.gameStarted({ pid: child.pid });
  child.on?.("close", (code: number | null) => {
    sendLauncherLog(
      "info",
      `Minecraft process closed with code ${code ?? "null"}`,
    );
    getWebviewSender()?.gameClosed({ code });
  });
  child.on?.("error", (error: Error) => {
    sendLauncherLog("error", error.message);
    getWebviewSender()?.nativeError({ message: error.message });
  });
  return { ok: true, pid: child.pid };
}

async function ensureVersionJsonAvailable(version: LaunchRequest["version"]) {
  const versionId = getVersionIdFromRelease(version);
  const localPath = join(VERSIONS_DIR, versionId, `${versionId}.json`);
  try {
    await readFile(localPath, "utf8");
  } catch {
    await downloadClient({
      release: version,
      versionJsonUrl: version.versionJsonUrl,
    });
  }
}

function getVersionIdFromRelease(version: LaunchRequest["version"]) {
  if (version.id) return version.id;
  if (!version.versionJsonUrl) return version.minecraftVersion;
  const jsonName = parse(new URL(version.versionJsonUrl).pathname).base;
  return parse(jsonName).name || version.minecraftVersion;
}

function authorizationFor(account: import("../shared/types").AccountProfile) {
  if (account.type === "offline") {
    return {
      access_token: "",
      client_token: "",
      uuid: account.uuid ?? account.id,
      name: account.username,
      user_properties: "{}",
      meta: { type: "offline" },
    };
  }
  // Microsoft accounts: tokens are managed by accountService.
  // By launch time, accountService.getLaunchContext() has already refreshed
  // them, but here we receive a plain AccountProfile (no tokens) from the
  // webview. Use the active account's fresh tokens from the service instead.
  const ctx = accountService.getActiveAccount();
  return {
    access_token: (ctx as { accessToken?: string } | null)?.accessToken ?? "",
    client_token: "",
    uuid: account.uuid ?? account.id,
    name: account.username,
    user_properties: "{}",
    meta: { type: "msa" },
  };
}

// ─── RPC ─────────────────────────────────────────────────────────────────────

const rpc = BrowserView.defineRPC<ShindoRPCSchema>({
  maxRequestTime: Infinity,
  handlers: {
    requests: {
      getState: readState,
      saveState,
      checkLauncherUpdate: async () => ({
        ok: true,
        channel: await Updater.localInfo.channel(),
      }),
      downloadClient,
      ensureJava,
      selectJavaExecutable: async () => ({}),
      launchGame,

      // ── Account handlers ───────────────────────────────────────────────────
      getAccounts: async () => accountService.getPublicState(),

      addOfflineAccount: async ({ username }) =>
        accountService.addOfflineAccount({ username }),

      // Opens the Microsoft OAuth BrowserWindow in the bun process.
      // The webview awaits this call — it resolves only after the user
      // completes or cancels login (or an error is thrown).
      addMicrosoftAccount: async () => accountService.addMicrosoftAccount(),

      removeAccount: async ({ accountId }) =>
        accountService.removeAccount({ accountId }),

      selectAccount: async ({ accountId }) =>
        accountService.selectAccount({ accountId }),

      // ── Window controls ────────────────────────────────────────────────────
      minimizeWindow: async () => {
        mainWindow?.minimize();
        return { ok: true };
      },
      closeWindow: async () => {
        mainWindow?.close();
        return { ok: true };
      },
    },
  },
});

// ─── Main window ──────────────────────────────────────────────────────────────

const url = await getMainViewUrl();

mainWindow = new BrowserWindow({
  title: "Shindo Launcher",
  url,
  frame: {
    width: 1120,
    height: 720,
    x: 200,
    y: 160,
  },
  titleBarStyle: "hidden",
  rpc,
});

console.log("Shindo launcher started");
