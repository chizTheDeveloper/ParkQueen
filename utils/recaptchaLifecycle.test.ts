import { describe, expect, it, vi } from 'vitest';
import {
  clearRecaptchaVerifier,
  replaceRecaptchaVerifier,
  type ClearableRecaptchaVerifier,
  type RecaptchaVerifierRef,
} from './recaptchaLifecycle';

class FakeVerifier {
  clearCalls = 0;

  clear() {
    this.clearCalls += 1;
  }
}

const container = {} as HTMLElement;

describe('flow-owned reCAPTCHA lifecycle', () => {
  it('clears and nulls the verifier owned by the caller', () => {
    const verifier = new FakeVerifier();
    const ref: RecaptchaVerifierRef<FakeVerifier> = { current: verifier };

    clearRecaptchaVerifier(ref);

    expect(verifier.clearCalls).toBe(1);
    expect(ref.current).toBeNull();
  });

  it('nulls the ref even when Firebase clear throws', () => {
    const ref: RecaptchaVerifierRef<ClearableRecaptchaVerifier> = {
      current: { clear: () => { throw new Error('widget already removed'); } },
    };

    expect(() => clearRecaptchaVerifier(ref)).not.toThrow();
    expect(ref.current).toBeNull();
  });

  it('clears an existing verifier before creating its replacement', () => {
    const events: string[] = [];
    const oldVerifier = { clear: () => events.push('clear-old') };
    const nextVerifier = { clear: vi.fn() };
    const ref: RecaptchaVerifierRef<ClearableRecaptchaVerifier> = { current: oldVerifier };

    const result = replaceRecaptchaVerifier(ref, {} as never, 'flow-container', {
      getContainer: id => {
        events.push(`container:${id}`);
        return container;
      },
      create: (_auth, id) => {
        events.push(`create:${id}`);
        return nextVerifier;
      },
    });

    expect(events).toEqual([
      'clear-old',
      'container:flow-container',
      'create:flow-container',
    ]);
    expect(result).toBe(nextVerifier);
    expect(ref.current).toBe(nextVerifier);
  });

  it('fails closed when the flow container is not mounted', () => {
    const ref: RecaptchaVerifierRef<ClearableRecaptchaVerifier> = { current: null };
    const create = vi.fn();

    expect(() => replaceRecaptchaVerifier(ref, {} as never, 'missing-container', {
      getContainer: () => null,
      create,
    })).toThrow('reCAPTCHA container is not mounted: missing-container');
    expect(create).not.toHaveBeenCalled();
    expect(ref.current).toBeNull();
  });

  it('replaces a stale ref whose verifier was already cleared', () => {
    const stale = new FakeVerifier();
    stale.clear();
    const fresh = new FakeVerifier();
    const ref: RecaptchaVerifierRef<FakeVerifier> = { current: stale };

    replaceRecaptchaVerifier(ref, {} as never, 'create-account', {
      getContainer: () => container,
      create: () => fresh,
    });

    expect(stale.clearCalls).toBe(2);
    expect(ref.current).toBe(fresh);
  });

  it('keeps unrelated phone-auth flows independently owned', () => {
    const createAccountRef: RecaptchaVerifierRef<FakeVerifier> = { current: null };
    const deleteReauthRef: RecaptchaVerifierRef<FakeVerifier> = { current: null };
    const createAccountVerifier = new FakeVerifier();
    const deleteReauthVerifier = new FakeVerifier();

    replaceRecaptchaVerifier(createAccountRef, {} as never, 'recaptcha-container', {
      getContainer: () => container,
      create: () => createAccountVerifier,
    });
    replaceRecaptchaVerifier(deleteReauthRef, {} as never, 'reauth-recaptcha-anchor', {
      getContainer: () => container,
      create: () => deleteReauthVerifier,
    });
    clearRecaptchaVerifier(deleteReauthRef);

    expect(createAccountRef.current).toBe(createAccountVerifier);
    expect(createAccountVerifier.clearCalls).toBe(0);
    expect(deleteReauthRef.current).toBeNull();
    expect(deleteReauthVerifier.clearCalls).toBe(1);
  });

  it('leaves one live owner after Strict Mode-style cleanup and remount', () => {
    const created: FakeVerifier[] = [];
    const ref: RecaptchaVerifierRef<FakeVerifier> = { current: null };
    const mount = () => replaceRecaptchaVerifier(ref, {} as never, 'recaptcha-container', {
      getContainer: () => container,
      create: () => {
        const verifier = new FakeVerifier();
        created.push(verifier);
        return verifier;
      },
    });

    mount();
    clearRecaptchaVerifier(ref);
    mount();

    expect(created).toHaveLength(2);
    expect(created[0].clearCalls).toBe(1);
    expect(created[1].clearCalls).toBe(0);
    expect(ref.current).toBe(created[1]);
  });
});
