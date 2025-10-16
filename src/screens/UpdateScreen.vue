<template>
  <div class="min-h-screen grid place-items-center">
    <div class="text-center space-y-4">
      <div class="animate-pulse text-zinc-400">{{ status }}</div>
      <div v-if="available" class="space-x-2">
        <button class="px-4 py-2 bg-emerald-600 rounded" @click="apply">Aplicar atualização</button>
      </div>
      <button class="px-4 py-2 bg-zinc-700 rounded" @click="goHome">Continuar</button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { check } from "@tauri-apps/plugin-updater";

const status = ref("Verificando atualizações...");
const available = ref(false);

async function goHome() {
  window.location.hash = "#/home";
}

async function apply(){
  try {
    const update = await check();
    if(update?.available){
      await update.downloadAndInstall();
      status.value = "Atualização instalada. Reinicie o app.";
      return;
    }
  } catch(e){
    status.value = "Falha ao aplicar atualização.";
  }
}

onMounted(async () => {
  try {
    const update = await check();
    if(update?.available){
      available.value = true;
      status.value = `Atualização disponível: ${update?.version ?? ''}`;
    } else {
      status.value = "Nenhuma atualização encontrada.";
      setTimeout(goHome, 600);
    }
  } catch (e) {
    status.value = "Falha ao verificar atualizações.";
    setTimeout(goHome, 800);
  }
});
</script>
