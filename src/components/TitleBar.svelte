<script lang="ts">
  import { getCurrentWindow } from "@tauri-apps/api/window";

  const appWindow = getCurrentWindow();

  function minimize() {
    appWindow.minimize();
  }

  function toggleMaximize() {
    appWindow.toggleMaximize();
  }

  function close() {
    appWindow.close();
  }
</script>

<div class="w-full h-8 bg-gray-800 text-white flex items-center justify-between px-3 select-none drag fixed top-0 left-0 z-50">
  <span class="text-sm font-semibold">Shindo Launcher</span>
  <div class="flex space-x-2 no-drag">
    <button class="hover:bg-gray-700 px-2 rounded" on:click={minimize}>─</button>
    <button class="hover:bg-gray-700 px-2 rounded" on:click={toggleMaximize}>☐</button>
    <button class="hover:bg-red-600 px-2 rounded" on:click={close}>✕</button>
  </div>
</div>
