export type JreStatusSeverity = 'info' | 'warning';

export interface JreStatusPayload {
  severity: JreStatusSeverity;
  message: string;
  source: 'config' | 'launch' | 'update';
}

export interface JavaChooserOptions {
  defaultPath?: string;
}

export interface JavaValidationResult {
  ok: boolean;
  path: string;
  versionText?: string;
  error?: string;
}
