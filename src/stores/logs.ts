import { defineStore } from "pinia";

export const useLogsStore = defineStore("logs", {
  state: () => ({ lines: [] as string[], max: 500 }),
  actions: {
    push(line: string) {
      this.lines.push(line);
      if (this.lines.length > this.max) this.lines.splice(0, this.lines.length - this.max);
    },
    clear() {
      this.lines = [];
    },
  },
});
