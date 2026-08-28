// A browser tab left open across a Hosting deployment can retain references
// to lazy-route chunk hashes that no longer exist once the new deploy's
// manifest is live. The next navigation to one of those routes then fails
// with a dynamic-import error. This module lets the app recover from that
// automatically, once per distinct failure, instead of stranding the user on
// the generic error screen.
//
// Primary path: Vite's build output wraps every dynamic import (all of this
// app's React.lazy() routes) in its own preload helper, which — on failure —
// dispatches a `vite:preloadError` event on window before rethrowing. Vite
// only ever dispatches this event for a genuine preload/import failure, so
// the listener in index.tsx trusts it unconditionally (see
// tryRecoverFromPreloadError) rather than pattern-matching the error message.
//
// Fallback path: ErrorBoundary calls tryRecoverFromChunkError for whatever it
// catches, where there's no such trusted signal — isChunkLoadError narrowly
// allowlists known browser/bundler chunk-failure message shapes so ordinary
// application errors are never mistaken for a stale deploy.

const STORAGE_KEY_PREFIX = 'parqueen:chunkReload:';

/** A key stable for one specific failure (e.g. one specific chunk URL/hash)
 * and different across deployments, so a later, different chunk failure is
 * independently eligible for its own one-time recovery. */
export function getFailureSignature(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

/** True the first time this exact signature is seen this session; false on
 * any repeat, so recovery is attempted at most once per distinct failure.
 * Fails safe (returns false, never throws) if sessionStorage is unavailable —
 * an inability to track "already tried" must never risk a reload loop. */
export function shouldAutoReloadForSignature(signature: string, storage: Storage = window.sessionStorage): boolean {
  const key = STORAGE_KEY_PREFIX + signature;
  try {
    if (storage.getItem(key)) return false;
    storage.setItem(key, '1');
    return true;
  } catch {
    return false;
  }
}

const CHUNK_LOAD_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk [\w.-]+ failed/i,
  /ChunkLoadError/i,
];

/** Narrow allowlist of known dynamic-import/chunk-loading failure shapes —
 * deliberately does not match on generic wording like "failed to fetch"
 * alone, so an unrelated network or Firestore error is never mistaken for a
 * stale deploy. */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error) || !error.message) return false;
  return CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
}

/** Primary recovery path, called from the `vite:preloadError` listener. The
 * event type itself is the trust signal — no message pattern-matching. */
export function tryRecoverFromPreloadError(error: unknown, storage?: Storage): boolean {
  if (!shouldAutoReloadForSignature(getFailureSignature(error), storage)) return false;
  window.location.reload();
  return true;
}

/** Fallback recovery path, called from ErrorBoundary for an arbitrary caught
 * error — narrows to known chunk-failure shapes first, then applies the same
 * once-per-signature guard (shared key space with the primary path, so a
 * failure already handled there is never double-attempted here). */
export function tryRecoverFromChunkError(error: unknown, storage?: Storage): boolean {
  if (!isChunkLoadError(error)) return false;
  return tryRecoverFromPreloadError(error, storage);
}

/**
 * The `vite:preloadError` listener itself (registered once, at module scope,
 * in index.tsx). preventDefault() is Vite's documented way to suppress its
 * default rethrow, so it's only called when tryRecoverFromPreloadError
 * actually took over recovery — a repeat of the same failure is left to
 * rethrow and hit ErrorBoundary's manual Reload UI as before.
 */
export function handleVitePreloadError(event: Event & { payload?: unknown }): void {
  if (tryRecoverFromPreloadError(event.payload)) {
    event.preventDefault();
  }
}
