import type { ElectrobunConfig } from "electrobun";
export default {
  app: {
    name: "shindo-launcher",
    identifier: "com.shindoclient.launcher",
    version: "0.2.9",
  },
  release: {
    baseUrl:
      "https://github.com/ShindoClient/shindo-launcher/releases/latest/download",
    generatePatch: true,
  },
  build: {
    // Build entrypoint for the bun process
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    // Vite builds to dist/, we copy from there
    // Vite builds src/mainview/public/ into dist/ (e.g. dist/brand/logo.png)
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
      "dist/brand": "views/mainview/brand",
      // loginview — standalone OAuth window bundled by Vite as a second entry
      "dist/loginview/index.html": "views/loginview/index.html",
      "dist/loginview/assets": "views/loginview/assets",
      "dist/loginview/preload.js": "views/loginview/preload.js",
    },
    // Ignore Vite output in watch mode — HMR handles view rebuilds separately
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
      createDmg: true,
    },
    linux: {
      bundleCEF: true,
      icon: "assets/icons/logo.png",
    },
    win: {
      bundleCEF: true,
      icon: "assets/icons/logo.ico",
    },
  },
} satisfies ElectrobunConfig;
