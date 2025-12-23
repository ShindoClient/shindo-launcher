import path from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const devServerHost = process.env.VITE_DEV_SERVER_HOST || '127.0.0.1';
const devServerPort = Number(process.env.VITE_DEV_SERVER_PORT || process.env.PORT || 5173) || 5173;

export default defineConfig({
  root: __dirname,
  plugins: [svelte()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: devServerHost,
    port: devServerPort,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/renderer'),
    emptyOutDir: true,
  },
});
