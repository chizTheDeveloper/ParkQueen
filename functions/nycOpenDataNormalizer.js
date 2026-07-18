'use strict';

// Expands common street type abbreviations to full DOT words.
// Applied BEFORE ordinal stripping so "81st" doesn't collide with "St" expansion.
const SUFFIX_EXPAND = [
  // Multi-word or ambiguous abbreviations first
  [/\bBlvds?\b/gi, 'Boulevard'],
  [/\bPkwy\b/gi, 'Parkway'],
  [/\bExpwy\b/gi, 'Expressway'],
  [/\bTpkes?\b/gi, 'Turnpike'],
  [/\bHwy\b/gi, 'Highway'],
  [/\bFwy\b/gi, 'Freeway'],
  // Single-letter abbreviations last (to avoid "St" matching inside "1st" etc.)
  // Word-boundary anchors prevent "EAST" → "EAEET"
  [/\bAves?\b/gi, 'Avenue'],
  [/\bRd\b/gi, 'Road'],
  [/\bPl\b/gi, 'Place'],
  [/\bDr\b/gi, 'Drive'],
  [/\bLn\b/gi, 'Lane'],
  [/\bCt\b/gi, 'Court'],
  // "St" last — most likely to conflict with ordinals and directionals
  [/\bSts?\b/gi, 'Street'],
];

/**
 * Converts an OSM-style street name to NYC DOT format (all-caps, no ordinals).
 *
 * "East 85th Street"  → "EAST 85 STREET"
 * "3rd Avenue"        → "3 AVENUE"
 * "West 181st Street" → "WEST 181 STREET"
 * "Amsterdam Ave"     → "AMSTERDAM AVENUE"
 * "Grand Concourse"   → "GRAND CONCOURSE"
 */
function osmNameToDOT(osmName) {
  if (!osmName) return '';
  let s = osmName.trim();
  // Expand abbreviations before stripping ordinals (avoid "St" matching "81st")
  for (const [rx, expansion] of SUFFIX_EXPAND) {
    s = s.replace(rx, expansion);
  }
  // Strip ordinal suffixes from numbers: "85th" → "85", "3rd" → "3"
  s = s.replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1');
  // Uppercase and collapse whitespace
  return s.toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes a street name for comparison (uppercase, single spaces).
 * Works on both OSM and DOT format names.
 */
function normalizeStreetName(name) {
  if (!name) return '';
  return String(name).toUpperCase().replace(/\s+/g, ' ').trim();
}

/**
 * Builds a Socrata LIKE wildcard pattern from a DOT-format name.
 * Handles extra internal spaces in DOT names like "EAST   85 STREET".
 * "EAST 85 STREET" → "EAST%85%STREET"
 */
function streetNameToLikePattern(dotName) {
  return dotName.trim().split(/\s+/).filter(Boolean).join('%');
}

/** Maps _detectBorough codes to NYC Open Data borough name strings. */
const BOROUGH_CODE_TO_NAME = {
  BX: 'Bronx',
  SI: 'Staten Island',
  BK: 'Brooklyn',
  QN: 'Queens',
  MN: 'Manhattan',
};

/**
 * Converts a NYC DOT side_of_street code to a parkingSide cardinal string.
 * "N" → "North", "S" → "South", "E" → "East", "W" → "West"
 */
function dotSideToCardinal(side) {
  const MAP = {
    N: 'North', S: 'South', E: 'East', W: 'West',
    NORTH: 'North', SOUTH: 'South', EAST: 'East', WEST: 'West',
  };
  return MAP[String(side || '').toUpperCase().trim()] || null;
}

/**
 * Builds a deterministic Firestore doc ID for an NYC Open Data block-face segment.
 * Keyed on borough + onStreet + fromStreet + toStreet + side so Broadway block A
 * never deduplicates against Broadway block B.
 */
function nycOdSegmentDocId(boroughCode, dotName, fromStreet, toStreet, side) {
  const norm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `nyc_od_${norm(boroughCode)}_${norm(dotName)}_${norm(fromStreet)}_${norm(toStreet)}_${norm(side)}`.slice(0, 200);
}

/**
 * Selects a single block face from grouped NYC Open Data rows.
 *
 * @param {{ [key: string]: object[] }} groups  — keyed by "from_street|to_street|side"
 * @param {string[]} crossStreets               — up to 2 DOT-normalized cross-street names
 *                                                derived from OSM near user position
 * @returns {{ group: object[], selectionReason: string, score: number } | null}
 *
 * Selection rules:
 *   No crossStreets  → single candidate wins; multiple → null (ambiguous, V1.1 behavior).
 *   With crossStreets → score each group; require score ≥ 3 AND strictly beat second place.
 *   selectionReason values:
 *     'single_candidate'          — 1 group, no cross-street context needed
 *     'exact_cross_street_match'  — both from+to matched (score 6)
 *     'partial_cross_street_match'— one of from/to matched (score 3–5)
 *     null return                 — ambiguous; caller returns nyc_open_data_ambiguous_block
 */
function selectBlockFace(groups, crossStreets = []) {
  const keys = Object.keys(groups);
  if (!keys.length) return null;

  // No cross-street context: V1.1 conservative behavior
  if (!crossStreets.length) {
    if (keys.length === 1) return { group: groups[keys[0]], selectionReason: 'single_candidate', score: 0 };
    return null;
  }

  // Score each group by how many cross streets match from_street / to_street
  const scored = keys.map(key => {
    const [fromStr, toStr] = key.split('|');
    const fromDot = String(fromStr || '').toUpperCase().replace(/\s+/g, ' ').trim();
    const toDot   = String(toStr   || '').toUpperCase().replace(/\s+/g, ' ').trim();
    let score = 0;
    for (const cs of crossStreets) {
      if (cs === fromDot) score += 3;
      if (cs === toDot)   score += 3;
    }
    return { key, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const best   = scored[0];
  const second = scored[1];

  // Require at least one definite match
  if (best.score < 3) return null;
  // Tie with next candidate → ambiguous
  if (second && best.score === second.score) return null;

  const selectionReason = best.score >= 6 ? 'exact_cross_street_match' : 'partial_cross_street_match';
  return { group: groups[best.key], selectionReason, score: best.score };
}

module.exports = {
  osmNameToDOT, normalizeStreetName, streetNameToLikePattern,
  dotSideToCardinal, BOROUGH_CODE_TO_NAME,
  nycOdSegmentDocId, selectBlockFace,
};
