import type { BrowserWindow } from 'electron';
import { registerAccountHandlers } from './handlers/accounts';
import { registerClientHandlers } from './handlers/client';
import { registerConfigHandlers } from './handlers/config';
import { registerJavaHandlers } from './handlers/java';
import { registerLaunchHandlers } from './handlers/launch';
import { registerSystemHandlers } from './handlers/system';
import { registerUpdateHandlers } from './handlers/update';
import { registerWindowHandlers } from './handlers/window';

interface HandlerContext {
  getMainWindow: () => BrowserWindow | null;
}

export function registerAllHandlers(ctx: HandlerContext): void {
  registerAccountHandlers();
  registerClientHandlers();
  registerConfigHandlers();
  registerJavaHandlers(ctx.getMainWindow);
  registerLaunchHandlers();
  registerSystemHandlers();
  registerUpdateHandlers();
  registerWindowHandlers(ctx.getMainWindow);
}
