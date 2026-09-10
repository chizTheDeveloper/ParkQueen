import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { sanitizeError } = require('./redactForLog');

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_SRC = readFileSync(resolve(HERE, 'index.js'), 'utf-8');

// A recognisable stand-in. Never a real credential — the real one lives only in
// Secret Manager and is never committed, logged, or placed in a URL.
const FAKE_TOKEN = 'TESTONLY-socrata-app-token-abc123';

function extractFn(src, name) {
  const start = src.indexOf('async function ' + name + '(');
  if (start < 0) throw new Error(name + ' not found');
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced braces in ' + name);
}

let calls, logged;
function loadQueryFn(fetchImpl, token) {
  const body = extractFn(INDEX_SRC, '_queryNYCOpenData');
  const rec = (...a) => logged.push(a.map(x => String(x)).join(' '));
  // eslint-disable-next-line no-new-func
  return new Function('fetch', 'console', 'process', 'sanitizeError', '_socrataToken',
    body + '; return _queryNYCOpenData;')(
    async (url, init) => { calls.push({ url, init }); return fetchImpl(url, init); },
    { log: rec, warn: rec, error: rec },
    { env: {} },
    sanitizeError,
    () => token,
  );
}

const okPage = rows => ({ ok: true, status: 200, json: async () => rows });
const row = i => ({
  order_number: 'P-' + i, record_type: 'Current', borough: 'Manhattan', on_street: 'BROADWAY',
  from_street: 'A STREET', to_street: 'B STREET', side_of_street: 'W',
  sign_description: 'NO PARKING MONDAY THURSDAY 8:30AM-10AM',
});

beforeEach(() => { calls = []; logged = []; });

describe('Socrata app token — transport', () => {
  it('is sent as an X-App-Token header', async () => {
    const fn = loadQueryFn(() => okPage([]), FAKE_TOKEN);
    await fn('%BROADWAY%', 'Manhattan');
    expect(calls).toHaveLength(1);
    expect(calls[0].init?.headers?.['X-App-Token']).toBe(FAKE_TOKEN);
  });

  it('is NEVER placed in the URL or query string', async () => {
    const fn = loadQueryFn(() => okPage([]), FAKE_TOKEN);
    await fn('%BROADWAY%', 'Manhattan');
    for (const c of calls) {
      expect(c.url).not.toContain(FAKE_TOKEN);
      expect(c.url).not.toContain('app_token');
      expect(new URL(c.url).searchParams.get('$$app_token')).toBeNull();
    }
  });

  it('is NEVER logged, on success or on failure', async () => {
    const ok = loadQueryFn(() => okPage([row(1)]), FAKE_TOKEN);
    await ok('%BROADWAY%', 'Manhattan');
    const bad = loadQueryFn(() => { throw new Error('boom ' + FAKE_TOKEN); }, FAKE_TOKEN);
    await bad('%BROADWAY%', 'Manhattan');
    const err = loadQueryFn(() => ({ ok: false, status: 403 }), FAKE_TOKEN);
    await err('%BROADWAY%', 'Manhattan');
    expect(logged.join(' | ')).not.toContain(FAKE_TOKEN);
  });

  it('rides along on every paginated request', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => row(i));
    const fn = loadQueryFn(() => okPage(full), FAKE_TOKEN);
    await fn('%BROADWAY%', 'Manhattan');
    expect(calls.length).toBeGreaterThan(1);
    for (const c of calls) expect(c.init.headers['X-App-Token']).toBe(FAKE_TOKEN);
  });

  it('sends no token header at all when none is configured', async () => {
    const fn = loadQueryFn(() => okPage([]), '');
    await fn('%BROADWAY%', 'Manhattan');
    expect(calls[0].init.headers['X-App-Token']).toBeUndefined();
    expect(calls[0].init.headers.Accept).toBe('application/json');
    expect(logged.join(' ')).toContain('SOCRATA_APP_TOKEN not set');
  });

  it('leaves the query semantics untouched', async () => {
    const fn = loadQueryFn(() => okPage([]), FAKE_TOKEN);
    await fn('%WEST 4 STREET%', 'Brooklyn');
    const q = new URL(calls[0].url).searchParams;
    expect(q.get('$where')).toContain("on_street LIKE '%WEST 4 STREET%'");
    expect(q.get('$where')).toContain("record_type='Current'");
    expect(q.get('$where')).toContain("borough='Brooklyn'");
    expect(q.get('$order')).toBe(':id');
    expect(q.get('$limit')).toBe('1000');
  });

  for (const status of [401, 403, 429, 500, 503]) {
    it(`degrades safely on HTTP ${status} with a token present`, async () => {
      const fn = loadQueryFn(() => ({ ok: false, status }), FAKE_TOKEN);
      await expect(fn('%BROADWAY%', 'Manhattan')).resolves.toEqual([]);
      expect(calls).toHaveLength(1); // no retry
    });
  }

  it('degrades safely on a network failure with a token present', async () => {
    const fn = loadQueryFn(() => { throw new Error('ETIMEDOUT'); }, FAKE_TOKEN);
    await expect(fn('%BROADWAY%', 'Manhattan')).resolves.toEqual([]);
  });
});

describe('Socrata app token — scope and wiring', () => {
  it('is declared as a Secret Manager param, not read from a bare env var', () => {
    expect(INDEX_SRC).toMatch(/const socrataAppToken = defineSecret\("SOCRATA_APP_TOKEN"\);/);
    // The only remaining process.env read is the documented local/emulator fallback
    // inside _socrataToken.
    const reads = INDEX_SRC.match(/process\.env\.SOCRATA_APP_TOKEN/g) || [];
    expect(reads).toHaveLength(1);
    const helper = INDEX_SRC.slice(INDEX_SRC.indexOf('function _socrataToken()'));
    expect(helper.slice(0, 400)).toContain('process.env.SOCRATA_APP_TOKEN');
  });

  it('is bound only to the two callables that query Socrata', () => {
    // createSegmentFromSweepNYC (street rules) and checkHydrantDistance (NYC DEP
    // hydrants) are the only consumers, and both reuse this one secret rather
    // than defining another.
    const bindings = INDEX_SRC.match(/secrets: \[[^\]]*socrataAppToken[^\]]*\]/g) || [];
    expect(bindings).toHaveLength(2);
    for (const fn of ['exports.createSegmentFromSweepNYC', 'exports.checkHydrantDistance']) {
      const start = INDEX_SRC.indexOf(fn);
      expect(start).toBeGreaterThan(-1);
      expect(INDEX_SRC.slice(start, start + 420)).toContain('secrets: [socrataAppToken]');
    }
    expect(INDEX_SRC.match(/defineSecret\("SOCRATA_APP_TOKEN"\)/g)).toHaveLength(1);
  });

  it('does not disturb the other secret bindings', () => {
    expect(INDEX_SRC).toMatch(/secrets: \[sendgridApiKey, emailRateLimitPepper\]/);
    expect((INDEX_SRC.match(/secrets: \[geminiApiKey\]/g) || []).length).toBe(3);
    expect(INDEX_SRC).not.toMatch(/secrets: \[[^\]]*socrataAppToken[^\]]*(geminiApiKey|sendgridApiKey)/);
  });

  it('reaches only the Socrata request — never the other providers', () => {
    // Window-slice rather than brace-match: these bodies contain `${...}`
    // template literals, which a naive brace counter mis-reads.
    // Slice from the marker to the START of the next doc comment, so a window
    // can never bleed into a neighbouring function's prose. (Brace-matching is
    // unusable here: these bodies contain `${...}` template literals.)
    const bodyAfter = (marker) => {
      const i = INDEX_SRC.indexOf(marker);
      expect(i, marker).toBeGreaterThan(-1);
      const next = INDEX_SRC.indexOf('\n/**', i);
      return INDEX_SRC.slice(i, next > i ? next : i + 900);
    };
    const overpass = bodyAfter('async function _overpassJson(');
    const nominatim = bodyAfter('async function _reverseGeocodeStreet(');
    // SweepNYC is a statement, not a function: bound it to the request itself.
    const sIdx = INDEX_SRC.indexOf('const sweepUrl =');
    const sweepnyc = INDEX_SRC.slice(sIdx, INDEX_SRC.indexOf('apiData = await res.json()', sIdx));
    for (const [name, body] of [['overpass', overpass], ['nominatim', nominatim], ['sweepnyc', sweepnyc]]) {
      expect(body, name).not.toMatch(/X-App-Token/);
      expect(body, name).not.toMatch(/_socrataToken|socrataAppToken/);
    }
    // Each sends its own headers, and only the OSM pair sends a User-Agent.
    expect(overpass).toContain('OSM_USER_AGENT');
    expect(nominatim).toContain('OSM_USER_AGENT');
  });

  it('the X-App-Token header is the only way the token is attached', () => {
    // One assignment per Socrata consumer, and nothing else carries the token.
    const assignments = INDEX_SRC.match(/headers\['X-App-Token'\]\s*=/g) || [];
    expect(assignments).toHaveLength(2);
    // Other mentions are prose in comments, which carry no credential.
    const codeLines = INDEX_SRC.split('\n')
      .filter(l => l.includes('X-App-Token') && !l.trim().startsWith('*') && !l.trim().startsWith('//'));
    expect(codeLines).toHaveLength(2);
    for (const line of codeLines) expect(line).toMatch(/headers\['X-App-Token'\] = token/);
  });

  it('the token is never committed to the repo', () => {
    // Guard against a real token being pasted in during a future edit.
    expect(INDEX_SRC).not.toMatch(/SOCRATA_APP_TOKEN\s*=\s*['"][A-Za-z0-9]{10,}['"]/);
  });
});
