/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { LauncherBridge } from '@shindo/shared';

declare global {
  interface Window {
    shindo: LauncherBridge;
  }
}

export {};
