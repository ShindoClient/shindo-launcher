import os from 'node:os';
import type { SystemMemoryInfo } from '@shindo/shared';

const GIGABYTE = 1024 * 1024 * 1024;

export function getSystemMemory(): SystemMemoryInfo {
  const totalGB = Math.max(1, Math.floor(os.totalmem() / GIGABYTE));
  return { totalGB };
}
