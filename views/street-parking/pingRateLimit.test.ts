import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { checkPingRateLimit } from './pingRateLimit';

// Mimics a Firestore QueryDocumentSnapshot closely enough for this pure function.
function fakeDoc(reportedAtMs: number) {
    return { data: () => ({ reportedAt: Timestamp.fromMillis(reportedAtMs) }) };
}

const NOW = Date.now();
const ONE_HOUR_MS = 60 * 60 * 1000;

describe('checkPingRateLimit', () => {
    it('CASE 1: 0 recent pings -> allowed', () => {
        const result = checkPingRateLimit([], NOW);
        expect(result.limited).toBe(false);
    });

    it('CASE 2: 4 recent pings -> allowed', () => {
        const docs = [0, 1, 2, 3].map(i => fakeDoc(NOW - i * 60_000));
        const result = checkPingRateLimit(docs, NOW);
        expect(result.limited).toBe(false);
    });

    it('CASE 3: 5 recent pings -> rate limited', () => {
        const docs = [0, 1, 2, 3, 4].map(i => fakeDoc(NOW - i * 60_000));
        const result = checkPingRateLimit(docs, NOW);
        expect(result.limited).toBe(true);
    });

    it('CASE 4: more than 5 recent pings -> rate limited', () => {
        const docs = [0, 1, 2, 3, 4, 5, 6].map(i => fakeDoc(NOW - i * 60_000));
        const result = checkPingRateLimit(docs, NOW);
        expect(result.limited).toBe(true);
    });

    it('CASE 5: many historical spots outside one hour + fewer than 5 recent -> allowed', () => {
        const recent = [0, 1].map(i => fakeDoc(NOW - i * 60_000)); // 2 recent
        const historical = [2, 3, 4, 5, 6, 7, 8, 9].map(i => fakeDoc(NOW - (ONE_HOUR_MS + i * 60_000))); // 8 old
        const result = checkPingRateLimit([...recent, ...historical], NOW);
        expect(result.limited).toBe(false);
    });

    it('CASE 6: many historical spots + exactly 5 recent -> rate limited', () => {
        const recent = [0, 1, 2, 3, 4].map(i => fakeDoc(NOW - i * 60_000)); // 5 recent
        const historical = [5, 6, 7, 8, 9].map(i => fakeDoc(NOW - (ONE_HOUR_MS + i * 60_000))); // 5 old
        const result = checkPingRateLimit([...recent, ...historical], NOW);
        expect(result.limited).toBe(true);
    });

    it('CASE 7: more than 10 recent spots (already capped to newest 10 by the query) -> still rate limited', () => {
        // Simulates what the bounded query (limit 10) hands the function when the
        // true recent count exceeds 10 — only the newest 10 are ever passed in.
        const docs = Array.from({ length: 10 }, (_, i) => fakeDoc(NOW - i * 60_000));
        const result = checkPingRateLimit(docs, NOW);
        expect(result.limited).toBe(true);
    });

    it('CASE 8: ordering across the one-hour boundary is correct', () => {
        const justInside = fakeDoc(NOW - ONE_HOUR_MS + 1000); // 1s inside the window
        const justOutside = fakeDoc(NOW - ONE_HOUR_MS - 1000); // 1s outside the window
        const insideOnly = checkPingRateLimit([justInside, justInside, justInside, justInside], NOW);
        expect(insideOnly.limited).toBe(false); // only 4 count
        const withOutside = checkPingRateLimit([justInside, justInside, justInside, justInside, justOutside], NOW);
        expect(withOutside.limited).toBe(false); // the 5th is outside the window, still 4 count
    });

    it('minutesLeft is computed from the oldest recent ping', () => {
        const docs = [0, 30, 45, 50, 55].map(i => fakeDoc(NOW - i * 60_000)); // oldest = 55 min ago
        const result = checkPingRateLimit(docs, NOW);
        expect(result.limited).toBe(true);
        // oldest reported 55 min ago -> unlocks in ~5 min
        expect(result.minutesLeft).toBeGreaterThanOrEqual(4);
        expect(result.minutesLeft).toBeLessThanOrEqual(5);
    });

    it('tolerates a malformed (non-Timestamp) reportedAt by excluding it, matching current fallback behavior', () => {
        const malformed = { data: () => ({ reportedAt: undefined }) };
        const result = checkPingRateLimit([malformed, malformed, malformed, malformed, malformed], NOW);
        expect(result.limited).toBe(false);
    });
});

// Query-shape regression: prevents drifting back to the unbounded read this
// change fixed (Wave: spot-ping rate-limit bounded read). Not coupled to
// exact formatting — matches the essential clauses regardless of whitespace.
describe('StreetParkingView spot-ping rate-limit query shape', () => {
    it('the rate-limit query filters by finderId, orders by reportedAt desc, and caps at 10', () => {
        const source = readFileSync(
            new URL('../StreetParkingView.tsx', import.meta.url),
            'utf8',
        );

        expect(source).toMatch(/where\(\s*"finderId"\s*,\s*"==",\s*user\.id\s*\)/);
        expect(source).toMatch(/orderBy\(\s*"reportedAt"\s*,\s*"desc"\s*\)/);
        expect(source).toMatch(/limit\(\s*10\s*\)/);
        expect(source).toContain('checkPingRateLimit(snap.docs, now)');
    });
});
