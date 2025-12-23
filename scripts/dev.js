const net = require('net');
const { concurrently } = require('concurrently');

const DEFAULT_HOST = process.env.VITE_DEV_SERVER_HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.VITE_DEV_SERVER_PORT || process.env.PORT || 5173) || 5173;

function checkPort(host, port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      server.close();
      reject(err);
    });
    server.listen({ host, port, exclusive: true }, () => {
      server.close(() => resolve(port));
    });
  });
}

async function findAvailablePort(host, startPort) {
  // Try from the requested port up to the max range, then wrap to 3000..startPort-1
  const tryRanges = [
    [startPort, 65535],
    [3000, Math.max(2999, startPort - 1)],
  ];

  for (const [from, to] of tryRanges) {
    for (let port = from; port <= to; port += 1) {
      try {
        await checkPort(host, port);
        return port;
      } catch (err) {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          continue;
        }
        throw err;
      }
    }
  }

  throw new Error(`No free port found starting from ${startPort} for host ${host}`);
}

(async () => {
  const host = DEFAULT_HOST;
  const port = await findAvailablePort(host, DEFAULT_PORT);

  const env = {
    ...process.env,
    VITE_DEV_SERVER_HOST: host,
    VITE_DEV_SERVER_PORT: String(port),
    VITE_DEV_SERVER_URL: `http://${host}:${port}`,
  };

  console.log(`[dev] Vite dev server target: http://${host}:${port}`);

  const { result } = concurrently(
    [
      { command: 'pnpm run dev:renderer', name: 'dev:renderer' },
      { command: 'pnpm run watch:shared', name: 'watch:shared' },
      { command: 'pnpm run watch:preload', name: 'watch:preload' },
      { command: 'pnpm run watch:main', name: 'watch:main' },
      { command: 'pnpm run dev:electron', name: 'dev:electron' },
    ],
    {
      prefix: '[{name}]',
      killOthers: ['failure', 'success'],
      env,
    }
  );

  await result;
})().catch((err) => {
  console.error('[dev] Failed to start dev env:', err.message);
  process.exit(1);
});
