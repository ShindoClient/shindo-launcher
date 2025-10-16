<template>
  <div class="w-full bg-zinc-800 rounded h-2">
    <div class="bg-emerald-500 h-2 rounded" :style="{ width: percent + '%' }"></div>
  </div>
</template>
<script setup lang="ts">
defineProps<{ percent: number }>();
</script>
