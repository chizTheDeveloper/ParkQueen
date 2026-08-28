import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getFailureSignature,
  shouldAutoReloadForSignature,
  isChunkLoadError,
  tryRecoverFromPreloadError,
  tryRecoverFromChunkError,
  handleVitePreloadError,
} from './staleChunkRecovery';

// A minimal in-memory Storage implementation, plus one that throws on every
// call (simulating sessionStorage being unavailable — private browsing,
// quota exceeded, etc.) to prove the "fails safe" contract.
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

function throwingStorage(): Storage {
  return {
    getItem: () => { throw new Error('storage unavailable'); },
    setItem: () => { throw new Error('storage unavailable'); },
    removeItem: () => { throw new Error('storage unavailable'); },
    clear: () => { throw new Error('storage unavailable'); },
    key: () => { throw new Error('storage unavailable'); },
    get length(): number { throw new Error('storage unavailable'); },
  };
}

describe('getFailureSignature', () => {
  it('uses the Error message as the signature', () => {
    expect(getFailureSignature(new Error('Failed to fetch dynamically imported module: https://x/assets/A-hash1.js')))
      .toBe('Failed to fetch dynamically imported module: https://x/assets/A-hash1.js');
  });

  it('falls back to String() for a non-Error payload', () => {
    expect(getFailureSignature('some string')).toBe('some string');
  });

  it('different chunk hashes produce different signatures (future-deploy eligibility)', () => {
    const sigA = getFailureSignature(new Error('Failed to fetch dynamically imported module: https://x/assets/A-hash1.js'));
    const sigB = getFailureSignature(new Error('Failed to fetch dynamically imported module: https://x/assets/A-hash2.js'));
    expect(sigA).not.toBe(sigB);
  });
});

describe('shouldAutoReloadForSignature', () => {
  it('returns true the first time a signature is seen, false on repeat', () => {
    const storage = fakeStorage();
    expect(shouldAutoReloadForSignature('sig-A', storage)).toBe(true);
    expect(shouldAutoReloadForSignature('sig-A', storage)).toBe(false);
  });

  it('a different signature is independently eligible (future different deployment)', () => {
    const storage = fakeStorage();
    expect(shouldAutoReloadForSignature('sig-A', storage)).toBe(true);
    expect(shouldAutoReloadForSignature('sig-A', storage)).toBe(false);
    expect(shouldAutoReloadForSignature('sig-B', storage)).toBe(true);
  });

  it('fails safe (returns false, does not throw) when storage is unavailable', () => {
    const storage = throwingStorage();
    expect(() => shouldAutoReloadForSignature('sig-A', storage)).not.toThrow();
    expect(shouldAutoReloadForSignature('sig-A', storage)).toBe(false);
  });
});

describe('isChunkLoadError', () => {
  it('recognizes known dynamic-import/chunk-loading error shapes', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: https://x/y.js'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading chunk 42 failed'))).toBe(true);
    expect(isChunkLoadError(new Error('ChunkLoadError: Loading chunk 3 failed'))).toBe(true);
  });

  it('does NOT recognize an ordinary TypeError', () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'foo')"))).toBe(false);
  });

  it('does NOT recognize an ordinary React render error', () => {
    expect(isChunkLoadError(new Error('Objects are not valid as a React child'))).toBe(false);
  });

  it('does NOT recognize a generic network/Firestore-style error merely for containing "failed to fetch" wording out of context', () => {
    expect(isChunkLoadError(new Error('FirebaseError: Failed to get document because the client is offline.'))).toBe(false);
    expect(isChunkLoadError(new Error('TypeError: Failed to fetch'))).toBe(false);
  });

  it('does NOT recognize a non-Error value', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('tryRecoverFromPreloadError (primary vite:preloadError path)', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    reloadSpy = vi.fn();
    (globalThis as any).window = { location: { reload: reloadSpy } };
  });

  it('reloads exactly once for a genuine stale-chunk failure', () => {
    const storage = fakeStorage();
    const error = new Error('Failed to fetch dynamically imported module: https://x/assets/A-hash1.js');
    expect(tryRecoverFromPreloadError(error, storage)).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reload again for the exact same failure after the first attempt', () => {
    const storage = fakeStorage();
    const error = new Error('Failed to fetch dynamically imported module: https://x/assets/A-hash1.js');
    tryRecoverFromPreloadError(error, storage);
    reloadSpy.mockClear();
    expect(tryRecoverFromPreloadError(error, storage)).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('a different (future deployment) chunk failure remains eligible for its own one-time reload', () => {
    const storage = fakeStorage();
    tryRecoverFromPreloadError(new Error('Failed to fetch dynamically imported module: https://x/assets/A-hash1.js'), storage);
    reloadSpy.mockClear();
    const later = new Error('Failed to fetch dynamically imported module: https://x/assets/B-hash2.js');
    expect(tryRecoverFromPreloadError(later, storage)).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('trusts the event payload unconditionally (e.g. a CSS preload failure) since Vite only dispatches this for genuine preload failures', () => {
    const storage = fakeStorage();
    const cssError = new Error('Unable to preload CSS for https://x/assets/A-hash1.css');
    expect(tryRecoverFromPreloadError(cssError, storage)).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});

describe('tryRecoverFromChunkError (ErrorBoundary fallback path)', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    reloadSpy = vi.fn();
    (globalThis as any).window = { location: { reload: reloadSpy } };
  });

  it('reloads once for a recognized chunk-load-shaped error not yet attempted', () => {
    const storage = fakeStorage();
    expect(tryRecoverFromChunkError(new Error('Loading chunk 7 failed'), storage)).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT reload for an ordinary application error', () => {
    const storage = fakeStorage();
    expect(tryRecoverFromChunkError(new TypeError('x is not a function'), storage)).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('does NOT reload again for the same chunk-load failure after one attempt', () => {
    const storage = fakeStorage();
    const error = new Error('Loading chunk 7 failed');
    tryRecoverFromChunkError(error, storage);
    reloadSpy.mockClear();
    expect(tryRecoverFromChunkError(error, storage)).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('shares the same signature guard as the primary path (a failure already handled via vite:preloadError is not re-attempted here)', () => {
    const storage = fakeStorage();
    const error = new Error('Failed to fetch dynamically imported module: https://x/assets/A-hash1.js');
    expect(tryRecoverFromPreloadError(error, storage)).toBe(true);
    reloadSpy.mockClear();
    expect(tryRecoverFromChunkError(error, storage)).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});

describe('handleVitePreloadError (the actual window listener wired up in index.tsx)', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    reloadSpy = vi.fn();
    (globalThis as any).window = { location: { reload: reloadSpy }, sessionStorage: fakeStorage() };
  });

  function fakeEvent(payload: unknown) {
    return { payload, preventDefault: vi.fn() };
  }

  it('calls preventDefault and reloads for a genuine, not-yet-attempted preload failure', () => {
    const event = fakeEvent(new Error('Failed to fetch dynamically imported module: https://x/assets/A-hash1.js'));
    handleVitePreloadError(event as any);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT call preventDefault for a repeat of the same failure — lets it rethrow to the ErrorBoundary', () => {
    const payload = new Error('Failed to fetch dynamically imported module: https://x/assets/A-hash1.js');
    handleVitePreloadError(fakeEvent(payload) as any);
    reloadSpy.mockClear();
    const secondEvent = fakeEvent(payload);
    handleVitePreloadError(secondEvent as any);
    expect(secondEvent.preventDefault).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
