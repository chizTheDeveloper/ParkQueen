import { describe, it, expect } from 'vitest';
import { getTierForCrowns, getNextTitle, getProgressPct, TITLE_THRESHOLDS } from './crowns';

describe('getTierForCrowns', () => {
    it('returns 0 for 0 crowns', () => expect(getTierForCrowns(0)).toBe(0));
    it('returns 0 for 9 crowns', () => expect(getTierForCrowns(9)).toBe(0));
    it('returns 1 for 10 crowns', () => expect(getTierForCrowns(10)).toBe(1));
    it('returns 2 for 50 crowns', () => expect(getTierForCrowns(50)).toBe(2));
    it('returns 7 for 3000 crowns', () => expect(getTierForCrowns(3000)).toBe(7));
    it('returns 7 for crowns above max', () => expect(getTierForCrowns(9999)).toBe(7));
});

describe('getNextTitle', () => {
    it('returns Trusted Driver for 0 crowns', () => {
        const r = getNextTitle(0);
        expect(r?.title).toBe('Trusted Driver');
        expect(r?.crownsNeeded).toBe(10);
    });
    it('returns null at max rank', () => expect(getNextTitle(3000)).toBeNull());
    it('returns null above max rank', () => expect(getNextTitle(9999)).toBeNull());
    it('returns Neighborhood Guide for 50 crowns', () => {
        const r = getNextTitle(50);
        expect(r?.title).toBe('Neighborhood Guide');
        expect(r?.crownsNeeded).toBe(100);
    });
});

describe('getProgressPct', () => {
    it('returns 0 for 0 crowns (start of first band)', () => expect(getProgressPct(0)).toBe(0));
    it('returns 100 at max rank', () => expect(getProgressPct(3000)).toBe(100));
    it('returns 100 above max rank', () => expect(getProgressPct(9999)).toBe(100));

    it('returns 0 at band start threshold', () => {
        // 50 crowns = start of Street Scout band (50–150)
        expect(getProgressPct(50)).toBe(0);
    });

    it('returns ~14% for 64 crowns (Street Scout band 50–150)', () => {
        // prevThreshold=50, range=100, progress=(64-50)/100=14%
        expect(getProgressPct(64)).toBeCloseTo(14, 0);
    });

    it('returns 50% at midpoint of a band', () => {
        // Band 0 (Newcomer): 0–10, midpoint=5 → 50%
        expect(getProgressPct(5)).toBeCloseTo(50, 0);
    });

    it('never exceeds 100', () => {
        for (const { crowns } of TITLE_THRESHOLDS) {
            expect(getProgressPct(crowns)).toBeLessThanOrEqual(100);
        }
    });
});
