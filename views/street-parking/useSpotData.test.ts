import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('useSpotData live Ping query', () => {
    it('constrains the listener to statuses readable by every signed-in user', () => {
        const source = readFileSync(
            new URL('./useSpotData.ts', import.meta.url),
            'utf8',
        );

        expect(source).toContain(
            'where("status", "in", ["available", "interested"])',
        );
    });
});

// paidListings churn fix: searchCenter never affected the query itself, so
// every debounced map pan/zoom was needlessly tearing down and recreating
// an identical unfiltered listener. This proves the query is untouched and
// the dead dependency is gone, without coupling to exact formatting.
describe('useSpotData paidListings listener', () => {
    const source = readFileSync(
        new URL('./useSpotData.ts', import.meta.url),
        'utf8',
    );
    const effectStart = source.indexOf('Firestore paid listings listener');
    const effectEnd = source.indexOf('radiusFilteredItems', effectStart);
    const effect = source.slice(effectStart, effectEnd);

    it('keeps the listings query unfiltered and unchanged', () => {
        expect(effect).toMatch(/query\(\s*collection\(db,\s*"listings"\)\s*\)/);
    });

    it('does not depend on searchCenter, which map movement updates', () => {
        const depsMatch = effect.match(/\},\s*\[([^\]]*)\]\s*\);/);
        expect(depsMatch).not.toBeNull();
        const deps = depsMatch![1];
        expect(deps).not.toMatch(/\bsearchCenter\b/);
    });

    it('still depends on db, userId, and showPaid, which actually control the effect', () => {
        const depsMatch = effect.match(/\},\s*\[([^\]]*)\]\s*\);/);
        const deps = depsMatch![1];
        expect(deps).toMatch(/\bdb\b/);
        expect(deps).toMatch(/\buserId\b/);
        expect(deps).toMatch(/\bshowPaid\b/);
    });
});

// Bounded spots listener migration: query-shape contract. Not coupled to
// exact formatting — guards against a future regression back to an
// unbounded or misordered query (which would silently require a different
// composite index than the one shipped in #59).
describe('useSpotData bounded spots query shape', () => {
    const source = readFileSync(
        new URL('./useSpotData.ts', import.meta.url),
        'utf8',
    );
    const effectStart = source.indexOf('subscribeRange:');
    const effectEnd = source.indexOf('onData:', effectStart);
    const querySlice = source.slice(effectStart, effectEnd);

    it('filters by status in [available, interested]', () => {
        expect(querySlice).toMatch(/where\(\s*"status",\s*"in",\s*\["available",\s*"interested"\]\s*\)/);
    });

    it('filters by expiresAt greater than the per-subscription-set timestamp', () => {
        expect(querySlice).toMatch(/where\(\s*"expiresAt",\s*">",\s*nowTimestampRef\.current\s*\)/);
    });

    it('bounds by geohash >= range.start and <= range.end', () => {
        expect(querySlice).toMatch(/where\(\s*"geohash",\s*">=",\s*range\.start\s*\)/);
        expect(querySlice).toMatch(/where\(\s*"geohash",\s*"<=",\s*range\.end\s*\)/);
    });

    it('orders by geohash, matching the deployed composite index', () => {
        expect(querySlice).toMatch(/orderBy\(\s*"geohash"\s*\)/);
    });

    it('computes one nowTimestamp per region-subscription-set, not per range', () => {
        // nowTimestampRef is set once in the searchCenter/filterRadiusMiles
        // effect, immediately before calling setRegion — every range query
        // built during that setRegion call reads the same ref value.
        expect(source).toMatch(/nowTimestampRef\.current\s*=\s*Timestamp\.now\(\)/);
        const setRegionCallIdx = source.indexOf('subscriptionRef.current.setRegion(');
        const nowAssignIdx = source.indexOf('nowTimestampRef.current = Timestamp.now();');
        expect(nowAssignIdx).toBeGreaterThan(-1);
        expect(nowAssignIdx).toBeLessThan(setRegionCallIdx);
    });

    it('reacts to searchCenter and filterRadiusMiles (already debounced upstream), not raw map camera events', () => {
        const regionEffectStart = source.indexOf('nowTimestampRef.current = Timestamp.now();');
        const regionEffectEnd = source.indexOf('}, [', regionEffectStart);
        const deps = source.slice(regionEffectEnd, source.indexOf(');', regionEffectEnd));
        expect(deps).toMatch(/\bsearchCenter\b/);
        expect(deps).toMatch(/\bfilterRadiusMiles\b/);
    });
});
