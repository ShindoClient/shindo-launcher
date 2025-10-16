# Shindo Launcher (Tauri + Vue 3 + TS + Tailwind)

Um launcher minimalista para Minecraft, com backend Tauri (Rust) e frontend Vue 3.

## Requisitos
- Node.js 18+
- pnpm 9+
- Rust (rustup) + toolchain estável
- Git

## Instalação
```bash
pnpm install
```

## Desenvolvimento (Web + Tauri)
```bash
pnpm tauri:dev
```

## Build
```bash
pnpm tauri:build
```

## Variáveis de ambiente
Veja `.env.example` para `LAUNCHER_GIT_URL`, `CLIENT_GIT_URL`, `CLIENT_GIT_BRANCH`, `MIRROR_URLS`.

## Estrutura
- `src/` Vue 3 + Pinia + Tailwind
- `src-tauri/` Tauri (Rust)

## Estado atual
- UI básica (Update, Home, Settings)
- Stores Pinia: config, progresso, logs
- Backend Tauri com módulos stub (self-update, client-update, mojang, java, net_dl, process, progress_bus)

Próximos passos: implementar lógica de update, baixar manifestos Mojang, resolver libs/assets e lançar o jogo.
