import { describe, it, expect } from 'vitest';
import {
  RADIUS_OPTIONS, DEFAULT_RADIUS, isSupportedRadius, normalizeRadius, formatRadius,
} from './notificationRadius';
import {
  derivePingCard, summarizeFeed, formatDistance, formatAvailableAt,
  distanceKm, kmToMiles, EXPIRING_SOON_MS, MAX_VISIBLE_PINGS,
} from './nearbyFeed';

const T0 = 1_700_000_000_000;
const ts = (ms: number) => ({ toMillis: () => ms });

describe('notificationRadius — one supported set', () => {
  it('exposes exactly the options the settings screen offers', () => {
    // The Nearby feed and the alert settings must not drift apart; this is the
    // list both now import.
    expect([...RADIUS_OPTIONS]).toEqual([1, 2, 3, 5]);
    expect(DEFAULT_RADIUS).toBe(1);
  });

  it('accepts only supported values', () => {
    for (const r of RADIUS_OPTIONS) expect(isSupportedRadius(r)).toBe(true);
    for (const bad of [0, 0.5, 4, 10, -1, NaN, Infinity, '2', null, undefined, {}]) {
      expect(isSupportedRadius(bad)).toBe(false);
    }
  });

  it('falls back to the default rather than widening or narrowing the query', () => {
    // An out-of-set value from an older build or a partial write must never
    // silently change how far the feed reaches.
    for (const bad of [0, 0.5, 4, 99, -3, NaN, '2', null, undefined]) {
      expect(normalizeRadius(bad)).toBe(DEFAULT_RADIUS);
    }
    expect(normalizeRadius(5)).toBe(5);
  });

  it('formats the same value the query uses', () => {
    expect(formatRadius(1)).toBe('1 mi');
    expect(formatRadius(5)).toBe('5 mi');
    expect(formatRadius(4)).toBe('1 mi'); // unsupported -> default, label agrees
  });
});

describe('derivePingCard — real lifecycle, no invented states', () => {
  it('reads a live Ping as available now', () => {
    const c = derivePingCard(
      { reportedAt: ts(T0 - 60_000), expiresAt: ts(T0 + 20 * 60_000), status: 'available' },
      T0, T0,
    );
    expect(c.kind).toBe('available');
    expect(c.availableAtMs).toBeNull();
    expect(c.expiringSoon).toBe(false);
  });

  it('reads a future Ping as leaving later and reports when it frees up', () => {
    const at = T0 + 45 * 60_000;
    const c = derivePingCard({ reportedAt: ts(at), expiresAt: ts(at + 30 * 60_000) }, T0, T0);
    expect(c.kind).toBe('leaving_later');
    expect(c.availableAtMs).toBe(at);
  });

  it('flags a live Ping inside its final five minutes', () => {
    const c = derivePingCard({ reportedAt: ts(T0 - 60_000), expiresAt: ts(T0 + 3 * 60_000) }, T0, T0);
    expect(c.expiringSoon).toBe(true);
    expect(c.minutesLeft).toBe(3);
  });

  it('does not flag a live Ping just outside that window', () => {
    const c = derivePingCard(
      { reportedAt: ts(T0 - 60_000), expiresAt: ts(T0 + EXPIRING_SOON_MS + 1000) }, T0, T0,
    );
    expect(c.expiringSoon).toBe(false);
  });

  it('never calls a scheduled Ping urgent', () => {
    // Urgency on something the driver cannot take yet would be a lie.
    const at = T0 + 10 * 60_000;
    const c = derivePingCard({ reportedAt: ts(at), expiresAt: ts(at + 60_000) }, T0, T0);
    expect(c.kind).toBe('leaving_later');
    expect(c.expiringSoon).toBe(false);
    expect(c.minutesLeft).toBeNull();
  });

  it('marks only Pings reported since the viewer last looked', () => {
    const lastViewed = T0 - 10 * 60_000;
    expect(derivePingCard({ reportedAt: ts(T0 - 60_000) }, T0, lastViewed).isNew).toBe(true);
    expect(derivePingCard({ reportedAt: ts(T0 - 30 * 60_000) }, T0, lastViewed).isNew).toBe(false);
  });

  it('transitions from leaving later to available as the clock crosses the boundary', () => {
    const at = T0 + 5 * 60_000;
    const ping = { reportedAt: ts(at), expiresAt: ts(at + 30 * 60_000) };
    expect(derivePingCard(ping, at - 1, T0).kind).toBe('leaving_later');
    expect(derivePingCard(ping, at + 1, T0).kind).toBe('available');
  });
});

describe('feed summary is truthful', () => {
  it('caps the list without misreporting the total', () => {
    const s = summarizeFeed(14);
    expect(s.visible).toBe(MAX_VISIBLE_PINGS);
    expect(s.total).toBe(14);
    expect(s.hiddenByCap).toBe(4);
  });

  it('hides nothing at or under the cap', () => {
    for (const n of [0, 1, 5, 10]) {
      const s = summarizeFeed(n);
      expect(s.visible).toBe(n);
      expect(s.hiddenByCap).toBe(0);
    }
  });
});

describe('distance and time formatting', () => {
  it('switches to feet under a tenth of a mile', () => {
    expect(formatDistance(0.05)).toMatch(/ft$/);
    expect(formatDistance(0.5)).toBe('0.3 mi');
  });

  it('converts kilometres to miles, not the reverse', () => {
    // The unit bug this guards: 2 km is ~1.24 mi, not 2 mi.
    expect(kmToMiles(2)).toBeCloseTo(1.243, 2);
  });

  it('measures real ground distance', () => {
    // ~1 degree of latitude is ~111 km.
    expect(distanceKm(40, -74, 41, -74)).toBeCloseTo(111.2, 0);
    expect(distanceKm(40, -74, 40, -74)).toBe(0);
  });

  it('renders a scheduled availability time', () => {
    const at = new Date('2026-09-10T16:15:00Z').getTime();
    expect(formatAvailableAt(at, 'en-US')).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i);
  });
});
