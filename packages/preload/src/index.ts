import { contextBridge } from 'electron';
import { bridge } from './bridge';
import { events } from './events';

contextBridge.exposeInMainWorld('shindo', {
  ...bridge,
  ...events,
});
