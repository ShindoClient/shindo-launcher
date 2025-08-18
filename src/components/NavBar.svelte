<script lang="ts">
  import { link } from "svelte-spa-router";
</script>

<nav class="fixed top-8 left-0 h-[calc(100vh-2rem)] w-48 bg-gray-900 text-white flex flex-col items-center py-6 shadow-lg">
  <div class="mb-10 font-bold text-xl">Shindo</div>
  <div class="flex flex-col space-y-4 w-full text-center">
    <a use:link href="/" class="py-2 hover:bg-gray-700">Home</a>
    <a use:link href="/settings" class="py-2 hover:bg-gray-700">Settings</a>
  </div>
</nav>
