import { describe, expect, it } from 'vitest';
import { buildGeoQueryRanges } from './geoQuery';

const MIDTOWN: [number, number] = [40.7549, -73.9840];
const BROOKLYN: [number, number] = [40.6928, -73.9903];

describe('buildGeoQueryRanges', () => {
    it('returns at least one range for a valid NYC center at 2 miles', () => {
        const ranges = buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], 2);
        expect(ranges.length).toBeGreaterThan(0);
    });

    it('returns at least one range for a valid NYC center at 5 miles', () => {
        const ranges = buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], 5);
        expect(ranges.length).toBeGreaterThan(0);
    });

    it('returns at least one range for a valid NYC center at 10 miles', () => {
        const ranges = buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], 10);
        expect(ranges.length).toBeGreaterThan(0);
    });

    it('works for a different NYC coordinate', () => {
        const ranges = buildGeoQueryRanges(BROOKLYN[0], BROOKLYN[1], 5);
        expect(ranges.length).toBeGreaterThan(0);
    });

    it('is deterministic for repeated calls with identical input', () => {
        const first = buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], 5);
        const second = buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], 5);
        expect(second).toEqual(first);
    });

    it('never returns duplicate identical ranges', () => {
        const ranges = buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], 2);
        const keys = ranges.map(r => `${r.start}|${r.end}`);
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('every range has start <= end', () => {
        const ranges = buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], 5);
        for (const r of ranges) {
            expect(r.start <= r.end).toBe(true);
        }
    });

    it('does not mutate across calls (fresh array each time)', () => {
        const first = buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], 2);
        first.push({ start: 'z', end: 'z' });
        const second = buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], 2);
        expect(second.some(r => r.start === 'z' && r.end === 'z')).toBe(false);
    });

    it('rejects latitude above 90', () => {
        expect(() => buildGeoQueryRanges(91, -73.9, 5)).toThrow();
    });

    it('rejects latitude below -90', () => {
        expect(() => buildGeoQueryRanges(-91, -73.9, 5)).toThrow();
    });

    it('rejects longitude above 180', () => {
        expect(() => buildGeoQueryRanges(40.7, 181, 5)).toThrow();
    });

    it('rejects longitude below -180', () => {
        expect(() => buildGeoQueryRanges(40.7, -181, 5)).toThrow();
    });

    it('rejects NaN coordinates', () => {
        expect(() => buildGeoQueryRanges(NaN, -73.9, 5)).toThrow();
        expect(() => buildGeoQueryRanges(40.7, NaN, 5)).toThrow();
    });

    it('rejects a zero radius (explicit contract: radius must be positive)', () => {
        expect(() => buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], 0)).toThrow();
    });

    it('rejects a negative radius', () => {
        expect(() => buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], -1)).toThrow();
    });

    it('rejects a non-finite radius', () => {
        expect(() => buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], Infinity)).toThrow();
        expect(() => buildGeoQueryRanges(MIDTOWN[0], MIDTOWN[1], NaN)).toThrow();
    });
});
