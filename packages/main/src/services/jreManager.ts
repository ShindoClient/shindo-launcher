import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import AdmZip from 'adm-zip'
import tar from 'tar'
import { Readable } from 'node:stream'
import { ReadableStream as WebReadableStream } from 'node:stream/web'
import type { LauncherConfig } from '@shindo/shared'
import { getBaseDataDir } from '../utils/pathResolver'

export interface EnsureJreResult {
  patch?: Partial<LauncherConfig>
  message: string
}

type ArchiveType = 'zip' | 'tar.gz'

interface RuntimeDescriptor {
  url: string
  archiveType: ArchiveType
}

const JAVA_BIN = process.platform === 'win32' ? 'bin/java.exe' : 'bin/java'
const JAVA_DIR_NAME = 'java-8'

type FetchResponse = { ok: boolean; status: number; statusText: string; body?: unknown }

type FetchFn = (input: string, init?: Record<string, unknown>) => Promise<FetchResponse>

let cachedFetch: FetchFn | null = null

async function getFetch(): Promise<FetchFn> {
  if (cachedFetch) return cachedFetch
  const nativeFetch = (globalThis as Record<string, unknown>).fetch
  if (typeof nativeFetch === 'function') {
    cachedFetch = nativeFetch as FetchFn
    return cachedFetch
  }
  const mod = await import('node-fetch')
  const impl = (mod as Record<string, unknown>).default ?? mod
  cachedFetch = impl as FetchFn
  return cachedFetch
}

async function toNodeStream(body: unknown): Promise<NodeJS.ReadableStream> {
  if (!body) throw new Error('Runtime download failed: empty body')
  if (typeof (body as NodeJS.ReadableStream).pipe === 'function') {
    return body as NodeJS.ReadableStream
  }
  if (typeof (body as WebReadableStream).getReader === 'function') {
    return Readable.fromWeb(body as WebReadableStream)
  }
  throw new Error('Runtime download failed: unsupported response body type')
}

const TEMURIN_BASE = 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u432-b06'

const TEMURIN_RUNTIME: Partial<Record<NodeJS.Platform, Partial<Record<string, RuntimeDescriptor>>>> = {
  win32: {
    x64: {
      url: `${TEMURIN_BASE}/OpenJDK8U-jre_x64_windows_hotspot_8u432b06.zip`,
      archiveType: 'zip',
    },
  },
  linux: {
    x64: {
      url: `${TEMURIN_BASE}/OpenJDK8U-jre_x64_linux_hotspot_8u432b06.tar.gz`,
      archiveType: 'tar.gz',
    },
    arm64: {
      url: `${TEMURIN_BASE}/OpenJDK8U-jre_aarch64_linux_hotspot_8u432b06.tar.gz`,
      archiveType: 'tar.gz',
    },
  },
  darwin: {
    x64: {
      url: `${TEMURIN_BASE}/OpenJDK8U-jre_x64_mac_hotspot_8u432b06.tar.gz`,
      archiveType: 'tar.gz',
    },
  },
}

const RUNTIME_MAP: Record<'zulu' | 'temurin', Partial<Record<NodeJS.Platform, Partial<Record<string, RuntimeDescriptor>>>>> = {
  zulu: TEMURIN_RUNTIME,
  temurin: TEMURIN_RUNTIME,
}

function runtimeDir(): string {
  return path.join(getBaseDataDir(), 'java', JAVA_DIR_NAME)
}

async function downloadToTemp(url: string, extension: string): Promise<string> {
  const fetch = await getFetch()
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download runtime (${response.status} ${response.statusText})`)
  }

  const tempPath = path.join(os.tmpdir(), `shindo-runtime-${Date.now()}.${extension}`)
  const fileStream = fs.createWriteStream(tempPath)
  const stream = await toNodeStream(response.body)
  await pipeline(stream, fileStream)
  return tempPath
}

async function extractArchive(archive: string, destination: string, archiveType: ArchiveType): Promise<void> {
  fs.rmSync(destination, { recursive: true, force: true })
  fs.mkdirSync(destination, { recursive: true })

  if (archiveType === 'zip') {
    const zip = new AdmZip(archive)
    zip.extractAllTo(destination, true)
    return
  }

  await tar.x({ file: archive, cwd: destination })
}

function findJavaBinary(rootDir: string): string | null {
  const expectedName = process.platform === 'win32' ? 'java.exe' : 'java'
  if (!fs.existsSync(rootDir)) {
    return null
  }

  const queue = [rootDir]

  while (queue.length > 0) {
    const current = queue.shift()!
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(full)
      } else if (entry.name === expectedName) {
        return full
      }
    }
  }

  return null
}

function resolveExtractionRoot(dir: string): string {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  if (entries.length === 1 && entries[0].isDirectory()) {
    return path.join(dir, entries[0].name)
  }
  return dir
}

function descriptorFor(preference: Exclude<LauncherConfig['jrePreference'], 'system'>): RuntimeDescriptor | null {
  const platformMap = RUNTIME_MAP[preference][process.platform]
  if (!platformMap) return null
  return platformMap[process.arch] ?? null
}


export async function ensureJre(config: LauncherConfig): Promise<EnsureJreResult> {
  if (config.jrePreference === 'system') {
    if (config.jrePath) {
      return {
        message: `Using system JRE at ${config.jrePath}`,
      }
    }
    return {
      message: 'Using system JRE (PATH).',
    }
  }

  const descriptor = descriptorFor(config.jrePreference)
  if (!descriptor) {
    return {
      patch: { jrePreference: 'system', jrePath: undefined },
      message: `Runtime ${config.jrePreference} not supported for ${process.platform}/${process.arch}. Using system JRE.`,
    }
  }

  const targetDir = runtimeDir()
  fs.mkdirSync(path.dirname(targetDir), { recursive: true })

  if (config.jrePath && fs.existsSync(config.jrePath)) {
    return {
      message: `Runtime ${config.jrePreference} configured manually at ${config.jrePath}`,
    }
  }

  const existingBinary = findJavaBinary(targetDir)
  if (existingBinary) {
    return {
      patch: { jrePath: existingBinary },
      message: `Runtime ${config.jrePreference} ready in ${targetDir}`,
    }
  }

  let archivePath: string | null = null
  const extractDir = path.join(os.tmpdir(), `shindo-java-extract-${Date.now()}`)
  try {
    archivePath = await downloadToTemp(descriptor.url, descriptor.archiveType === 'zip' ? 'zip' : 'tar.gz')
    fs.mkdirSync(extractDir, { recursive: true })
    await extractArchive(archivePath, extractDir, descriptor.archiveType)
    const sourceRoot = resolveExtractionRoot(extractDir)
    fs.rmSync(targetDir, { recursive: true, force: true })
    fs.mkdirSync(targetDir, { recursive: true })
    for (const entry of fs.readdirSync(sourceRoot)) {
      fs.cpSync(path.join(sourceRoot, entry), path.join(targetDir, entry), { recursive: true })
    }
  } catch (error) {
    if (archivePath && fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath)
    }
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true })
    }
    return {
      patch: { jrePreference: 'system', jrePath: undefined },
      message: `Failed to prepare runtime ${config.jrePreference}: ${error instanceof Error ? error.message : String(error)}. Falling back to system JRE.`,
    }
  } finally {
    if (archivePath && fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath)
    }
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true })
    }
  }

  const javaBinary = findJavaBinary(targetDir)
  if (!javaBinary) {
    return {
      patch: { jrePreference: 'system', jrePath: undefined },
      message: `Runtime ${config.jrePreference} was downloaded but Java executable was not found. Reverting to system JRE.`,
    }
  }

  return {
    patch: { jrePath: javaBinary },
    message: `Runtime ${config.jrePreference} ready in ${targetDir}`,
  }
}

