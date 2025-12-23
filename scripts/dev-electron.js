const { spawn } = require('child_process');
const waitOn = require('wait-on');

const devServerPort = Number(process.env.VITE_DEV_SERVER_PORT || process.env.PORT || 5173);
const viteDevServerUrl = process.env.VITE_DEV_SERVER_URL || `http://localhost:${devServerPort}`;

const resources = [
  `tcp:${devServerPort}`,
  'dist/main/main.js',
  'dist/preload/index.js',
  'dist/shared/index.js',
];

waitOn({ resources, timeout: 30000 })
  .then(() => {
    const child = spawn('electron', ['.'], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: viteDevServerUrl,
      },
    });

    child.on('exit', (code) => process.exit(code ?? 0));
  })
  .catch((err) => {
    console.error('Failed to start electron after waiting for Vite/dev builds:', err.message);
    process.exit(1);
  });
