import { describe, expect, it, vi } from 'vitest';
import {
  applyQaAuthAppVerificationIfEnabled,
  isQaAuthEnabled,
  replaceRecaptchaVerifier,
  type ClearableRecaptchaVerifier,
  type RecaptchaVerifierRef,
} from './recaptchaLifecycle';
import type { Auth } from 'firebase/auth';

const container = {} as HTMLElement;

function makeAuth(initial = false): Auth {
  return {
    settings: { appVerificationDisabledForTesting: initial },
  } as Auth;
}

describe('QA auth app-verification gate', () => {
  it('isQaAuthEnabled is strict: only the string "true" enables', () => {
    expect(isQaAuthEnabled({})).toBe(false);
    expect(isQaAuthEnabled({ VITE_QA_AUTH: undefined })).toBe(false);
    expect(isQaAuthEnabled({ VITE_QA_AUTH: '' })).toBe(false);
    expect(isQaAuthEnabled({ VITE_QA_AUTH: 'false' })).toBe(false);
    expect(isQaAuthEnabled({ VITE_QA_AUTH: 'True' })).toBe(false);
    expect(isQaAuthEnabled({ VITE_QA_AUTH: '1' })).toBe(false);
    expect(isQaAuthEnabled({ VITE_QA_AUTH: 'true' })).toBe(true);
  });

  it('production/default does NOT enable appVerificationDisabledForTesting', () => {
    const auth = makeAuth(false);
    const create = vi.fn(() => ({ clear: vi.fn() }));
    const ref: RecaptchaVerifierRef<ClearableRecaptchaVerifier> = { current: null };

    replaceRecaptchaVerifier(ref, auth, 'recaptcha-container', {
      getContainer: () => container,
      create,
      env: {},
    });

    expect(auth.settings.appVerificationDisabledForTesting).toBe(false);
    expect(create).toHaveBeenCalledOnce();
  });

  it('QA builds enable appVerificationDisabledForTesting BEFORE RecaptchaVerifier is created', () => {
    const auth = makeAuth(false);
    const events: string[] = [];
    const ref: RecaptchaVerifierRef<ClearableRecaptchaVerifier> = { current: null };

    replaceRecaptchaVerifier(ref, auth, 'recaptcha-container', {
      getContainer: () => container,
      env: { VITE_QA_AUTH: 'true' },
      create: (firebaseAuth) => {
        events.push('create');
        expect(firebaseAuth.settings.appVerificationDisabledForTesting).toBe(true);
        return { clear: vi.fn() };
      },
    });

    expect(events).toEqual(['create']);
    expect(auth.settings.appVerificationDisabledForTesting).toBe(true);
  });

  it('applyQaAuthAppVerificationIfEnabled is a no-op when the flag is not exactly true', () => {
    const auth = makeAuth(false);
    applyQaAuthAppVerificationIfEnabled(auth, { VITE_QA_AUTH: 'false' });
    expect(auth.settings.appVerificationDisabledForTesting).toBe(false);
  });
});
