import { describe, it, expect } from 'vitest';
import { deriveImpactCounts } from './profileImpact';

describe('deriveImpactCounts', () => {
  it('returns zeros for empty inputs', () => {
    expect(deriveImpactCounts([], [], 0)).toEqual({ pingsShared: 0, successfulHandoffs: 0, spotsFound: 0 });
  });

  it('counts all spots as pings regardless of status or pingMode', () => {
    const spots = [
      { status: 'available' },
      { status: 'interested' },
      { status: 'occupied' },
      { status: 'available', pingMode: 'later' } as any,
    ];
    const { pingsShared } = deriveImpactCounts(spots, [], 0);
    expect(pingsShared).toBe(4);
  });

  // successfulHandoffs now comes from the durable trustStats.handoffsCompleted
  // counter (users/{uid}), not from counting ephemeral spots.status ===
  // 'occupied' — spots are deleted by cleanupExpiredSpotsHourly, so counting
  // them made this "lifetime impact" stat silently decrease over time.
  it('successfulHandoffs passes through the durable handoffsCompleted count untouched by the spots array', () => {
    const spots = [
      { status: 'available' },
      { status: 'occupied' },
      { status: 'occupied' },
      { status: 'interested' },
    ];
    const { successfulHandoffs } = deriveImpactCounts(spots, [], 7);
    expect(successfulHandoffs).toBe(7);
  });

  it('removing/emptying the spots array does not change successfulHandoffs — it is not derived from spots', () => {
    const withSpots = deriveImpactCounts([{ status: 'occupied' }, { status: 'occupied' }], [], 5);
    const withoutSpots = deriveImpactCounts([], [], 5);
    expect(withSpots.successfulHandoffs).toBe(5);
    expect(withoutSpots.successfulHandoffs).toBe(5);
  });

  it('a missing/undefined handoffsCompleted value safely renders 0', () => {
    const { successfulHandoffs } = deriveImpactCounts([{ status: 'occupied' }], [], undefined as unknown as number);
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
    const { spotsFound } = deriveImpactCounts([], feedback, 0);
    expect(spotsFound).toBe(2);
  });

  it('handles spots with no status field gracefully (pingsShared only)', () => {
    const spots = [{}, { status: 'occupied' }];
    const { pingsShared } = deriveImpactCounts(spots, [], 0);
    expect(pingsShared).toBe(2);
  });
});
