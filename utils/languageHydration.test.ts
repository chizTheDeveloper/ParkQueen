import { describe, it, expect } from 'vitest';
import { getLanguageHydrationAction } from './languageHydration';

describe('getLanguageHydrationAction', () => {
  it('profile en overrides active es', () => {
    const r = getLanguageHydrationAction('en', 'es');
    expect(r.shouldUpdate).toBe(true);
    if (r.shouldUpdate) expect(r.language).toBe('en');
  });

  it('profile es overrides active en', () => {
    const r = getLanguageHydrationAction('es', 'en');
    expect(r.shouldUpdate).toBe(true);
    if (r.shouldUpdate) expect(r.language).toBe('es');
  });

  it('matching profile and active cause no update', () => {
    expect(getLanguageHydrationAction('en', 'en').shouldUpdate).toBe(false);
    expect(getLanguageHydrationAction('es', 'es').shouldUpdate).toBe(false);
  });

  it('missing profile language preserves active locale', () => {
    expect(getLanguageHydrationAction(undefined, 'en').shouldUpdate).toBe(false);
    expect(getLanguageHydrationAction(null, 'es').shouldUpdate).toBe(false);
  });

  it('unsupported Firestore value is ignored', () => {
    expect(getLanguageHydrationAction('fr', 'en').shouldUpdate).toBe(false);
    expect(getLanguageHydrationAction('', 'en').shouldUpdate).toBe(false);
    expect(getLanguageHydrationAction('EN', 'es').shouldUpdate).toBe(false);
    expect(getLanguageHydrationAction('español', 'en').shouldUpdate).toBe(false);
  });

  it('already-matching profile causes no update (loop prevention)', () => {
    // Simulates a second hydration call after setLang already ran
    expect(getLanguageHydrationAction('es', 'es').shouldUpdate).toBe(false);
  });
});
