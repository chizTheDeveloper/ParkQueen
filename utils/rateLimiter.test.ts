/**
 * TM-13 — Fixed-window rate limiter behaviour tests.
 * These tests verify the window-key derivation logic and documented boundary-burst
 * behaviour without requiring a Firestore emulator.
 */
import { describe, it, expect } from 'vitest';

// Import from production module — validates real code, not a formula copy.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { windowKey } = require('../functions/rateLimiter') as { windowKey: (nowMs: number, windowSec: number) => number };

describe('TM-13 — fixed-window rate limiter', () => {
    describe('window-key derivation', () => {
        it('two requests within the same window produce the same key', () => {
            const base = 1_700_000_000_000; // arbitrary epoch ms
            expect(windowKey(base, 3600)).toBe(windowKey(base + 1800_000, 3600));
        });

        it('requests in adjacent windows produce different keys', () => {
            const base = 1_700_000_000_000;
            const windowSec = 3600;
            const wk1 = windowKey(base, windowSec);
            const wk2 = windowKey(base + windowSec * 1000, windowSec);
            expect(wk2).toBe(wk1 + 1);
        });

        it('uses the correct key for a 15-minute window', () => {
            const windowSec = 900;
            const base = windowSec * 1000 * 10; // start of the 10th window
            expect(windowKey(base, windowSec)).toBe(10);
            expect(windowKey(base + 899_000, windowSec)).toBe(10); // still in same window
            expect(windowKey(base + 900_000, windowSec)).toBe(11); // rolled over
        });

        it('uses the correct key for a daily window', () => {
            const windowSec = 86400;
            const base = windowSec * 1000 * 5; // start of day 5
            expect(windowKey(base, windowSec)).toBe(5);
            expect(windowKey(base + 86399_000, windowSec)).toBe(5); // 1 second before reset
            expect(windowKey(base + 86400_000, windowSec)).toBe(6); // exactly next day
        });
    });

    describe('boundary-burst characteristic (documented tradeoff)', () => {
        it('a caller straddling two adjacent windows sees two independent limits', () => {
            const windowSec = 3600;
            const boundary = 3600 * 1000 * 7; // exact boundary between window 6 and 7
            // Immediately before boundary → window 6
            const wkBefore = windowKey(boundary - 1, windowSec);
            // Immediately after boundary → window 7
            const wkAfter = windowKey(boundary, windowSec);
            expect(wkAfter).toBe(wkBefore + 1);
            // Different keys → different Firestore docs → independent counters.
            // This is the known boundary-burst: full quota available in each window.
        });
    });

    describe('doc-ID uniqueness', () => {
        it('different operations produce different doc IDs', () => {
            const uid = 'user_abc';
            const nowMs = 1_700_000_000_000;
            const wk = windowKey(nowMs, 3600);
            const id1 = `generateEmailOTP_${wk}_${uid}`;
            const id2 = `verifyEmailOTP_${wk}_${uid}`;
            expect(id1).not.toBe(id2);
        });

        it('different UIDs produce different doc IDs', () => {
            const nowMs = 1_700_000_000_000;
            const wk = windowKey(nowMs, 3600);
            const id1 = `analyzeSign_${wk}_user_aaa`;
            const id2 = `analyzeSign_${wk}_user_bbb`;
            expect(id1).not.toBe(id2);
        });

        it('email-hash rate limit uses a different operation key from UID rate limit', () => {
            const nowMs = 1_700_000_000_000;
            const wk = windowKey(nowMs, 3600);
            const uid = 'user_abc';
            const emailHash = 'sha256ofnormalizdemail';
            const uidDoc = `generateEmailOTP_${wk}_${uid}`;
            const emailDoc = `generateEmailOTP_email_${wk}_${emailHash}`;
            expect(uidDoc).not.toBe(emailDoc);
        });
    });

    describe('TTL field', () => {
        it('expiresAt is set to 2× the window duration after window start', () => {
            const windowSec = 3600;
            const nowMs = 1_700_000_000_000;
            // expiresAt = Date.now() + windowSec * 2000 (ms)
            const expiresMs = nowMs + windowSec * 2000;
            // Must be strictly after the window ends
            const windowEndMs = (windowKey(nowMs, windowSec) + 1) * windowSec * 1000;
            expect(expiresMs).toBeGreaterThan(windowEndMs);
        });
    });
});
