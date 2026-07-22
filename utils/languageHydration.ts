export type SupportedLanguage = 'en' | 'es';

const SUPPORTED: ReadonlySet<string> = new Set(['en', 'es']);

function isSupported(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && SUPPORTED.has(value);
}

/**
 * Pure helper: decides whether App.tsx should call setLang() based on the
 * Firestore profile language vs. the currently active locale.
 *
 * Rules:
 * - If profileLang is a supported value AND differs from activeLang → update.
 * - If profileLang is missing, null, or an unsupported value → no update.
 * - If they already match → no update (prevents loops).
 */
export function getLanguageHydrationAction(
  profileLang: string | null | undefined,
  activeLang: SupportedLanguage,
): { shouldUpdate: false } | { shouldUpdate: true; language: SupportedLanguage } {
  if (isSupported(profileLang) && profileLang !== activeLang) {
    return { shouldUpdate: true, language: profileLang };
  }
  return { shouldUpdate: false };
}
