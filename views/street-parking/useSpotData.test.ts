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
