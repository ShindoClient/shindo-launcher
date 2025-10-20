# Shindo Launcher

Shindo Launcher is a cross-platform Minecraft launcher built with Electron, Svelte and TypeScript. It keeps the experience compact and single-page while orchestrating updates, runtime management and game launch.

## Feature Highlights

- **Sequential startup updates**: launcher self-update, managed JRE download (Azul Zulu / Eclipse Temurin) and Shindo client sync, with progress events streamed to the renderer.
- **Configurable runtime**: RAM slider, JVM argument textarea and JRE selector persisted in `.shindo/config.json`.
- **Svelte renderer**: Update, Home and Settings screens share a central store (`appStore`) that mirrors IPC state and logs.
- **Launch telemetry**: real-time log forwarding from the Electron main process, PID reporting and graceful error handling.

## Tech Stack

- Electron (main & preload, TypeScript)
- Svelte + Tailwind CSS (renderer)
- minecraft-launcher-core for launching
- Adm-Zip / tar for archive extraction
- pnpm workspaces tying `main`, `preload`, `renderer`, `shared`

## Getting Started

```bash
pnpm install
pnpm dev
```

The dev script runs:
- Vite dev server (Svelte renderer)
- TypeScript watchers for `shared`, `preload`, `main`
- Electron pointed at the compiled output (`dist/main`, `dist/preload`)

## Building / Packaging

```bash
pnpm build        # builds shared + preload + main + renderer
pnpm package      # builds and then runs electron-builder (installer generation)
```

Artifacts land in `dist/` (`main`, `preload`, `renderer`). `pnpm package` expects the electron-builder configuration to be extended in future phases.

## Runtime Management

`packages/main/src/services/jreManager.ts` downloads and prepares runtimes when the user selects Azul Zulu or Eclipse Temurin:

- Supports Windows, macOS and Linux on x64/arm64.
- Extracts into `.shindo/runtime/<distro>` and caches the resolved `java` binary in the launcher config.
- Falls back to the system JRE if a platform/architecture is not mapped or a download fails.

The update orchestrator (`packages/main/src/services/updateOrchestrator.ts`) emits progress via `IpcEvent.UpdateProgress`, so the renderer can animate the Update screen.

## Renderer Overview

Svelte components live under `packages/renderer/src`:

- `App.svelte` switches between `UpdateScreen`, `HomeScreen` and `SettingsScreen` using the central store.
- `store/appStore.ts` is a Svelte store coordinating IPC calls (config, memory, startup update, launch) and log aggregation.
- `HomeScreen.svelte` exposes the Play button, runtime summary and streaming log pane.
- `SettingsScreen.svelte` edits persisted launcher settings with immediate saves.

Tailwind classes keep the layout to a fixed viewport without scroll.

## IPC Surface (`window.shindo`)

The preload bridge exposes a typed API defined in `packages/shared/src/index.ts`:

- `runStartupUpdate()` – execute the launcher/JRE/client update pipeline
- `ensureClientUpToDate()`, `getClientState()` – client management helpers
- `checkLauncherUpdate()`, `downloadLauncherUpdate()` – self update queries
- `getConfig()`, `setConfig()` – persisted settings
- `getSystemMemory()` – total RAM (GB) for slider bounds
- `launchClient()` – start Minecraft with the resolved runtime
- Event subscriptions: `onUpdateProgress`, `onUpdateCompleted`, `onUpdateError`, `onLaunchLog`, `onLaunchExit`

## Repository Layout

```
packages/
├─ main/       # Electron main process, IPC handlers, launcher services
├─ preload/    # Context bridge exposing window.shindo
├─ renderer/   # Svelte SPA (Update/Home/Settings + stores)
├─ shared/     # IPC enums, payload contracts
```

Configurations:
- `tsconfig.base.json` shared compiler defaults
- `packages/renderer/svelte.config.js` + `vite.config.ts` for Svelte/Vite
- `package.json` scripts wire the workspace builds and dev flow

