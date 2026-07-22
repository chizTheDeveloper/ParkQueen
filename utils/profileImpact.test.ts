import { describe, it, expect } from 'vitest';
import { deriveImpactCounts } from './profileImpact';

describe('deriveImpactCounts', () => {
  it('returns zeros for empty arrays', () => {
    expect(deriveImpactCounts([], [])).toEqual({ pingsShared: 0, successfulHandoffs: 0, spotsFound: 0 });
  });

  it('counts all spots as pings regardless of status or pingMode', () => {
    const spots = [
      { status: 'available' },
      { status: 'interested' },
      { status: 'occupied' },
      { status: 'available', pingMode: 'later' } as any,
    ];
    const { pingsShared } = deriveImpactCounts(spots, []);
    expect(pingsShared).toBe(4);
  });

  it('counts only occupied spots as successful handoffs', () => {
    const spots = [
      { status: 'available' },
      { status: 'occupied' },
      { status: 'occupied' },
      { status: 'interested' },
    ];
    const { successfulHandoffs } = deriveImpactCounts(spots, []);
    expect(successfulHandoffs).toBe(2);
  });

  it('successfulHandoffs is always a subset of pingsShared', () => {
    const spots = [{ status: 'occupied' }, { status: 'available' }];
    const { pingsShared, successfulHandoffs } = deriveImpactCounts(spots, []);
    expect(successfulHandoffs).toBeLessThanOrEqual(pingsShared);
  });

  it('counts only outcome===success feedback as spotsFound', () => {
    const feedback = [
      { outcome: 'success' },
      { outcome: 'success' },
      { outcome: 'failed' },
      { outcome: undefined },
      {},
    ];
    const { spotsFound } = deriveImpactCounts([], feedback);
    expect(spotsFound).toBe(2);
  });

  it('handles spots with no status field gracefully', () => {
    const spots = [{}, { status: 'occupied' }];
    const { pingsShared, successfulHandoffs } = deriveImpactCounts(spots, []);
    expect(pingsShared).toBe(2);
    expect(successfulHandoffs).toBe(1);
  });
});
