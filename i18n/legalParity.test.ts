import { describe, expect, it } from 'vitest';
import en from './en';
import es from './es';

const legalSignupKeys = [
  'legal.signup_prefix',
  'legal.signup_between',
  'legal.terms',
  'legal.privacy',
] as const;

describe('legal signup translation parity', () => {
  it.each(legalSignupKeys)('provides distinct non-empty English and Spanish copy for %s', key => {
    expect(en[key]?.trim()).toBeTruthy();
    expect(es[key]?.trim()).toBeTruthy();
    expect(es[key]).not.toBe(en[key]);
  });
});
