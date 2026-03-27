import fs from 'node:fs';
import path from 'node:path';
import type { LaunchLogEntry, LaunchLogLevel } from '@shindo/shared';

export type LogLevel = 'debug' | 'info' | 'error' | 'warn';

const pendingLogs: string[] = [];
const launchLogBuffer: LaunchLogEntry[] = [];
const LAUNCH_LOG_LIMIT = 500;
let logFilePath: string | null = null;

function persistLog(line: string): void {
  if (!logFilePath) {
    pendingLogs.push(line);
    return;
  }
  try {
    fs.appendFileSync(logFilePath, line);
  } catch {
    pendingLogs.push(line);
  }
}

export function flushPendingLogs(): void {
  if (!logFilePath || pendingLogs.length === 0) {
    return;
  }
  try {
    fs.appendFileSync(logFilePath, pendingLogs.join(''));
    pendingLogs.length = 0;
  } catch {
    // keep pending
  }
}

export function initLogFile(userDataPath: string): void {
  try {
    logFilePath = path.join(userDataPath, 'launcher.log');
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    fs.writeFileSync(logFilePath, '', { flag: 'a' });
    flushPendingLogs();
  } catch (error) {
    console.error('Failed to initialise log file', error);
  }
}

export function logMessage(level: LogLevel, message: string): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
  persistLog(line);
  if (level === 'error') {
    console.error(message);
  } else if (level === 'debug') {
    console.debug(message);
  } else if (level === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }
}

export function classifyLaunchLog(
  message: unknown,
  fallback: LaunchLogLevel = 'info',
): LaunchLogLevel {
  const text = String(message ?? '');
  const normalized = text.toLowerCase();
  if (
    normalized.includes('error') ||
    normalized.includes('exception') ||
    normalized.includes('fatal') ||
    normalized.includes('stack trace') ||
    /\[error/.test(normalized)
  ) {
    return 'error';
  }
  if (normalized.includes('warn') || /\[warn/.test(normalized)) {
    return 'warn';
  }
  if (normalized.includes('debug') || normalized.includes('trace') || /\[debug/.test(normalized)) {
    return 'debug';
  }
  return fallback;
}

export function appendLaunchLog(level: LaunchLogLevel, message: string): LaunchLogEntry {
  const entry: LaunchLogEntry = {
    level,
    message,
    timestamp: Date.now(),
  };
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
