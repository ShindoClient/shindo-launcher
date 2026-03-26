import { derived, get, writable } from 'svelte/store';
import enRaw from './i18n/locales/en.properties?raw';
import ptBrRaw from './i18n/locales/pt-BR.properties?raw';

export type Language = 'en' | 'pt';

type TranslationTree = Record<string, string | TranslationTree>;

function parseProperties(source: string): Array<[string, string]> {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      if (index === -1) return ['', ''];
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1);
      return [key, value.replace(/\\n/g, '\n')];
    })
    .filter(([key]) => key.length > 0);
}

function buildTree(entries: Array<[string, string]>): TranslationTree {
  const tree: TranslationTree = {};
  for (const [key, value] of entries) {
    const parts = key.split('.');
    let node = tree;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (i === parts.length - 1) {
        node[part] = value;
        continue;
      }
      if (typeof node[part] !== 'object' || node[part] === null) {
        node[part] = {};
      }
      node = node[part] as TranslationTree;
    }
  }
  return tree;
}

const translations: Record<Language, TranslationTree> = {
  en: buildTree(parseProperties(enRaw)),
  pt: buildTree(parseProperties(ptBrRaw)),
};

function resolveKey(lang: Language, key: string): string | undefined {
  return key
    .split('.')
    .reduce<any>((acc, part) => (typeof acc === 'object' ? acc?.[part] : undefined), translations[lang]);
}

function formatValue(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, token) => {
    const value = params[token];
    return value === undefined ? match : String(value);
  });
}

const language = writable<Language>('en');

export const t = derived(language, ($language) => {
  return (key: string, params?: Record<string, string | number>) => {
    const message = resolveKey($language, key) ?? resolveKey('en', key) ?? key;
    return formatValue(String(message), params);
  };
});

export function setLanguage(next: Language): void {
  language.set(next);
}

export function getLanguage(): Language {
  return get(language);
}

export const availableLanguages: Array<{ code: Language; label: string; flag: string }> = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português (Brasil)', flag: '🇧🇷' },
];
