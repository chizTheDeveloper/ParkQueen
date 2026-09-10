import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo', storageBucket: 'demo.appspot.com' });
process.env.GCLOUD_PROJECT = 'demo';
const { _haversineMeters, _hydrantRowLatLng, _isWithinNYC } = require('./index.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_SRC = readFileSync(resolve(HERE, 'index.js'), 'utf-8');
const FN_SRC = INDEX_SRC.slice(
  INDEX_SRC.indexOf('// ─── Hydrant proximity'),
  INDEX_SRC.indexOf('exports.createSegmentFromSweepNYC'),
);

describe('_haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(_haversineMeters(40.7, -74, 40.7, -74)).toBe(0);
  });

  it('matches the known length of a degree of latitude', () => {
    expect(_haversineMeters(40.7, -74, 41.7, -74)).toBeCloseTo(111195, -2);
  });

  it('shortens a degree of longitude by latitude, which degree arithmetic would miss', () => {
    // At 40.7N a degree of longitude is ~84.3 km, not ~111.2 km. Treating
    // degrees as interchangeable would be a ~24% error — fatal at a 15 ft rule.
    const lat = _haversineMeters(40.7, -74, 41.7, -74);
    const lng = _haversineMeters(40.7, -74, 40.7, -73);
    expect(lng).toBeCloseTo(84300, -2);
    expect(lng).toBeLessThan(lat * 0.8);
  });

  it('is symmetric', () => {
    const a = _haversineMeters(40.75, -73.98, 40.7501, -73.9805);
    const b = _haversineMeters(40.7501, -73.9805, 40.75, -73.98);
    expect(a).toBeCloseTo(b, 9);
  });

  it('resolves the sub-10-metre distances this feature depends on', () => {
    // ~4.572 m is 15 ft. One ten-thousandth of a degree of latitude is ~11.1 m.
    const d = _haversineMeters(40.75, -73.98, 40.75 + 0.0001, -73.98);
    expect(d).toBeGreaterThan(11.0);
    expect(d).toBeLessThan(11.2);
  });
});

describe('_hydrantRowLatLng', () => {
  it('reads the_geom point coordinates in [lng, lat] order', () => {
    const p = _hydrantRowLatLng({ the_geom: { type: 'Point', coordinates: [-73.79457, 40.77222] } });
    expect(p).toEqual({ lat: 40.77222, lng: -73.79457 });
  });

  it('falls back to the string latitude/longitude columns', () => {
    // Socrata returns these as strings.
    const p = _hydrantRowLatLng({ latitude: '40.7722168', longitude: '-73.79457092' });
    expect(p.lat).toBeCloseTo(40.7722168, 6);
    expect(p.lng).toBeCloseTo(-73.79457092, 6);
  });

  it('rejects malformed rows rather than producing NaN coordinates', () => {
    for (const row of [null, undefined, {}, 'x', 42, { the_geom: {} },
      { the_geom: { coordinates: ['a', 'b'] } }, { latitude: 'abc', longitude: 'def' },
      { latitude: null, longitude: null }]) {
      expect(_hydrantRowLatLng(row)).toBeNull();
    }
  });
});

describe('_isWithinNYC', () => {
  it('accepts the five boroughs', () => {
    const points = [
      [40.7580, -73.9855],  // Times Square
      [40.6782, -73.9442],  // Brooklyn
      [40.7282, -73.7949],  // Queens
      [40.8448, -73.8648],  // Bronx
      [40.5795, -74.1502],  // Staten Island
    ];
    for (const [lat, lng] of points) expect(_isWithinNYC(lat, lng)).toBe(true);
  });

  it('rejects points outside the city, where a NYC-only dataset says nothing', () => {
    for (const [lat, lng] of [[34.05, -118.24], [41.88, -87.63], [51.5, -0.12], [0, 0]]) {
      expect(_isWithinNYC(lat, lng)).toBe(false);
    }
  });
});

describe('checkHydrantDistance — request construction and privacy', () => {
  it('sends the app token as a header, never in the query string', () => {
    expect(FN_SRC).toContain("headers['X-App-Token'] = token");
    expect(FN_SRC).not.toContain('$$app_token');
    // The URLSearchParams block must not carry the token. Compare on stripped
    // source so the comment explaining the rule does not satisfy it.
    const params = FN_SRC
      .slice(FN_SRC.indexOf('new URLSearchParams'), FN_SRC.indexOf('const headers'))
      .replace(/\/\/.*$/gm, '');
    expect(params).not.toMatch(/token/i);
  });

  it('reuses the existing Socrata secret rather than defining another', () => {
    expect(FN_SRC).toContain('_socrataToken()');
    const secretDefs = INDEX_SRC.match(/defineSecret\("SOCRATA_APP_TOKEN"\)/g) || [];
    expect(secretDefs).toHaveLength(1);
  });

  it('bounds the query to a radius instead of downloading the dataset', () => {
    expect(FN_SRC).toContain('within_circle(the_geom');
    expect(FN_SRC).toContain('$limit');
    expect(FN_SRC).toContain('HYDRANT_SEARCH_RADIUS_M = 60');
  });

  it('never logs the submitted coordinate or the request URL', () => {
    const logs = FN_SRC.split('\n').filter(l => /console\.(log|warn|error)/.test(l)).join('\n');
    expect(logs.length).toBeGreaterThan(0);
    for (const forbidden of ['${lat}', '${lng}', 'params', 'url', 'token']) {
      expect(logs).not.toContain(forbidden);
    }
  });

  it('never writes the coordinate to Firestore', () => {
    const callable = INDEX_SRC.slice(
      INDEX_SRC.indexOf('exports.checkHydrantDistance'),
      INDEX_SRC.indexOf('exports.createSegmentFromSweepNYC'),
    );
    for (const write of ['.set(', '.add(', '.update(', 'FieldValue']) {
      expect(callable).not.toContain(write);
    }
  });

  it('requires auth, App Check and a rate limit', () => {
    const callable = INDEX_SRC.slice(
      INDEX_SRC.indexOf('exports.checkHydrantDistance'),
      INDEX_SRC.indexOf('exports.createSegmentFromSweepNYC'),
    );
    expect(callable).toContain('enforceAppCheck: true');
    expect(callable).toContain("if (!request.auth) throw new HttpsError('unauthenticated'");
    expect(callable).toMatch(/checkRateLimit\(request\.auth\.uid, 'checkHydrantDistance', \{ limit: 60, windowSec: 3600 \}\)/);
  });

  it('validates coordinates before spending a rate-limit slot or a provider call', () => {
    const callable = INDEX_SRC.slice(
      INDEX_SRC.indexOf('exports.checkHydrantDistance'),
      INDEX_SRC.indexOf('exports.createSegmentFromSweepNYC'),
    );
    const validation = callable.indexOf('must be valid coordinates');
    const rateLimit = callable.indexOf('checkRateLimit');
    expect(validation).toBeGreaterThan(-1);
    expect(validation).toBeLessThan(rateLimit);
  });

  it('has a request timeout so a hung provider cannot pin the function open', () => {
    expect(FN_SRC).toContain('AbortController');
    expect(FN_SRC).toContain('clearTimeout(timer)');
  });
});
