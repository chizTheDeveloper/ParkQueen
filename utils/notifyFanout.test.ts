/**
 * §2 — Notification fanout unit tests.
 * Imports production helpers from functions/notifyFanout.js — no emulator required.
 * Covers all 15 required scenarios: candidate filtering, message building, stale-token
 * collection, payload privacy (TM-17), and FCM batch constants.
 */
import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
    filterCandidates,
    buildMessages,
    collectStaleTokens,
    STALE_MS,
    MAX_CANDIDATES,
    FCM_BATCH,
} = require('../functions/notifyFanout') as {
    filterCandidates: (
        locDocs: Iterable<{ id: string; data: () => Record<string, unknown> }>,
        spotData: { finderId: string; lat: number; lng: number },
        geofire: { geohashToLocation: (h: string) => [number, number] },
        nowMs: number,
    ) => Array<{ userId: string; distMiles: number }>;
    buildMessages: (
        prefsResults: Array<{ userId: string; distMiles: number; prefs: Record<string, unknown> | null }>,
        spotId: string,
    ) => Array<{ token: string; notification: object; data: Record<string, string> }>;
    collectStaleTokens: (
        chunk: Array<{ token: string }>,
        responses: Array<{ success: boolean; error?: { code: string } }>,
    ) => string[];
    STALE_MS: number;
    MAX_CANDIDATES: number;
    FCM_BATCH: number;
};

// ── helpers ─────────────────────────────────────────────────────────────────

function makeLocDoc(
    id: string,
    geohash: string | null,
    updatedAtMs: number | null,
) {
    return {
        id,
        data: () => ({
            lastGeohash: geohash,
            lastGeohashUpdatedAt: updatedAtMs !== null ? { toMillis: () => updatedAtMs } : null,
        }),
    };
}

const NOW = 1_700_000_000_000;
const spotData = { finderId: 'finder_uid', lat: 40.7128, lng: -74.006 };
// Returns NYC coords so haversine distance ≈ 0 miles
const mockGeofire = { geohashToLocation: (_h: string): [number, number] => [40.7128, -74.006] };
const validPrefs = { fcmToken: 'tok_abc', notificationsEnabled: true, notificationRadius: 1 };

// ── filterCandidates ─────────────────────────────────────────────────────────

describe('filterCandidates', () => {
    it('(1) returns empty array when no location docs', () => {
        expect(filterCandidates([], spotData, mockGeofire, NOW)).toHaveLength(0);
    });

    it('(2) includes one valid nearby candidate', () => {
        const docs = [makeLocDoc('user_a', 'dr5ru', NOW - 1_000)];
        const result = filterCandidates(docs, spotData, mockGeofire, NOW);
        expect(result).toHaveLength(1);
        expect(result[0].userId).toBe('user_a');
        expect(typeof result[0].distMiles).toBe('number');
    });

    it('(8) excludes the spot finder', () => {
        const docs = [makeLocDoc('finder_uid', 'dr5ru', NOW - 1_000)];
        expect(filterCandidates(docs, spotData, mockGeofire, NOW)).toHaveLength(0);
    });

    it('(3) excludes stale location (age > 24 h)', () => {
        const staleMs = NOW - STALE_MS - 1;
        const docs = [makeLocDoc('user_stale', 'dr5ru', staleMs)];
        expect(filterCandidates(docs, spotData, mockGeofire, NOW)).toHaveLength(0);
    });

    it('(3b) includes candidate at staleness boundary (age === STALE_MS - 1 ms)', () => {
        const docs = [makeLocDoc('user_fresh', 'dr5ru', NOW - (STALE_MS - 1))];
        expect(filterCandidates(docs, spotData, mockGeofire, NOW)).toHaveLength(1);
    });

    it('(4) skips malformed geohash and continues processing remaining candidates', () => {
        const mixedGeofire = {
            geohashToLocation: (h: string): [number, number] => {
                if (h === 'INVALID') throw new Error('bad geohash');
                return [40.7128, -74.006];
            },
        };
        const docs = [
            makeLocDoc('user_bad', 'INVALID', NOW - 1_000),
            makeLocDoc('user_good', 'dr5ru', NOW - 1_000),
        ];
        const result = filterCandidates(docs, spotData, mixedGeofire, NOW);
        expect(result).toHaveLength(1);
        expect(result[0].userId).toBe('user_good');
    });

    it('(4b) all-malformed geohashes → empty result (no throw)', () => {
        const badGeofire = { geohashToLocation: () => { throw new Error('bad'); } };
        const docs = [makeLocDoc('user_bad', 'ZZZ', NOW - 1_000)];
        expect(() => filterCandidates(docs, spotData, badGeofire, NOW)).not.toThrow();
        expect(filterCandidates(docs, spotData, badGeofire, NOW)).toHaveLength(0);
    });
});

// ── buildMessages ─────────────────────────────────────────────────────────────

describe('buildMessages', () => {
    it('(1b) returns empty array when prefsResults is empty', () => {
        expect(buildMessages([], 'spot_1')).toHaveLength(0);
    });

    it('(5) skips recipient with null prefs (no preferences doc)', () => {
        expect(buildMessages([{ userId: 'u1', distMiles: 0.1, prefs: null }], 'spot_1')).toHaveLength(0);
    });

    it('(5b) skips recipient with no fcmToken', () => {
        expect(
            buildMessages([{ userId: 'u1', distMiles: 0.1, prefs: { notificationsEnabled: true } }], 'spot_1'),
        ).toHaveLength(0);
    });

    it('(6) skips recipient when notificationsEnabled is false', () => {
        const prefs = { ...validPrefs, notificationsEnabled: false };
        expect(buildMessages([{ userId: 'u1', distMiles: 0.1, prefs }], 'spot_1')).toHaveLength(0);
    });

    it('(7) skips recipient whose distance exceeds notificationRadius', () => {
        const prefs = { ...validPrefs, notificationRadius: 0.5 };
        expect(buildMessages([{ userId: 'u1', distMiles: 1.0, prefs }], 'spot_1')).toHaveLength(0);
    });

    it('includes valid recipient within radius', () => {
        const msgs = buildMessages([{ userId: 'u1', distMiles: 0.3, prefs: validPrefs }], 'spot_1');
        expect(msgs).toHaveLength(1);
        expect(msgs[0].token).toBe('tok_abc');
    });

    it('(14) FCM payload contains no location coordinates', () => {
        const msgs = buildMessages([{ userId: 'u1', distMiles: 0.3, prefs: validPrefs }], 'spot_xyz');
        const data = msgs[0].data;
        expect(data).not.toHaveProperty('lat');
        expect(data).not.toHaveProperty('lng');
        expect(data).not.toHaveProperty('latitude');
        expect(data).not.toHaveProperty('longitude');
    });

    it('(15) FCM payload contains no finder identity and only spotId', () => {
        const msgs = buildMessages([{ userId: 'u1', distMiles: 0.3, prefs: validPrefs }], 'spot_xyz');
        expect(msgs[0].data).not.toHaveProperty('finderId');
        expect(msgs[0].data).not.toHaveProperty('finderUid');
        expect(msgs[0].data).toEqual({ spotId: 'spot_xyz' });
    });

    it('(10) builds exactly 500 messages without truncation (fits one FCM batch)', () => {
        const prefsResults = Array.from({ length: 500 }, (_, i) => ({
            userId: `u${i}`,
            distMiles: 0.1,
            prefs: { fcmToken: `tok${i}`, notificationsEnabled: true, notificationRadius: 1 },
        }));
        expect(buildMessages(prefsResults, 'spot_1')).toHaveLength(500);
    });

    it('(11) builds >500 messages — batching is the callers responsibility (FCM_BATCH === 500)', () => {
        const prefsResults = Array.from({ length: 501 }, (_, i) => ({
            userId: `u${i}`,
            distMiles: 0.1,
            prefs: { fcmToken: `tok${i}`, notificationsEnabled: true, notificationRadius: 1 },
        }));
        expect(buildMessages(prefsResults, 'spot_1')).toHaveLength(501);
        expect(FCM_BATCH).toBe(500);
    });
});

// ── collectStaleTokens ───────────────────────────────────────────────────────

describe('collectStaleTokens', () => {
    it('(12) returns empty array when all sends succeed', () => {
        const chunk = [{ token: 'tok_a' }, { token: 'tok_b' }];
        const responses = [{ success: true }, { success: true }];
        expect(collectStaleTokens(chunk, responses)).toHaveLength(0);
    });

    it('(12b) collects registration-token-not-registered on partial failure', () => {
        const chunk = [{ token: 'tok_stale' }, { token: 'tok_ok' }];
        const responses = [
            { success: false, error: { code: 'messaging/registration-token-not-registered' } },
            { success: true },
        ];
        expect(collectStaleTokens(chunk, responses)).toEqual(['tok_stale']);
    });

    it('(13) collects invalid-registration-token', () => {
        const chunk = [{ token: 'tok_invalid' }];
        const responses = [
            { success: false, error: { code: 'messaging/invalid-registration-token' } },
        ];
        expect(collectStaleTokens(chunk, responses)).toEqual(['tok_invalid']);
    });

    it('(13b) does NOT collect transient failure codes (quota, internal)', () => {
        const chunk = [{ token: 'tok_quota' }, { token: 'tok_internal' }];
        const responses = [
            { success: false, error: { code: 'messaging/quota-exceeded' } },
            { success: false, error: { code: 'messaging/internal-error' } },
        ];
        expect(collectStaleTokens(chunk, responses)).toHaveLength(0);
    });
});

// ── constants ────────────────────────────────────────────────────────────────

describe('fanout constants', () => {
    it('(9) MAX_CANDIDATES is 200', () => expect(MAX_CANDIDATES).toBe(200));
    it('FCM_BATCH is 500',          () => expect(FCM_BATCH).toBe(500));
    it('STALE_MS is 24 h in ms',    () => expect(STALE_MS).toBe(24 * 60 * 60 * 1000));
});
