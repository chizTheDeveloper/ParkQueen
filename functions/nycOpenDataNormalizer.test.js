import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
  osmNameToDOT,
  normalizeStreetName,
  streetNameToLikePattern,
  dotSideToCardinal,
  nycOdSegmentDocId,
  selectBlockFace,
} = require('./nycOpenDataNormalizer');

describe('osmNameToDOT — ordinal stripping', () => {
  it('strips th suffix', () => expect(osmNameToDOT('East 85th Street')).toBe('EAST 85 STREET'));
  it('strips st suffix', () => expect(osmNameToDOT('West 181st Street')).toBe('WEST 181 STREET'));
  it('strips nd suffix', () => expect(osmNameToDOT('East 42nd Street')).toBe('EAST 42 STREET'));
  it('strips rd suffix', () => expect(osmNameToDOT('East 23rd Street')).toBe('EAST 23 STREET'));
  it('strips ordinal from avenue', () => expect(osmNameToDOT('1st Avenue')).toBe('1 AVENUE'));
  it('strips ordinal from numbered avenue', () => expect(osmNameToDOT('3rd Avenue')).toBe('3 AVENUE'));
});

describe('osmNameToDOT — suffix expansion', () => {
  it('expands Ave', () => expect(osmNameToDOT('Amsterdam Ave')).toBe('AMSTERDAM AVENUE'));
  it('expands Rd', () => expect(osmNameToDOT('Boston Rd')).toBe('BOSTON ROAD'));
  it('expands Blvd', () => expect(osmNameToDOT('Ocean Blvd')).toBe('OCEAN BOULEVARD'));
  it('expands Pl', () => expect(osmNameToDOT('Maran Pl')).toBe('MARAN PLACE'));
  it('expands Dr', () => expect(osmNameToDOT('Forest Dr')).toBe('FOREST DRIVE'));
  it('expands Ln', () => expect(osmNameToDOT('Oak Ln')).toBe('OAK LANE'));
  it('expands Ct', () => expect(osmNameToDOT('Pine Ct')).toBe('PINE COURT'));
  it('expands Pkwy', () => expect(osmNameToDOT('Southern Pkwy')).toBe('SOUTHERN PARKWAY'));
  it('expands St', () => expect(osmNameToDOT('Main St')).toBe('MAIN STREET'));
});

describe('osmNameToDOT — no mutation of full words', () => {
  it('keeps Avenue', () => expect(osmNameToDOT('Amsterdam Avenue')).toBe('AMSTERDAM AVENUE'));
  it('keeps Street', () => expect(osmNameToDOT('Main Street')).toBe('MAIN STREET'));
  it('keeps Grand Concourse', () => expect(osmNameToDOT('Grand Concourse')).toBe('GRAND CONCOURSE'));
  it('keeps Avenue of the Americas', () => expect(osmNameToDOT('Avenue of the Americas')).toBe('AVENUE OF THE AMERICAS'));
  it('keeps East Tremont Avenue', () => expect(osmNameToDOT('East Tremont Avenue')).toBe('EAST TREMONT AVENUE'));
  it('keeps Maran Place', () => expect(osmNameToDOT('Maran Place')).toBe('MARAN PLACE'));
});

describe('osmNameToDOT — no corruption of directionals', () => {
  // "EAST" contains "ST" but \bSt\b should NOT match inside "EAST"
  it('does not corrupt EAST in East 72nd Street', () => {
    expect(osmNameToDOT('East 72nd Street')).toBe('EAST 72 STREET');
  });
  it('does not corrupt WEST in West 181st Street', () => {
    expect(osmNameToDOT('West 181st Street')).toBe('WEST 181 STREET');
  });
  it('does not corrupt EAST in East 85th Street', () => {
    expect(osmNameToDOT('East 85th Street')).toBe('EAST 85 STREET');
  });
});

describe('osmNameToDOT — whitespace handling', () => {
  it('collapses extra spaces', () => expect(osmNameToDOT('  East  85th  Street  ')).toBe('EAST 85 STREET'));
  it('handles empty string', () => expect(osmNameToDOT('')).toBe(''));
  it('handles null-like', () => expect(osmNameToDOT(null)).toBe(''));
});

describe('normalizeStreetName', () => {
  it('collapses DOT extra spaces', () => {
    expect(normalizeStreetName('EAST   85 STREET')).toBe('EAST 85 STREET');
  });
  it('uppercases mixed case', () => {
    expect(normalizeStreetName('east 85 street')).toBe('EAST 85 STREET');
  });
  it('handles empty string', () => expect(normalizeStreetName('')).toBe(''));
  it('handles null', () => expect(normalizeStreetName(null)).toBe(''));
});

describe('streetNameToLikePattern', () => {
  it('joins tokens with %', () => {
    expect(streetNameToLikePattern('EAST 85 STREET')).toBe('EAST%85%STREET');
  });
  it('handles avenue', () => {
    expect(streetNameToLikePattern('3 AVENUE')).toBe('3%AVENUE');
  });
  it('handles multi-word', () => {
    expect(streetNameToLikePattern('GRAND CONCOURSE')).toBe('GRAND%CONCOURSE');
  });
  it('handles leading/trailing spaces', () => {
    expect(streetNameToLikePattern('  WEST 181 STREET  ')).toBe('WEST%181%STREET');
  });
});

describe('dotSideToCardinal', () => {
  it('maps N → North', () => expect(dotSideToCardinal('N')).toBe('North'));
  it('maps S → South', () => expect(dotSideToCardinal('S')).toBe('South'));
  it('maps E → East', () => expect(dotSideToCardinal('E')).toBe('East'));
  it('maps W → West', () => expect(dotSideToCardinal('W')).toBe('West'));
  it('maps full word NORTH', () => expect(dotSideToCardinal('NORTH')).toBe('North'));
  it('maps full word south (lowercase)', () => expect(dotSideToCardinal('south')).toBe('South'));
  it('returns null for empty string', () => expect(dotSideToCardinal('')).toBeNull());
  it('returns null for null', () => expect(dotSideToCardinal(null)).toBeNull());
  it('returns null for unknown', () => expect(dotSideToCardinal('X')).toBeNull());
});

describe('nycOdSegmentDocId — block-face keyed dedup IDs', () => {
  it('produces different IDs for different block faces on the same street', () => {
    const a = nycOdSegmentDocId('MN', 'BROADWAY', 'WEST 72 STREET', 'WEST 73 STREET', 'W');
    const b = nycOdSegmentDocId('MN', 'BROADWAY', 'WEST 100 STREET', 'WEST 101 STREET', 'W');
    expect(a).not.toBe(b);
  });
  it('produces the same ID for the same block face', () => {
    const a = nycOdSegmentDocId('BX', 'GRAND CONCOURSE', 'EAST 149 STREET', 'EAST 150 STREET', 'E');
    const b = nycOdSegmentDocId('BX', 'GRAND CONCOURSE', 'EAST 149 STREET', 'EAST 150 STREET', 'E');
    expect(a).toBe(b);
  });
  it('produces different IDs for same block face on different sides', () => {
    const a = nycOdSegmentDocId('MN', '3 AVENUE', 'EAST 85 STREET', 'EAST 86 STREET', 'E');
    const b = nycOdSegmentDocId('MN', '3 AVENUE', 'EAST 85 STREET', 'EAST 86 STREET', 'W');
    expect(a).not.toBe(b);
  });
  it('produces different IDs for same block on different boroughs', () => {
    const a = nycOdSegmentDocId('MN', 'BROADWAY', 'WEST 72 STREET', 'WEST 73 STREET', 'W');
    const b = nycOdSegmentDocId('BX', 'BROADWAY', 'WEST 72 STREET', 'WEST 73 STREET', 'W');
    expect(a).not.toBe(b);
  });
  it('stays within 200 chars even for long names', () => {
    const id = nycOdSegmentDocId('MN', 'AVENUE OF THE AMERICAS', 'WEST 100 STREET', 'WEST 101 STREET', 'W');
    expect(id.length).toBeLessThanOrEqual(200);
  });
});

describe('selectBlockFace — block-face selection safety', () => {
  const makeGroup = (from, to, side, count = 2) => {
    const rows = Array.from({ length: count }, () => ({
      from_street: from, to_street: to, side_of_street: side, sign_description: 'NO PARKING 8AM-9AM',
    }));
    return { [`${from}|${to}|${side}`]: rows };
  };

  it('returns single_candidate when only one block face exists', () => {
    const groups = makeGroup('WEST 72 STREET', 'WEST 73 STREET', 'W');
    const result = selectBlockFace(groups);
    expect(result).not.toBeNull();
    expect(result.selectionReason).toBe('single_candidate');
    expect(result.group).toHaveLength(2);
  });

  it('returns null when multiple block faces exist (ambiguous)', () => {
    const groups = {
      ...makeGroup('WEST 72 STREET', 'WEST 73 STREET', 'W'),
      ...makeGroup('WEST 100 STREET', 'WEST 101 STREET', 'W'),
    };
    expect(selectBlockFace(groups)).toBeNull();
  });

  it('returns null for three candidates', () => {
    const groups = {
      ...makeGroup('A ST', 'B ST', 'N'),
      ...makeGroup('B ST', 'C ST', 'N'),
      ...makeGroup('C ST', 'D ST', 'N'),
    };
    expect(selectBlockFace(groups)).toBeNull();
  });

  it('returns null for empty groups object', () => {
    expect(selectBlockFace({})).toBeNull();
  });
});

describe('selectBlockFace — bounding pair + side', () => {
  // Groups keyed by "from|to|side"
  const rows = n => [{ sign_description: `NO PARKING 8AM-9AM ${n}` }];
  const g72 = { 'WEST 72 STREET|WEST 73 STREET|W': rows(1) };
  const g100 = { 'WEST 100 STREET|WEST 101 STREET|W': rows(2) };
  const gBoth = { ...g72, ...g100 };

  // Both faces of one block: the case that used to be an unbreakable tie,
  // because side_of_street was never part of the score.
  const gSides = {
    'ATLANTIC AVENUE|PACIFIC STREET|E': rows('e'),
    'ATLANTIC AVENUE|PACIFIC STREET|W': rows('w'),
  };
  const BOUNDS = ['ATLANTIC AVENUE', 'PACIFIC STREET'];

  it('both bounding streets matched wins outright when only one face exists', () => {
    const r = selectBlockFace(g72, ['WEST 72 STREET', 'WEST 73 STREET'], null);
    expect(r).not.toBeNull();
    expect(r.selectionReason).toBe('bounding_pair');
    expect(r.group).toBe(g72['WEST 72 STREET|WEST 73 STREET|W']);
  });

  it('picks the right block among several candidates', () => {
    const r = selectBlockFace(gBoth, ['WEST 72 STREET', 'WEST 73 STREET'], null);
    expect(r).not.toBeNull();
    expect(r.group).toBe(g72['WEST 72 STREET|WEST 73 STREET|W']);
  });

  it('treats from/to as an unordered pair (the dataset stores both orderings)', () => {
    const a = selectBlockFace(g72, ['WEST 72 STREET', 'WEST 73 STREET'], null);
    const b = selectBlockFace(g72, ['WEST 73 STREET', 'WEST 72 STREET'], null);
    expect(a.group).toBe(b.group);
    expect(a.score).toBe(b.score);
  });

  it('side breaks the tie between the two faces of the same block', () => {
    const west = selectBlockFace(gSides, BOUNDS, 'West');
    const east = selectBlockFace(gSides, BOUNDS, 'East');
    expect(west.group).toBe(gSides['ATLANTIC AVENUE|PACIFIC STREET|W']);
    expect(east.group).toBe(gSides['ATLANTIC AVENUE|PACIFIC STREET|E']);
    expect(west.selectionReason).toBe('bounding_pair_and_side');
  });

  it('opposite sides of the same block resolve to different faces', () => {
    expect(selectBlockFace(gSides, BOUNDS, 'West').group)
      .not.toBe(selectBlockFace(gSides, BOUNDS, 'East').group);
  });

  it('stays ambiguous when both faces exist and the side is unknown', () => {
    expect(selectBlockFace(gSides, BOUNDS, null)).toBeNull();
  });

  it('a side that matches no candidate cannot invent a winner', () => {
    // N/S side against an E/W-sided block: neither candidate earns the bonus.
    expect(selectBlockFace(gSides, BOUNDS, 'North')).toBeNull();
  });

  it('side never overrides wrong cross streets', () => {
    // The 100–101 face carries the matching side, but the bounds point at 72–73.
    const groups = {
      'WEST 72 STREET|WEST 73 STREET|E': rows(1),
      'WEST 100 STREET|WEST 101 STREET|W': rows(2),
    };
    const r = selectBlockFace(groups, ['WEST 72 STREET', 'WEST 73 STREET'], 'West');
    expect(r).not.toBeNull();
    expect(r.group).toBe(groups['WEST 72 STREET|WEST 73 STREET|E']);
  });

  it('partial evidence (one bound only) never forces a choice', () => {
    expect(selectBlockFace(g72, ['WEST 72 STREET', 'AMSTERDAM AVENUE'], null)).toBeNull();
    expect(selectBlockFace(g72, ['WEST 72 STREET', 'UNRELATED AVE'], 'West')).toBeNull();
  });

  it('candidates each matching a different single bound stay ambiguous', () => {
    const groups = {
      'WEST 72 STREET|WEST 73 STREET|W': rows(1),
      'WEST 100 STREET|WEST 101 STREET|W': rows(2),
    };
    expect(selectBlockFace(groups, ['WEST 72 STREET', 'WEST 100 STREET'], 'West')).toBeNull();
  });

  it('no bounding context with multiple groups stays ambiguous', () => {
    expect(selectBlockFace(gBoth, [], 'West')).toBeNull();
  });

  it('no bounding context with a single group is still a safe single_candidate', () => {
    const r = selectBlockFace(g72, [], null);
    expect(r).not.toBeNull();
    expect(r.selectionReason).toBe('single_candidate');
  });

  it('bounds that match nothing stay ambiguous', () => {
    expect(selectBlockFace(gBoth, ['PARK AVENUE', 'LEXINGTON AVENUE'], 'West')).toBeNull();
  });

  it('never returns a face merely because it is first in the object', () => {
    const groups = {
      'AAA STREET|BBB STREET|E': rows(1),
      'CCC STREET|DDD STREET|W': rows(2),
    };
    expect(selectBlockFace(groups, ['ZZZ STREET', 'YYY STREET'], 'East')).toBeNull();
  });

  it('normalizer: EAST numbered street survives round-trip for scoring', () => {
    expect(osmNameToDOT('East 85th Street')).toBe('EAST 85 STREET');
    expect(osmNameToDOT('East 85th Street')).toBe('EAST 85 STREET');
  });
});
