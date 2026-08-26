import { describe, it, expect } from 'vitest';
import { deriveImpactCounts } from './profileImpact';

describe('deriveImpactCounts', () => {
  it('returns zeros for empty input', () => {
    expect(deriveImpactCounts({})).toEqual({ pingsShared: 0, successfulHandoffs: 0, spotsFound: 0 });
  });

  // pingsShared comes from the durable users/{uid}.impactStats.pingsShared
  // counter (go-forward only, written by incrementTotalSpotsPinged) — not
  // derived from any document array.
  it('pingsShared passes through untouched', () => {
    expect(deriveImpactCounts({ pingsShared: 4 }).pingsShared).toBe(4);
  });

  it('a missing/undefined pingsShared value safely renders 0', () => {
    expect(deriveImpactCounts({ pingsShared: undefined }).pingsShared).toBe(0);
  });

  // successfulHandoffs comes from the durable trustStats.handoffsCompleted
  // counter (users/{uid}) — not derived from any document array.
  it('successfulHandoffs passes through untouched', () => {
    expect(deriveImpactCounts({ successfulHandoffs: 7 }).successfulHandoffs).toBe(7);
  });

  it('a missing/undefined handoffsCompleted value safely renders 0', () => {
    expect(deriveImpactCounts({ successfulHandoffs: undefined }).successfulHandoffs).toBe(0);
  });

  // spotsFound is the exact getCountFromServer(success feedback) result —
  // not derived from a feedback document array (Profile no longer fetches
  // the complete historical feedback set; see the Spots Found decoupling
  // investigation). This is a plain number, already exact, passed through
  // untouched — including values larger than any RecentActivity preview
  // window, since the count reflects full history regardless of how many
  // feedback docs Profile happens to fetch for display purposes.
  it('spotsFound passes through untouched, including counts larger than any display window', () => {
    expect(deriveImpactCounts({ spotsFound: 42 }).spotsFound).toBe(42);
  });

  it('a missing/undefined spotsFound value safely renders 0', () => {
    expect(deriveImpactCounts({ spotsFound: undefined }).spotsFound).toBe(0);
  });

  it('a zero spotsFound value renders exactly 0 (not treated as missing)', () => {
    expect(deriveImpactCounts({ spotsFound: 0 }).spotsFound).toBe(0);
  });

  it('combines all three independently', () => {
    expect(deriveImpactCounts({ pingsShared: 1, successfulHandoffs: 2, spotsFound: 3 }))
      .toEqual({ pingsShared: 1, successfulHandoffs: 2, spotsFound: 3 });
  });
});
