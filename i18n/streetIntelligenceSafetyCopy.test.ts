import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  };
});

describe('Street Intelligence safety-copy language parity', () => {
  it('communicates the same parking and AI limitations in English and Spanish', async () => {
    const { setLang, t } = await import('./index');

    setLang('en');
    expect(t('street_intel.decision_caution')).toBe('Check posted signs and current NYC rules before parking.');
    expect(t('assistant.disclaimer')).toBe('AI interpretation may be incomplete or incorrect. Verify posted signs.');

    setLang('es');
    expect(t('street_intel.decision_caution')).toBe('Revisa las señales publicadas y las reglas actuales de NYC antes de estacionarte.');
    expect(t('assistant.disclaimer')).toBe('La interpretación de IA puede estar incompleta o ser incorrecta. Verifica las señales publicadas.');
  });
});
