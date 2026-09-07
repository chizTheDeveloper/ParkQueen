import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const config = JSON.parse(readFileSync(resolve(__dirname, '../firebase.json'), 'utf-8'));
const rewrites: Array<{ source: string; destination: string }> = config.hosting?.rewrites ?? [];
const headerBlocks: Array<{ source: string; headers: Array<{ key: string; value: string }> }> =
  config.hosting?.headers ?? [];

/**
 * Hosting header `source` matches the REQUEST path and knows nothing about whether
 * a static file exists. A catch-all '**' rewrite therefore used to serve index.html
 * for a MISSING /assets/*.js while the '**\/*.@(js|css|woff2)' rule still stamped it
 * `public, max-age=31536000, immutable` — caching SPA HTML for a year under a chunk
 * URL. A client holding stale entry HTML would request a deleted chunk, cache HTML in
 * its place, and keep that lazy route broken until site data was cleared.
 *
 * Existence can't be expressed in a header rule, so the fix lives in the rewrite
 * layer: /assets/** is excluded from the SPA fallback. Real files still win (Hosting
 * serves static content before consulting rewrites); missing ones reach Hosting's
 * own 404, which is served no-cache. Verified against a preview channel:
 *   existing /assets/*.js -> 200 immutable
 *   missing  /assets/*.js -> 404 no-cache
 */
function rewriteFor(path: string): string | undefined {
  for (const r of rewrites) if (matchesRewrite(r.source, path)) return r.destination;
  return undefined; // no rewrite -> Hosting 404
}

function matchesRewrite(source: string, path: string): boolean {
  if (source === path) return true;
  if (source === '**') return true;
  // '/!(seg)' — one path segment that is not `seg`.
  const one = source.match(/^\/!\(([^)]+)\)$/);
  if (one) {
    const rest = path.slice(1);
    return path.startsWith('/') && rest.length > 0 && !rest.includes('/') && rest !== one[1];
  }
  // '/!(seg)/**' — first segment is not `seg`, plus at least one more segment.
  const deep = source.match(/^\/!\(([^)]+)\)\/\*\*$/);
  if (deep) {
    const parts = path.split('/').filter(Boolean);
    return parts.length >= 2 && parts[0] !== deep[1];
  }
  return false;
}

function cacheControlFor(requestPath: string): string | undefined {
  let winner: string | undefined;
  for (const block of headerBlocks) {
    if (!matchesHeader(block.source, requestPath)) continue;
    const cc = block.headers.find(h => h.key === 'Cache-Control');
    if (cc) winner = cc.value; // later match overrides
  }
  return winner;
}

function matchesHeader(source: string, path: string): boolean {
  if (source === path) return true;
  if (source === '**') return true;
  const ext = source.match(/^\*\*\/\*\.@\(([^)]+)\)$/);
  if (ext) return ext[1].split('|').some(s => path.toLowerCase().endsWith('.' + s));
  return false;
}

const MISSING_ASSETS = [
  '/assets/definitely-missing-test-chunk.js',
  '/assets/ProfileView-DEADBEEF.js',
  '/assets/index-DEADBEEF.css',
  '/assets/some-font.woff2',
];

const SPA_ROUTES = ['/', '/terms', '/privacy', '/profile/settings', '/a/b/c/deep/route', '/no-such-route'];

describe('Firebase Hosting missing-asset fallback', () => {
  it('never rewrites a /assets/** request to index.html', () => {
    for (const p of MISSING_ASSETS) {
      expect(rewriteFor(p), `${p} must fall through to Hosting's 404, not the SPA shell`).toBeUndefined();
    }
  });

  it('never lets SPA HTML be cached long-term under an asset URL', () => {
    // The pairing is what matters: a path may carry immutable ONLY if it can never
    // resolve to the SPA shell. Asserting both halves together is what makes a future
    // re-broadening of the rewrite fail this test.
    for (const p of MISSING_ASSETS) {
      const servedHtml = rewriteFor(p) === '/index.html';
      const cc = cacheControlFor(p) ?? '';
      expect(servedHtml && cc.includes('immutable'), `${p} would cache SPA HTML for a year`).toBe(false);
    }
  });

  it('still rewrites every SPA route to the shell', () => {
    for (const p of SPA_ROUTES) {
      expect(rewriteFor(p), `SPA deep link broken at ${p}`).toBe('/index.html');
    }
  });

  it('keeps SPA routes on no-cache', () => {
    for (const p of SPA_ROUTES) expect(cacheControlFor(p)).toBe('no-cache');
  });

  it('preserves immutable caching for real fingerprinted assets', () => {
    for (const p of ['/assets/index-CC1GggNU.js', '/assets/ProfileView-dh7hfOVH.js', '/assets/index-Abc12345.css']) {
      expect(cacheControlFor(p)).toBe('public, max-age=31536000, immutable');
    }
  });

  it('leaves the service worker and manifest on no-cache', () => {
    expect(cacheControlFor('/firebase-messaging-sw.js')).toBe('no-cache');
    expect(cacheControlFor('/manifest.webmanifest')).toBe('no-cache');
  });
});
