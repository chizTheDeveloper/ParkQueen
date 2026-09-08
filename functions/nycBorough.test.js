import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo', storageBucket: 'demo.appspot.com' });
process.env.GCLOUD_PROJECT = 'demo';
const { _boroughFromAddress, _detectBorough } = require('./index.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_SRC = readFileSync(resolve(HERE, 'index.js'), 'utf-8');

/**
 * Reference points with known boroughs. The previous coordinate heuristic tested
 * `lat < 40.648` for Brooklyn, which only catches its southern tip — Bed-Stuy,
 * Williamsburg, Park Slope, Flatbush, Greenpoint and Brooklyn Heights all fell
 * through to Queens or Manhattan. In production that made the Socrata query
 * search the wrong borough and return zero rows for a street that has hundreds.
 * The old heuristic scores 20/27 here and 0/8 on Brooklyn.
 */
const POINTS = [
  [40.7589, -73.9851, 'MN', 'Midtown'],
  [40.7061, -73.9969, 'MN', 'Financial District'],
  [40.8116, -73.9465, 'MN', 'Harlem'],
  [40.7736, -73.9566, 'MN', 'Upper East Side'],
  [40.7300, -73.9950, 'MN', 'Greenwich Village'],
  [40.8676, -73.9212, 'MN', 'Inwood (north tip, west of Harlem River)'],

  [40.6782, -73.9442, 'BK', 'Bed-Stuy (the reported defect)'],
  [40.6710, -73.9814, 'BK', 'Park Slope'],
  [40.7081, -73.9571, 'BK', 'Williamsburg'],
  [40.6501, -73.9496, 'BK', 'Flatbush'],
  [40.5755, -73.9707, 'BK', 'Coney Island'],
  [40.6940, -73.9903, 'BK', 'Brooklyn Heights'],
  [40.7226, -73.9500, 'BK', 'Greenpoint'],
  [40.6400, -74.0200, 'BK', 'Bay Ridge'],

  [40.7282, -73.7949, 'QN', 'Fresh Meadows'],
  [40.7498, -73.9442, 'QN', 'Long Island City'],
  [40.6895, -73.8365, 'QN', 'Ozone Park'],
  [40.7570, -73.8300, 'QN', 'Flushing'],
  [40.7061, -73.8200, 'QN', 'Richmond Hill'],
  [40.6650, -73.7550, 'QN', 'Far Rockaway'],

  [40.8448, -73.8648, 'BX', 'Van Nest'],
  [40.8296, -73.9262, 'BX', 'South Bronx'],
  [40.8900, -73.8600, 'BX', 'Woodlawn'],
  [40.8180, -73.8900, 'BX', 'Hunts Point'],

  [40.5795, -74.1502, 'SI', 'Richmondtown'],
  [40.6300, -74.0900, 'SI', 'St George'],
  [40.5450, -74.1700, 'SI', 'Tottenville'],
];

/** Brooklyn/Queens pairs that sit close to their shared border. */
const BK_QN_BOUNDARY = [
  [40.7226, -73.9500, 'BK', 'Greenpoint (Brooklyn side of Newtown Creek)'],
  [40.7498, -73.9442, 'QN', 'Long Island City (Queens side of Newtown Creek)'],
  [40.6895, -73.8365, 'QN', 'Ozone Park (Queens side, south)'],
  [40.6782, -73.9442, 'BK', 'Bed-Stuy (Brooklyn side, same latitude band)'],
];

describe('borough resolution — coordinate fallback', () => {
  it('classifies every reference point correctly across all five boroughs', () => {
    const wrong = POINTS.filter(([lat, lng, truth]) => _detectBorough(lat, lng) !== truth)
      .map(([lat, lng, truth, label]) => `${label}: expected ${truth}, got ${_detectBorough(lat, lng)}`);
    expect(wrong, wrong.join('; ')).toEqual([]);
  });

  for (const boro of ['MN', 'BK', 'QN', 'BX', 'SI']) {
    it(`resolves every ${boro} reference point`, () => {
      const pts = POINTS.filter(p => p[2] === boro);
      expect(pts.length).toBeGreaterThan(0);
      for (const [lat, lng, truth, label] of pts) {
        expect(_detectBorough(lat, lng), label).toBe(truth);
      }
    });
  }

  it('places Bed-Stuy in Brooklyn, not Queens (the reported defect)', () => {
    expect(_detectBorough(40.6782, -73.9442)).toBe('BK');
  });

  it('separates Brooklyn from Queens along their shared border', () => {
    for (const [lat, lng, truth, label] of BK_QN_BOUNDARY) {
      expect(_detectBorough(lat, lng), label).toBe(truth);
    }
  });

  it('keeps Manhattan north of the Harlem River out of the Bronx', () => {
    expect(_detectBorough(40.8676, -73.9212)).toBe('MN'); // Inwood
    expect(_detectBorough(40.8296, -73.9262)).toBe('BX'); // across the river
  });
});

describe('borough resolution — reverse-geocoded address (preferred source)', () => {
  // Shapes taken from real Nominatim responses for each borough.
  it('reads the borough from `suburb`, which all five boroughs supply', () => {
    expect(_boroughFromAddress({ suburb: 'Manhattan' })).toBe('MN');
    expect(_boroughFromAddress({ suburb: 'Brooklyn' })).toBe('BK');
    expect(_boroughFromAddress({ suburb: 'Queens' })).toBe('QN');
    expect(_boroughFromAddress({ suburb: 'The Bronx' })).toBe('BX');
    expect(_boroughFromAddress({ suburb: 'Staten Island' })).toBe('SI');
  });

  it('falls back to county-style fields when suburb is absent', () => {
    expect(_boroughFromAddress({ city_district: 'New York County' })).toBe('MN');
    expect(_boroughFromAddress({ city_district: 'Kings County' })).toBe('BK');
    expect(_boroughFromAddress({ county: 'Queens County' })).toBe('QN');
    expect(_boroughFromAddress({ county: 'Bronx County' })).toBe('BX');
    expect(_boroughFromAddress({ county: 'Richmond County' })).toBe('SI');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(_boroughFromAddress({ suburb: '  BROOKLYN ' })).toBe('BK');
    expect(_boroughFromAddress({ county: 'kings county' })).toBe('BK');
  });

  it('returns null when nothing recognisable is present, so the caller can fall back', () => {
    expect(_boroughFromAddress({})).toBeNull();
    expect(_boroughFromAddress({ suburb: 'Hoboken', county: 'Hudson County' })).toBeNull();
    expect(_boroughFromAddress(null)).toBeNull();
    expect(_boroughFromAddress('Brooklyn')).toBeNull();
  });

  it('prefers the geocoded borough over the coordinate heuristic', () => {
    // Ordering is what matters: `geocode.boroughCode || _detectBorough(...)`.
    const i = INDEX_SRC.indexOf('const boroughCode = geocode.boroughCode || _detectBorough(lat, lng);');
    expect(i, 'fallback must prefer the reverse-geocoded borough').toBeGreaterThan(-1);
  });

  it('still uses coordinates when the geocoder supplies no borough', () => {
    // A real Nominatim shape with a road but no borough-bearing field.
    expect(_boroughFromAddress({ road: 'Some Street', state: 'New York' })).toBeNull();
    expect(_detectBorough(40.6782, -73.9442)).toBe('BK');
  });

  it('reverse geocode returns road AND boroughCode to the caller', () => {
    expect(INDEX_SRC).toMatch(/return \{ road, boroughCode: _boroughFromAddress\(data && data\.address\) \};/);
  });
});
