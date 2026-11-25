import { TranslationDict, TranslationKey, en } from './en';

export type Locale = 'en';

const dictionaries: Record<Locale, TranslationDict> = {
  en,
};

let currentLocale: Locale = 'en';

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (dictionaries[locale]) {
    currentLocale = locale;
  }
}

export function t(
  key: TranslationKey,
  vars?: Record<string, string | number>
): string {
  const template = dictionaries[currentLocale][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`
  );
}

export type { TranslationKey };
