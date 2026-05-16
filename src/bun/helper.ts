import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { downloadAsset } from "./git";

const LAUNCHWRAPPER_URL =
  "https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar";

const REQUIRED_LIBRARIES = [
  {
    relativePath: "org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar",
    url: "https://libraries.minecraft.net/org/ow2/asm/asm-all/5.0.3/asm-all-5.0.3.jar",
  },
];

async function downloadIfMissing(url: string, dest: string): Promise<void> {
  try {
    if (fs.statSync(dest).size > 0) return;
  } catch {
    // File missing or unreadable — download it
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const stream = await downloadAsset(url);
  await pipeline(stream, fs.createWriteStream(dest));
}

export async function ensureLaunchWrapperJar(root: string): Promise<void> {
  const dest = path.join(
    root,
    "libraries",
    "net",
    "minecraft",
    "launchwrapper",
    "1.12",
    "launchwrapper-1.12.jar",
  );
  await downloadIfMissing(LAUNCHWRAPPER_URL, dest);
}

export async function ensureRequiredLibraries(root: string): Promise<void> {
  for (const { relativePath, url } of REQUIRED_LIBRARIES) {
    const dest = path.join(root, "libraries", ...relativePath.split("/"));
    await downloadIfMissing(url, dest);
  }
}

export function extractCommand(proc: ChildProcessWithoutNullStreams | null | undefined): string[] {
  if (!proc) return [];
  return Array.isArray(proc.spawnargs) ? proc.spawnargs.map(String) : [];
}
