<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";

  let ram = 2048;
  let provider = "zulu";
  let javaVersion = "8";
  let status = "";

  async function save() {
    await invoke("save_settings", {
      settings: {
        javaPath: null,
        javaProvider: provider,
        javaVersion,
        ram
      }
    });
    status = "Settings saved!";
  }

  async function installJava() {
    status = "Installing Java...";
    status = await invoke<string>("install_java", {
      version: javaVersion,
      provider
    });
  }

  onMount(async () => {
    const s = await invoke<any>("get_settings");
    ram = s.ram;
    provider = s.java_provider.toLowerCase();
    javaVersion = s.java_version;
  });
</script>

<div class="ml-48 flex flex-col h-screen bg-gray-950 text-white p-6">
    <h2 class="text-xl font-bold mb-4">Settings</h2>
    <div>
        <label class="block mb-1">Java Provider</label>
        <select bind:value={provider} class="bg-gray-800 p-2 rounded">
            <option value="zulu">Zulu</option>
            <option value="temurin">Temurin</option>
        </select>
    </div>

    <div>
        <label class="block mb-1">Java Version</label>
        <input type="text" bind:value={javaVersion} class="bg-gray-800 p-2 rounded" />
    </div>

    <div>
        <label class="block mb-1">RAM (MB)</label>
        <input type="number" bind:value={ram} class="bg-gray-800 p-2 rounded" />
    </div>

    <div class="flex space-x-3 mt-4">
        <button on:click={save} class="px-4 py-2 bg-blue-600 rounded">Save</button>
        <button on:click={installJava} class="px-4 py-2 bg-green-600 rounded">Install Java</button>
    </div>

    {#if status}
        <p class="mt-3 text-sm text-gray-400">{status}</p>
    {/if}
</div>
