<template>
  <div class="w-full rounded-lg overflow-hidden bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-800 border border-zinc-700">
    <div class="aspect-[11/3] relative">
      <img :src="src" alt="featured" class="absolute inset-0 w-full h-full object-contain p-6 opacity-90" />
    </div>
  </div>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ src?: string }>(), { src: '/src/assets/shindo-logo.png' });
</script>
