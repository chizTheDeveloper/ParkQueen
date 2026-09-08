import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo', storageBucket: 'demo.appspot.com' });
process.env.GCLOUD_PROJECT = 'demo';
const { _overpassJson } = require('./index.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_SRC = readFileSync(resolve(HERE, 'index.js'), 'utf-8');

/**
 * Overpass answers 504 with an HTML error page while still sending
 * `Content-Type: application/json`. Both callers used to do `await res.json()`
 * with no status check, so JSON.parse threw a SyntaxError that they swallowed —
 * observed in production as:
 *   [NYCOpenData] cross-street fetch error: SyntaxError
 * which emptied the cross-street list and forced nyc_open_data_ambiguous_block.
 */
const HTML_504 = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN">
<html><body><p>Error: Gateway Timeout</p></body></html>`;

let calls;
const origFetch = globalThis.fetch;
const stub = (impl) => { globalThis.fetch = async (...a) => { calls.push(a[0]); return impl(...a); }; };

beforeEach(() => { calls = []; });
afterEach(() => { globalThis.fetch = origFetch; });

const res = (status, body, ok) => ({
  ok: ok !== undefined ? ok : status >= 200 && status < 300,
  status,
  text: async () => body,
  json: async () => { throw new Error('json() must not be called by _overpassJson'); },
});

describe('_overpassJson — response handling', () => {
  it('returns parsed JSON on a 200 with a JSON body', async () => {
    stub(() => res(200, JSON.stringify({ elements: [{ id: 1 }] })));
    const out = await _overpassJson('[out:json];way(1);out;', 'test');
    expect(out).toEqual({ elements: [{ id: 1 }] });
    expect(calls).toHaveLength(1);
  });

  it('accepts a top-level JSON array body', async () => {
    stub(() => res(200, '[1,2,3]'));
    await expect(_overpassJson('q', 'test')).resolves.toEqual([1, 2, 3]);
  });

  for (const status of [429, 500, 502, 503, 504]) {
    it(`returns null on HTTP ${status} without parsing the body`, async () => {
      stub(() => res(status, HTML_504));
      const out = await _overpassJson('q', 'test');
      expect(out).toBeNull();
      expect(calls).toHaveLength(1); // single-shot: no retry, no amplification
    });
  }

  it('returns null for an HTML body served with a 200 (never throws SyntaxError)', async () => {
    // The exact production shape: HTML mislabelled as application/json.
    stub(() => res(200, HTML_504));
    await expect(_overpassJson('q', 'test')).resolves.toBeNull();
  });

  it('returns null on malformed JSON rather than throwing', async () => {
    stub(() => res(200, '{"elements": [oops'));
    await expect(_overpassJson('q', 'test')).resolves.toBeNull();
  });

  it('returns null on a network failure/timeout', async () => {
    stub(() => { throw new Error('ETIMEDOUT'); });
    await expect(_overpassJson('q', 'test')).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('never calls res.json() — the stub throws if it does', async () => {
    // res().json() rejects, so any use of it would surface as a rejected promise
    // or a null caused by the wrong path. A 200 JSON body must still parse.
    stub(() => res(200, JSON.stringify({ elements: [] })));
    await expect(_overpassJson('q', 'test')).resolves.toEqual({ elements: [] });
  });

  it('checks res.ok before reading the body, in source', () => {
    const start = INDEX_SRC.indexOf('async function _overpassJson(');
    const body = INDEX_SRC.slice(start, INDEX_SRC.indexOf('\n}', start));
    const okIdx = body.indexOf('if (!res.ok)');
    const readIdx = body.indexOf('await res.text()');
    expect(okIdx).toBeGreaterThan(-1);
    expect(readIdx).toBeGreaterThan(okIdx);
    expect(body).not.toMatch(/res\.json\(\)/);
  });
});

describe('Overpass callers use the guarded helper', () => {
  it('neither Overpass call site parses JSON directly any more', () => {
    // Both _fetchCrossStreets and _fetchStreetGeometry previously had
    // `const data = await res.json();` immediately after fetching Overpass.
    const overpassDirect = INDEX_SRC.match(/overpass-api\.de[^\n]*\n\s*const data = await res\.json\(\)/g);
    expect(overpassDirect).toBeNull();
  });

  it('_fetchCrossStreets routes through _overpassJson and degrades to []', () => {
    const start = INDEX_SRC.indexOf('async function _fetchCrossStreets(');
    const body = INDEX_SRC.slice(start, start + 900);
    expect(body).toMatch(/_overpassJson\(q, 'cross-streets'\)/);
    expect(body).toMatch(/if \(!data \|\| !data\.elements\?\.length\) return \[\];/);
  });

  it('_fetchStreetGeometry routes through _overpassJson and degrades to null', () => {
    const start = INDEX_SRC.indexOf('async function _fetchStreetGeometry(');
    const body = INDEX_SRC.slice(start, start + 900);
    expect(body).toMatch(/_overpassJson\(q, 'street-geometry'\)/);
    expect(body).toMatch(/if \(!data \|\| !data\.elements\?\.length\) return null;/);
  });

  it('no cross streets still yields ambiguous rather than a guessed block face', () => {
    // Safe degradation must be preserved: without cross-street context the
    // fallback reports ambiguity instead of picking one of N candidates.
    expect(INDEX_SRC).toMatch(/nyc_open_data_ambiguous_block/);
    const i = INDEX_SRC.indexOf('ambiguous block face');
    expect(i).toBeGreaterThan(-1);
  });
});
