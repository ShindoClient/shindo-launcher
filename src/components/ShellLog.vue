<template>
  <pre class="bg-black/60 text-xs p-2 rounded h-40 overflow-auto whitespace-pre-wrap">{{ logs.join("\n") }}</pre>
</template>
<script setup lang="ts">
defineProps<{ logs: string[] }>();
</script>
