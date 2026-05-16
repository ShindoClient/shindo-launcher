# Electrobun Project

This is an Electrobun desktop application.

> IMPORTANT: Electrobun is **NOT** Electron.  
> Do not use Electron APIs, Electron packages, or Electron architecture patterns.

---

## Documentation

- Full API reference: https://blackboard.sh/electrobun/llms.txt
- Getting started: https://docs.electrobunny.ai/electrobun/

---

## Quick Reference

### Imports

#### Main Process (Bun)

```ts
import { BrowserWindow } from "electrobun/bun";
```

#### Browser Context

```ts
import { Electroview } from "electrobun/view";
```

---

## Asset Loading

Use `views://` URLs to load bundled assets.

Example:

```ts
url: "views://mainview/index.html";
```

Views must be configured in `electrobun.config.ts`
so they are built and copied into the application bundle.

---

## Rules

- Do not use Electron APIs
- Do not install Electron-specific packages
- Use Bun-native APIs whenever possible
- Keep Electrobun architecture patterns intact
- Use `electrobun/bun` for native/window APIs
- Use `electrobun/view` inside browser contexts

---

## About

Electrobun is built by Blackboard.

Blackboard is an innovation lab building tools and funding teams
that define the next generation of technology.

- Website: https://blackboard.sh
