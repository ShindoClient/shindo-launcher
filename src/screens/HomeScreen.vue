<template>
  <div class="p-6 space-y-6 max-w-3xl mx-auto">
    <FeaturedBanner src="/src/assets/shindo-logo.png" />
    <div class="flex items-center gap-4">
      <button class="px-4 py-2 bg-emerald-600 rounded" @click="onPlay" :disabled="busy">{{ busy ? 'Iniciando...' : 'Play' }}</button>
      <ProgressBar :percent="percent" />
    </div>
    <ShellLog :logs="logs" />
  </div>
</template>
<script setup lang="ts">
import FeaturedBanner from "../components/FeaturedBanner.vue";
import ProgressBar from "../components/ProgressBar.vue";
import ShellLog from "../components/ShellLog.vue";
import { ref, onMounted, onBeforeUnmount } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const percent = ref(0);
const logs = ref<string[]>([]);
const busy = ref(false);
let unlisten: null | (() => void) = null;

function pushLog(s: string) {
  logs.value.push(s);
  if (logs.value.length > 300) logs.value.splice(0, logs.value.length - 300);
}

async function onPlay(){
  busy.value = true;
  pushLog('Atualizando Client...');
  try {
    await invoke("cmd_play");
  } catch (e) {
    pushLog('Falha ao iniciar: ' + String(e));
    busy.value = false;
  }
}

onMounted(async () => {
  unlisten = await listen<any>("progress", (evt) => {
    const p = evt.payload as { percent: number; phase: string; step: string };
    percent.value = Math.max(0, Math.min(100, p.percent ?? 0));
    pushLog(`[${p.phase}] ${p.step}`);
    if (p.phase === 'launch' && p.step === 'started') busy.value = false;
  });
});

onBeforeUnmount(() => { if (unlisten) unlisten(); });
</script>
