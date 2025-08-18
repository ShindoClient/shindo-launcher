# Shindo Launcher (Tauri 2) — Source

Launcher desktop do ShindoClient feito com **Tauri 2 + React + Vite**.

## Rodar no desenvolvimento
```bash
npm install
npm run tauri:dev
```

## Build
```bash
npm run tauri:build
```

## Fluxo do app
1. **UpdateScreen** (inicial): verifica e aplica updates do próprio launcher (GitHub Releases — tag `latest`).
2. **Java**: detecta SO e baixa **Azul Zulu JDK 8** se necessário (em `~/.shindo/java`).
3. **Cliente**: baixa a release `latest` do `ShindoClient/Shindo-Client`, lê o JSON, baixa **assets** e **libraries** (com verificação **SHA1**).
4. Após tudo pronto, navega para **HomeScreen**. O botão **Iniciar** inicia o cliente com RAM, resolução e fullscreen definidos na **SettingsScreen**.

## Estrutura
```
.
├─ package.json
├─ tailwind.config.js
├─ tsconfig.json
├─ vite.config.ts
├─ src/
│  ├─ main.ts
│  ├─ App.svelte
│  ├─ pages/
│  │  ├─ UpdateScreen.svelte
│  │  ├─ HomeScreen.svelte
│  │  └─ SettingsScreen.svelte
│  ├─ components/
│  │  └─ Progress.svelte
│  └─ styles.css
└─ src-tauri/
   ├─ Cargo.toml
   ├─ tauri.conf.json
   └─ src/
      └─ main.rs
      └─ error.rs
      └─ config/
         └─ mod.rs
         └─ settings.rs
         └─ updater.rs
      └─ minecraft/
         └─ mod.rs
         └─ java.rs
         └─ mojang.rs
         └─ launcher.rs
         └─ version.rs

```

## Releases para o updater
- Publique builds na release **`latest`** do repositório `ShindoClient/Shindo-Launcher`.
- O app checa automaticamente na inicialização.
