import { describe, it, expect } from 'vitest';
import {
  computeSafeUntil,
  detectParkingSide,
  computeCrossRaw,
  type CleaningSchedule,
  type SuspensionDoc,
} from './streetIntelligence';
import { parseSweepNYCSign, detectCardinalSide, PARSER_VERSION } from './sweepnyc';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a Date at a specific weekday and time in the current week. */
function dateAt(dayName: string, hour: number, minute = 0): Date {
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const now = new Date();
  const diff = days[dayName] - now.getDay();
  const d = new Date(now);
  d.setDate(now.getDate() + diff);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const NO_SUSPENSIONS: SuspensionDoc[] = [];

// Melville St (Bronx) schedules from SweepNYC
const MELVILLE_SCHEDULES: CleaningSchedule[] = [
  { side: 'West', days: ['Mon', 'Thu'], startTime: '08:30', endTime: '10:00' },
  { side: 'East', days: ['Tue', 'Fri'], startTime: '08:30', endTime: '10:00' },
];

// ─── parseSweepNYCSign ────────────────────────────────────────────────────────

describe('parseSweepNYCSign', () => {
  it('parses a standard two-day sign correctly', () => {
    const result = parseSweepNYCSign(
      'No Parking Monday, Thursday 8:30AM-10AM on Melville Street from Van Nest Avenue to Morris Park Avenue (Side: West)',
    );
    expect(result).toEqual({
      street: 'Melville Street',
      fromCross: 'Van Nest Avenue',
      toCross: 'Morris Park Avenue',
      side: 'West',
      days: ['Mon', 'Thu'],
      startTime: '08:30',
      endTime: '10:00',
    });
  });

  it('parses a single-day sign', () => {
    const result = parseSweepNYCSign(
      'No Parking Friday 8AM-11AM on Broadway from W 72 St to W 73 St (Side: East)',
    );
    expect(result).toEqual({
      street: 'Broadway',
      fromCross: 'W 72 St',
      toCross: 'W 73 St',
      side: 'East',
      days: ['Fri'],
      startTime: '08:00',
      endTime: '11:00',
    });
  });

  it('parses times with optional space before AM/PM', () => {
    const result = parseSweepNYCSign(
      'No Parking Tuesday, Friday 8:30 AM-10 AM on Main St from A Ave to B Ave (Side: North)',
    );
    expect(result?.startTime).toBe('08:30');
    expect(result?.endTime).toBe('10:00');
  });

  it('returns null for No Standing signs (different prefix)', () => {
    expect(parseSweepNYCSign('No Standing 7AM-7PM')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseSweepNYCSign('')).toBeNull();
  });

  it('returns null for unrecognized format', () => {
    expect(parseSweepNYCSign('No Parking Zone — see sign')).toBeNull();
  });

  it('handles PM times correctly', () => {
    const result = parseSweepNYCSign(
      'No Parking Monday 1PM-3PM on Oak Ave from 1st St to 2nd St (Side: South)',
    );
    expect(result?.startTime).toBe('13:00');
    expect(result?.endTime).toBe('15:00');
  });

  it('handles 12PM (noon) correctly', () => {
    const result = parseSweepNYCSign(
      'No Parking Monday 12PM-2PM on Oak Ave from 1st St to 2nd St (Side: West)',
    );
    expect(result?.startTime).toBe('12:00');
    expect(result?.endTime).toBe('14:00');
  });

  it('handles 12AM (midnight) correctly', () => {
    const result = parseSweepNYCSign(
      'No Parking Monday 12AM-1AM on Oak Ave from 1st St to 2nd St (Side: East)',
    );
    expect(result?.startTime).toBe('00:00');
    expect(result?.endTime).toBe('01:00');
  });

  it('exports a stable PARSER_VERSION string', () => {
    expect(typeof PARSER_VERSION).toBe('string');
    expect(PARSER_VERSION.length).toBeGreaterThan(0);
  });
});

// ─── computeSafeUntil ─────────────────────────────────────────────────────────

describe('computeSafeUntil — West side of Melville St', () => {
  it('parked Monday 7:00 AM → safe until Monday 8:30 AM', () => {
    const now = dateAt('Mon', 7, 0);
    const result = computeSafeUntil(MELVILLE_SCHEDULES, 'West', NO_SUSPENSIONS, now);
    expect(result.activeNow).toBe(false);
    expect(result.nextDay).toBe('Monday');
    expect(result.nextTime).toBe('8:30 AM');
    expect(result.safeUntil).not.toBeNull();
    expect(result.safeUntil!.getHours()).toBe(8);
    expect(result.safeUntil!.getMinutes()).toBe(30);
  });

  it('parked during active cleaning (Monday 9:00 AM) → activeNow', () => {
    const now = dateAt('Mon', 9, 0);
    const result = computeSafeUntil(MELVILLE_SCHEDULES, 'West', NO_SUSPENSIONS, now);
    expect(result.activeNow).toBe(true);
    expect(result.safeUntil!.getHours()).toBe(10);
  });

  it('parked Monday 10:30 AM (after cleaning) → next is Thursday', () => {
    const now = dateAt('Mon', 10, 30);
    const result = computeSafeUntil(MELVILLE_SCHEDULES, 'West', NO_SUSPENSIONS, now);
    expect(result.activeNow).toBe(false);
    expect(result.nextDay).toBe('Thursday');
  });

  it('Monday cleaning suspended → skips to Thursday', () => {
    const now = dateAt('Mon', 7, 0);
    const monday = now.toISOString().slice(0, 10);
    const suspensions: SuspensionDoc[] = [{
      id: 'test-susp',
      cityId: 'nyc',
      date: monday,
      type: 'holiday',
      label: 'Test Holiday',
      affectsTypes: ['streetCleaning'],
      source: 'admin',
    }];
    const result = computeSafeUntil(MELVILLE_SCHEDULES, 'West', suspensions, now);
    expect(result.activeNow).toBe(false);
    expect(result.nextDay).toBe('Thursday');
  });

  it('includes a schedule description', () => {
    const now = dateAt('Mon', 7, 0);
    const result = computeSafeUntil(MELVILLE_SCHEDULES, 'West', NO_SUSPENSIONS, now);
    expect(result.scheduleDescription).toContain('Mon');
    expect(result.scheduleDescription).toContain('Thu');
    expect(result.scheduleDescription).toContain('8:30 AM');
  });
});

describe('computeSafeUntil — East side of Melville St', () => {
  it('Monday 7 AM → East side has no Mon/Thu cleaning → next is Tuesday', () => {
    const now = dateAt('Mon', 7, 0);
    const result = computeSafeUntil(MELVILLE_SCHEDULES, 'East', NO_SUSPENSIONS, now);
    expect(result.activeNow).toBe(false);
    expect(result.nextDay).toBe('Tuesday');
  });
});

describe('computeSafeUntil — no rules for this side', () => {
  it('returns null result when no schedules match the parking side', () => {
    const now = dateAt('Mon', 7, 0);
    const result = computeSafeUntil(MELVILLE_SCHEDULES, 'North', NO_SUSPENSIONS, now);
    expect(result.scheduleDescription).toBeNull();
    expect(result.safeUntil).toBeNull();
    expect(result.activeNow).toBe(false);
  });
});

describe('computeSafeUntil — simple block, one side', () => {
  const SIMPLE: CleaningSchedule[] = [
    { side: 'even', days: ['Wed'], startTime: '11:00', endTime: '12:30' },
  ];

  it('Wednesday 10:00 AM → safe until 11:00 AM', () => {
    const now = dateAt('Wed', 10, 0);
    const result = computeSafeUntil(SIMPLE, 'even', NO_SUSPENSIONS, now);
    expect(result.nextDay).toBe('Wednesday');
    expect(result.nextTime).toBe('11 AM');
  });

  it('Wednesday 11:30 AM → activeNow', () => {
    const now = dateAt('Wed', 11, 30);
    const result = computeSafeUntil(SIMPLE, 'even', NO_SUSPENSIONS, now);
    expect(result.activeNow).toBe(true);
  });

  it('odd side → no applicable schedules', () => {
    const now = dateAt('Wed', 10, 0);
    const result = computeSafeUntil(SIMPLE, 'odd', NO_SUSPENSIONS, now);
    expect(result.scheduleDescription).toBeNull();
  });
});

// ─── detectParkingSide ────────────────────────────────────────────────────────

describe('detectParkingSide — N-S street, even on East side', () => {
  // Segment runs South→North (bearing ~0°, normalized)
  // from = south end, to = north end
  // User east of the segment → negative cross (right of northward vector) → East
  // Even houses on East → evenSideIsPositiveCross = false
  const fromLat = 40.840, fromLng = -73.870;
  const toLat   = 40.845, toLng  = -73.870;

  it('user to the East → even side', () => {
    const side = detectParkingSide(
      40.8425, -73.869,  // slightly east
      fromLat, fromLng, toLat, toLng,
      false, // even = negative cross (East)
    );
    expect(side).toBe('even');
  });

  it('user to the West → odd side', () => {
    const side = detectParkingSide(
      40.8425, -73.871,  // slightly west
      fromLat, fromLng, toLat, toLng,
      false,
    );
    expect(side).toBe('odd');
  });
});

// ─── detectCardinalSide ───────────────────────────────────────────────────────

describe('detectCardinalSide — E-W street (bearing ~90°)', () => {
  // Segment runs West→East
  const fromLat = 40.842, fromLng = -73.872;
  const toLat   = 40.842, toLng  = -73.866;
  const bearing = 90;

  it('user north of street → North', () => {
    expect(detectCardinalSide(40.843, -73.869, fromLat, fromLng, toLat, toLng, bearing)).toBe('North');
  });

  it('user south of street → South', () => {
    expect(detectCardinalSide(40.841, -73.869, fromLat, fromLng, toLat, toLng, bearing)).toBe('South');
  });
});

describe('detectCardinalSide — N-S street (bearing ~0°)', () => {
  // Segment runs South→North
  const fromLat = 40.840, fromLng = -73.870;
  const toLat   = 40.845, toLng  = -73.870;
  const bearing = 0;

  it('user west of street → West', () => {
    expect(detectCardinalSide(40.8425, -73.871, fromLat, fromLng, toLat, toLng, bearing)).toBe('West');
  });

  it('user east of street → East', () => {
    expect(detectCardinalSide(40.8425, -73.869, fromLat, fromLng, toLat, toLng, bearing)).toBe('East');
  });
});

describe('detectCardinalSide — diagonal street (bearing ~135°)', () => {
  // Segment runs NW→SE (bearing 135°)
  const fromLat = 40.845, fromLng = -73.874;
  const toLat   = 40.840, toLng  = -73.867;
  const bearing = 135;

  it('user northeast of segment → East', () => {
    expect(detectCardinalSide(40.844, -73.868, fromLat, fromLng, toLat, toLng, bearing)).toBe('East');
  });

  it('user southwest of segment → West', () => {
    expect(detectCardinalSide(40.841, -73.873, fromLat, fromLng, toLat, toLng, bearing)).toBe('West');
  });
});

// ─── backfill — computeSegmentUpdate ─────────────────────────────────────────

import { computeSegmentUpdate, computeRuleUpdate } from './backfill';

describe('computeSegmentUpdate', () => {
  it('fills all missing fields on an old admin segment', () => {
    const update = computeSegmentUpdate({ streetName: 'Oak Ave', cslSegmentId: null });
    expect(update.status).toBe('active');
    expect(update.source).toBe('admin');
    expect(update.confidenceScore).toBe(1.0);
    expect(update.editedBy).toBe('migration:backfill');
    expect(update.provenance).toEqual({ provider: 'admin', importedBy: 'migration:backfill' });
  });

  it('fills missing fields on a sweepnyc segment detected via cslSegmentId', () => {
    const update = computeSegmentUpdate({ streetName: 'Melville St', cslSegmentId: '98053' });
    expect(update.source).toBe('sweepnyc');
    expect(update.confidenceScore).toBe(0.95);
    expect(update.provenance).toEqual({
      provider: 'sweepnyc',
      sweepNYCObjectId: 98053,
      importedBy: 'migration:backfill',
    });
  });

  it('fills missing fields on a sweepnyc segment detected via source field', () => {
    const update = computeSegmentUpdate({ source: 'sweepnyc', cslSegmentId: null });
    expect(update.source).toBeUndefined();  // already set — must not overwrite
    expect(update.confidenceScore).toBe(0.95);
    expect(update.provenance?.provider).toBe('sweepnyc');
    expect(update.provenance?.sweepNYCObjectId).toBeUndefined(); // no cslSegmentId to recover from
  });

  it('does not overwrite any existing valid field', () => {
    const update = computeSegmentUpdate({
      status: 'needs_review',
      source: 'sweepnyc',
      confidenceScore: 0.95,
      provenance: { provider: 'sweepnyc', sweepNYCObjectId: 99 },
      editedBy: 'system:sweepnyc',
    });
    expect(Object.keys(update)).toHaveLength(0);
  });

  it('is idempotent — second call on already-backfilled doc returns empty update', () => {
    const data = { streetName: 'Broadway', cslSegmentId: null };
    const first = computeSegmentUpdate(data);
    // Apply the first update to the data
    const afterFirst = { ...data, ...first };
    const second = computeSegmentUpdate(afterFirst);
    expect(Object.keys(second)).toHaveLength(0);
  });
});

describe('computeRuleUpdate', () => {
  it('sets admin provenance when parent is admin', () => {
    const update = computeRuleUpdate({ type: 'streetCleaning', source: 'admin' }, false);
    expect(update.provenance).toEqual({ provider: 'admin', importedBy: 'migration:backfill' });
    expect(update.editedBy).toBe('migration:backfill');
  });

  it('sets sweepnyc provenance when parent is sweepnyc', () => {
    const update = computeRuleUpdate({ type: 'streetCleaning', source: 'sweepnyc' }, true);
    expect(update.provenance?.provider).toBe('sweepnyc');
  });

  it('rule source field takes precedence over parent classification', () => {
    // Rule says admin even though parent is sweepnyc
    const update = computeRuleUpdate({ type: 'streetCleaning', source: 'admin' }, true);
    expect(update.provenance?.provider).toBe('admin');
  });

  it('does not overwrite existing provenance or editedBy', () => {
    const update = computeRuleUpdate({
      provenance: { provider: 'admin', importedBy: 'admin:abc' },
      editedBy: 'admin:abc',
    }, false);
    expect(Object.keys(update)).toHaveLength(0);
  });
});

// ─── computeCrossRaw ──────────────────────────────────────────────────────────

describe('computeCrossRaw', () => {
  it('point to the left of a northward vector → positive', () => {
    // from=(0,0) to=(1,0) pointing North; point at (-1, 0.5) is West = left
    const cross = computeCrossRaw(0.5, -1, 0, 0, 1, 0);
    expect(cross).toBeGreaterThan(0);
  });

  it('point to the right of a northward vector → negative', () => {
    const cross = computeCrossRaw(0.5, 1, 0, 0, 1, 0);
    expect(cross).toBeLessThan(0);
  });

  it('point exactly on the line → zero', () => {
    const cross = computeCrossRaw(0.5, 0, 0, 0, 1, 0);
    expect(cross).toBe(0);
  });
});
