import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets'
  },
  server: {
    strictPort: true,
    port: 5173, // 🔹 Porta fixa para integração com Tauri
    hmr: {
      overlay: false
    }
  }
})
