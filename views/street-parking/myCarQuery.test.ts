import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// handleMyCarPing's combined rate-limit + orphan-cleanup check previously read
// EVERY spot the finder has ever created (where('finderId','==',user.id) with
// no order/limit) on every single My Car ping tap, then filtered client-side.
// Bounded here to the same finderId+reportedAt composite index (and the same
// limit(10)) PR #55 already established for the sibling general-ping
// rate-limit query — no new index required. See myCarQuery.test.ts's sibling
// assertions for the accepted, disclosed tradeoff: an orphaned 'my_car' spot
// older than the 10 most-recent spots for this finder is no longer
// proactively deleted here, but is still deleted within about 90 minutes by
// cleanupExpiredSpotsHourly regardless (every spot has expiresAt set at
// creation and that job sweeps the whole collection every hour) — so no
// spot is EVER left permanently uncleaned, only (rarely) slightly later.
describe('StreetParkingView My Car rate-limit + orphan-cleanup query', () => {
    const source = readFileSync(
        new URL('../StreetParkingView.tsx', import.meta.url),
        'utf8',
    );

    const fnStart = source.indexOf('const handleMyCarPing =');
    const fnEnd = source.indexOf('const handleSaveSpot =', fnStart);
    const fn = source.slice(fnStart, fnEnd);

    it('bounds the query to finderId + orderBy(reportedAt desc) + limit(10) — reuses the #55 index, no new index needed', () => {
        expect(fn).toMatch(/where\(\s*'finderId',\s*'==',\s*user\.id\s*\)/);
        expect(fn).toMatch(/orderBy\(\s*['"]reportedAt['"],\s*['"]desc['"]\s*\)/);
        expect(fn).toMatch(/limit\(\s*10\s*\)/);
    });

    it('no longer reads the collection with only a finderId filter (the prior unbounded shape)', () => {
        expect(fn).not.toMatch(/where\('finderId', '==', user\.id\)\)\)/);
    });

    it('reuses the existing checkPingRateLimit helper instead of re-implementing the threshold/minutesLeft math inline', () => {
        expect(fn).toMatch(/checkPingRateLimit\(/);
    });

    it('still excludes the current deterministic spotId from both the rate-limit count and orphan detection', () => {
        expect(fn).toMatch(/d\.id !== spotId/);
    });

    it('still targets exactly source === \'my_car\' for orphan cleanup', () => {
        expect(fn).toMatch(/d\.data\(\)\.source === 'my_car'/);
    });

    it('preserves the my_car-specific rate-limit i18n key (not the general-flow key)', () => {
        expect(fn).toMatch(/t\('my_car\.ping_limit_reached',\s*\{\s*minutes:/);
    });

    // Regression guard: PR #55's own bounded query in the general (non-My-Car)
    // ping flow must remain exactly as it was — this task must not touch it.
    it('does not disturb the sibling #55 general-flow rate-limit query', () => {
        const generalStart = source.indexOf('const handleSaveSpot =');
        const generalEnd = source.indexOf('const handleArrival =', generalStart);
        const generalFn = source.slice(generalStart, generalEnd);
        expect(generalFn).toMatch(/where\("finderId", "==", user\.id\)/);
        expect(generalFn).toMatch(/orderBy\("reportedAt", "desc"\)/);
        expect(generalFn).toMatch(/limit\(10\)/);
    });
});
