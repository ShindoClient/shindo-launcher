<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import { invoke } from "@tauri-apps/api/core";

  let message = "Checking for updates...";

  onMount(async () => {
    try {
      const result = await invoke<string>("run_updater");
      message = result;
    } catch (e) {
      message = "Error while checking updates.";
    }

    // espera 2s e vai pra Home
    setTimeout(() => push("/"), 2000);
  });
</script>

<div class="h-screen w-screen flex flex-col items-center justify-center bg-gray-950 text-white">
  <div class="animate-pulse text-xl font-semibold">{message}</div>
</div>
