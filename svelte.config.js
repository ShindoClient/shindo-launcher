import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
const config = {
  // 🔹 permite usar <script lang="ts"> em .svelte
  preprocess: vitePreprocess(),

  compilerOptions: {
    dev: process.env.NODE_ENV === 'development'
  }
}

export default config
