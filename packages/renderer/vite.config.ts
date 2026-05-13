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
      $lib: path.resolve(__dirname, 'src/lib'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Design tokens auto-imported in all .scss files
        additionalData: `@use 'sass:color';`,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve('./index.html'),
        logs: path.resolve('./logs.html'),
      },
    },
    sourcemap: false,
    minify: 'esbuild',
    target: 'chrome120', // Electron 36 uses Chrome 130+, conservative target
  },
  server: {
    host: devServerHost,
    port: devServerPort,
    strictPort: true,
  },
});
