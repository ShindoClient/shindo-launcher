import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(import.meta.dir, '..');
const VITE_PORT = 5173;

function run(
  cmd: string,
  args: string[],
  opts: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): ChildProcess {
  return spawn(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env, ...opts.env },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

async function waitForFile(file: string, timeout = 20_000): Promise<void> {
  const end = Date.now() + timeout;

  while (Date.now() < end) {
    if (fs.existsSync(file)) return;
    await Bun.sleep(250);
  }

  throw new Error(`Timed out waiting for file: ${file}`);
}

async function waitForVite(port: number, timeout = 20_000): Promise<void> {
  const end = Date.now() + timeout;

  while (Date.now() < end) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      if (res.ok || res.status < 500) return;
    } catch {}

    await Bun.sleep(300);
  }

  throw new Error('Vite failed to start');
}

async function main() {
  console.log('[dev] Building shared...');

  await new Promise<void>((resolve, reject) => {
    const p = run('bun', ['run', 'build:shared']);

    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`shared build failed (${code})`));
    });
  });

  console.log('[dev] Starting preload watcher...');
  run('bun', ['run', 'watch:preload']);

  console.log('[dev] Starting main watcher...');
  run('bun', ['run', 'watch:main']);

  console.log('[dev] Starting renderer...');
  run('bun', ['run', 'dev'], {
    cwd: path.join(ROOT, 'packages/renderer'),
  });

  const mainEntry = path.join(ROOT, 'dist/main/index.js');
  const preloadEntry = path.join(ROOT, 'dist/preload/index.js');

  console.log('[dev] Waiting for build outputs...');

  await Promise.all([
    waitForFile(mainEntry),
    waitForFile(preloadEntry),
    waitForVite(VITE_PORT),
  ]);

  console.log('[dev] Starting Electron...');

  const electron = run(
    path.join(ROOT, 'node_modules/.bin/electron'),
    ['.'],
    {
      env: {
        VITE_DEV_SERVER_URL: `http://localhost:${VITE_PORT}`,
      },
    },
  );

  electron.on('close', (code) => {
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    electron.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});