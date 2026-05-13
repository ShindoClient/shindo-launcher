import { en, type TranslationKey } from './locales/en';
import { pt } from './locales/pt';

type Locale = Record<TranslationKey, string>;

const locales: Record<string, Locale> = { en, pt };

// Svelte 5 module-level $state — reactive across all consumers
let currentCode = $state('en');

export function setLocale(code: string): void {
  currentCode = locales[code] ? code : 'en';
}

export function getLocale(): string {
  return currentCode;
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const dict = locales[currentCode] ?? en;
  let str: string =
    (dict as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

export const availableLocales = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
] as const;
