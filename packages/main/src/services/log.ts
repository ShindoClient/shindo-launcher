import fs from 'node:fs';
import path from 'node:path';
import type { LaunchLogEntry, LaunchLogLevel } from '@shindo/shared';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LAUNCH_LOG_LIMIT = 500;
const pendingLines: string[] = [];
const launchLogBuffer: LaunchLogEntry[] = [];

let logFilePath: string | null = null;

function writeLine(line: string): void {
  if (!logFilePath) {
    pendingLines.push(line);
    return;
  }
  try {
    fs.appendFileSync(logFilePath, line);
  } catch {
    pendingLines.push(line);
  }
}

function flushPending(): void {
  if (!logFilePath || pendingLines.length === 0) return;
  try {
    fs.appendFileSync(logFilePath, pendingLines.join(''));
    pendingLines.length = 0;
  } catch {
    /* keep pending */
  }
}

export function initLogFile(userDataPath: string): void {
  try {
    logFilePath = path.join(userDataPath, 'launcher.log');
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    fs.writeFileSync(logFilePath, '', { flag: 'a' });
    flushPending();
  } catch (err) {
    console.error('[log] Failed to init log file:', err);
  }
}

export function logMessage(level: LogLevel, message: string): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
  writeLine(line);
  switch (level) {
    case 'error':
      console.error(message);
      break;
    case 'warn':
      console.warn(message);
      break;
    case 'debug':
      console.debug(message);
      break;
    default:
      console.log(message);
  }
}

export function classifyLevel(text: string): LaunchLogLevel {
  const n = text.toLowerCase();
  if (n.includes('error') || n.includes('exception') || n.includes('fatal') || /\[error/.test(n))
    return 'error';
  if (n.includes('warn') || /\[warn/.test(n)) return 'warn';
  if (n.includes('debug') || n.includes('trace') || /\[debug/.test(n)) return 'debug';
  return 'info';
}

export function appendLaunchLog(level: LaunchLogLevel, message: string): LaunchLogEntry {
  const entry: LaunchLogEntry = { level, message, timestamp: Date.now() };
  logMessage(level as LogLevel, message);
  launchLogBuffer.push(entry);
  if (launchLogBuffer.length > LAUNCH_LOG_LIMIT) {
    launchLogBuffer.splice(0, launchLogBuffer.length - LAUNCH_LOG_LIMIT);
  }
  return entry;
}

export function getLaunchLogBuffer(): LaunchLogEntry[] {
  return [...launchLogBuffer];
}

export function clearLaunchLogBuffer(): void {
  launchLogBuffer.length = 0;
}
