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
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ pages/
│  │  ├─ UpdateScreen.tsx
│  │  ├─ HomeScreen.tsx
│  │  └─ SettingsScreen.tsx
│  ├─ components/
│  │  └─ Progress.tsx
│  └─ styles.css
└─ src-tauri/
   ├─ Cargo.toml
   ├─ tauri.conf.json
   └─ src/
      └─ main.rs
```

## Releases para o updater
- Publique builds na release **`latest`** do repositório `ShindoClient/Shindo-Launcher`.
- O app checa automaticamente na inicialização.
