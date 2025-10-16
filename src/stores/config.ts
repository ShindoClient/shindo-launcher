import { defineStore } from "pinia";

export interface LauncherConfig {
  java: {
    distro: "Zulu" | "Temurin" | "Liberica";
    path?: string;
  };
  memory: { min: number; max: number };
  resolution: { width: number; height: number; fullscreen: boolean };
  jvmArgs: string[];
  client: { git: { url: string; branch: string } };
  featuredImagePath: string;
  gameDir: string;
}

const defaultConfig: LauncherConfig = {
  java: { distro: "Zulu" },
  memory: { min: 512, max: 4096 },
  resolution: { width: 1280, height: 720, fullscreen: false },
  jvmArgs: [],
  client: { git: { url: "", branch: "main" } },
  featuredImagePath: "/src/assets/shindo-logo.png",
  gameDir: "~/.shindo",
};

export const useConfigStore = defineStore("config", {
  state: () => ({ config: defaultConfig as LauncherConfig }),
  actions: {
    setConfig(cfg: LauncherConfig) {
      this.config = cfg;
    },
  },
});
