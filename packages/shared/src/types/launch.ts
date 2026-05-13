export type LaunchLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LaunchLogEntry {
  level: LaunchLogLevel;
  message: string;
  timestamp: number;
}

export interface MemoryOptions {
  min?: string;
  max?: string;
}

export interface LaunchOptions {
  username?: string;
  javaPath?: string;
  memory?: MemoryOptions;
  customArgs?: string[];
  customLaunchArgs?: string[];
  versionId?: string;
  build?: number | null;
}

export interface LaunchResult {
  pid: number | null;
  command: string[];
  startedAt: number;
}

export interface LaunchExitPayload {
  code: number | null;
}
