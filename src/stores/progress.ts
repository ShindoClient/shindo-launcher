import { defineStore } from "pinia";

export type Phase =
  | "launcher_update"
  | "client_update"
  | "resolve_manifest"
  | "download_libs"
  | "download_assets"
  | "prepare_natives"
  | "launch";

export interface ProgressEvt {
  phase: Phase;
  step: string;
  current: number;
  total: number;
  percent: number;
}

export const useProgressStore = defineStore("progress", {
  state: () => ({ current: 0, total: 100, percent: 0, phase: "launcher_update" as Phase, step: "" }),
  actions: {
    update(evt: ProgressEvt) {
      this.phase = evt.phase;
      this.step = evt.step;
      this.current = evt.current;
      this.total = evt.total;
      this.percent = evt.percent;
    },
    reset() {
      this.current = 0;
      this.total = 100;
      this.percent = 0;
      this.phase = "launcher_update";
      this.step = "";
    },
  },
});
