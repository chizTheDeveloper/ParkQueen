import { describe, it, expect } from 'vitest';
import { deriveImpactCounts } from './profileImpact';

describe('deriveImpactCounts', () => {
  it('returns zeros for empty inputs', () => {
    expect(deriveImpactCounts([], 0, 0)).toEqual({ pingsShared: 0, successfulHandoffs: 0, spotsFound: 0 });
  });

  // pingsShared now comes from the durable users/{uid}.impactStats.pingsShared
  // counter (go-forward only, written by incrementTotalSpotsPinged), not from
  // counting the ephemeral spots collection — spots are deleted by
  // cleanupExpiredSpotsHourly, so counting them made this figure decrease
  // over time with no user action, and it could never be more than the
  // ~90-minute retention window's worth of activity.
  it('pingsShared passes through the durable counter untouched', () => {
    const { pingsShared } = deriveImpactCounts([], 0, 4);
    expect(pingsShared).toBe(4);
  });

  it('a missing/undefined pingsShared value safely renders 0', () => {
    const { pingsShared } = deriveImpactCounts([], 0, undefined as unknown as number);
    expect(pingsShared).toBe(0);
  });

  // successfulHandoffs comes from the durable trustStats.handoffsCompleted
  // counter (users/{uid}), not from counting ephemeral spots.status ===
  // 'occupied' — spots are deleted by cleanupExpiredSpotsHourly, so counting
  // them made this "lifetime impact" stat silently decrease over time.
  it('successfulHandoffs passes through the durable handoffsCompleted count untouched', () => {
    const { successfulHandoffs } = deriveImpactCounts([], 7, 0);
    expect(successfulHandoffs).toBe(7);
  });

  it('a missing/undefined handoffsCompleted value safely renders 0', () => {
    const { successfulHandoffs } = deriveImpactCounts([], undefined as unknown as number, 0);
    expect(successfulHandoffs).toBe(0);
  });

  it('counts only outcome===success feedback as spotsFound', () => {
    const feedback = [
      { outcome: 'success' },
      { outcome: 'success' },
      { outcome: 'failed' },
      { outcome: undefined },
      {},
    ];
    const { spotsFound } = deriveImpactCounts(feedback, 0, 0);
    expect(spotsFound).toBe(2);
  });
});
