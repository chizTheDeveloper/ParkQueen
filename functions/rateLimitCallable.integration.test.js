'use strict';

/**
 * Behavioral integration tests â€” rate-limited callables (TM-13 Phase J Verification).
 *
 * Tests: moderateContent, createSegmentFromSweepNYC, generateListingDescription.
 *
 * Strategy:
 *  - Auth denial and rate-limit exhaustion tests use the direct handler (.run()) so
 *    arbitrary token claims can be injected without a real JWT.
 *  - Success-path tests for callables with external dependencies use _callableHooks
 *    to replace provider calls deterministically.
 *  - No real Gemini, SweepNYC, NYC Open Data, or Vision API calls are made.
 *  - Rate-limit exhaustion is triggered by pre-seeding the Firestore counter doc.
 *
 * Run via: npm run test:functions
 * Requires emulators: functions (5001), firestore (8080), auth (9099)
 */

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

let indexModule;
try {
    indexModule = require('./index.js');
} catch (e) {
    console.warn('[rateLimit.callable] Could not load index.js:', e.message);
}

const PROJECT_ID = 'parkqueen-46475363-ccf36';
const APP_NAME = '__rateLimit_callable_intg__';

const testApp =
    getApps().find(a => a.name === APP_NAME) ??
    initializeApp({ projectId: PROJECT_ID }, APP_NAME);
const db = getFirestore(testApp);

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Returns the current Firestore window-key for a given windowSec. */
function currentWindowKey(windowSec) {
    return Math.floor(Date.now() / (windowSec * 1000));
}

/** Pre-seeds the rate-limit counter to `count` for the given operation/uid/window. */
async function seedCounter(operation, uid, windowSec, count) {
    const wk = currentWindowKey(windowSec);
    const docId = `${operation}_${wk}_${uid}`;
    await db.collection('rateLimits').doc(docId).set({
        count,
        uid,
        operation,
        expiresAt: Timestamp.fromMillis(Date.now() + windowSec * 2000),
    });
    return docId;
}

/** Deletes a rate-limit counter doc by its ID. */
async function deleteCounter(docId) {
    await db.collection('rateLimits').doc(docId).delete().catch(() => {});
}

/** Builds a fake CallableRequest with auth claims. */
function fakeRequest(uid, claims = {}, data = {}) {
    const NOW = Math.floor(Date.now() / 1000);
    return {
        data,
        auth: uid ? {
            uid,
            token: { uid, auth_time: NOW - 30, iat: NOW - 30, exp: NOW + 3600, ...claims },
        } : null,
        rawRequest: {},
    };
}

/** Calls a handler's .run() and normalises thrown HttpsError into { error } shape. */
async function callDirect(handler, uid, claims, data) {
    try {
        return { result: await handler.run(fakeRequest(uid, claims, data)) };
    } catch (err) {
        return { error: { code: err.code, message: err.message } };
    }
}

// â”€â”€â”€ moderateContent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('RL-B moderateContent â€” callable behavioral tests', () => {
    const OP = 'moderateContent';
    const LIMIT = 60;
    const WIN = 3600;
    let uid;
    let seededDocId;

    beforeEach(() => {
        uid = `rl_mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        seededDocId = null;
    });

    afterEach(async () => {
        if (seededDocId) await deleteCounter(seededDocId);
        // Clean up any moderationLog docs written during tests
        const snap = await db.collection('moderationLog').where('userId', '==', uid).get();
        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        if (!snap.empty) await batch.commit();
    });

    it('RL-B1: unauthenticated request is denied with unauthenticated', async () => {
        if (!indexModule) return;
        const { error } = await callDirect(indexModule.moderateContent, null, {}, { text: 'hello', type: 'message' });
        expect(error.code).toBe('unauthenticated');
    });

    it('RL-B2: valid request is allowed and writes to moderationLog', async () => {
        if (!indexModule) return;
        const { result, error } = await callDirect(indexModule.moderateContent, uid, {}, { text: 'hello world', type: 'message' });
        expect(error).toBeUndefined();
        expect(result.allowed).toBe(true);
        const logSnap = await db.collection('moderationLog').where('userId', '==', uid).get();
        expect(logSnap.size).toBe(1);
    });

    it('RL-B3: banned-word content is blocked and logged', async () => {
        if (!indexModule) return;
        // Use a banned-word that checkBannedWords catches â€” 'shit' is a standard profanity match
        const { result, error } = await callDirect(indexModule.moderateContent, uid, {}, { text: 'this is shit', type: 'message' });
        expect(error).toBeUndefined();
        expect(result.allowed).toBe(false);
    });

    it('RL-B4: request at the configured limit (60) is allowed', async () => {
        if (!indexModule) return;
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT - 1);
        const { result, error } = await callDirect(indexModule.moderateContent, uid, {}, { text: 'hello', type: 'message' });
        expect(error).toBeUndefined();
        expect(result.allowed).toBe(true);
    });

    it('RL-B5: request beyond the limit returns resource-exhausted', async () => {
        if (!indexModule) return;
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT);
        const { error } = await callDirect(indexModule.moderateContent, uid, {}, { text: 'hello', type: 'message' });
        expect(error.code).toBe('resource-exhausted');
    });

    it('RL-B6: second UID has an independent quota', async () => {
        if (!indexModule) return;
        const uid2 = `${uid}_b`;
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT);
        // uid is exhausted; uid2 should still be allowed
        const { error: e1 } = await callDirect(indexModule.moderateContent, uid, {}, { text: 'hi', type: 'message' });
        const { result: r2 } = await callDirect(indexModule.moderateContent, uid2, {}, { text: 'hi', type: 'message' });
        expect(e1.code).toBe('resource-exhausted');
        expect(r2.allowed).toBe(true);
        // Cleanup uid2 log
        const snap = await db.collection('moderationLog').where('userId', '==', uid2).get();
        const b = db.batch(); snap.docs.forEach(d => b.delete(d.ref)); if (!snap.empty) await b.commit();
        const wk = currentWindowKey(WIN);
        await db.collection('rateLimits').doc(`${OP}_${wk}_${uid2}`).delete().catch(() => {});
    });

    it('RL-B8: exhausted counter in a prior time window does not block the current window', async () => {
        if (!indexModule) return;
        // Seed the PREVIOUS window's doc (wk - 1) at the limit
        const prevWk = currentWindowKey(WIN) - 1;
        const prevDocId = `${OP}_${prevWk}_${uid}`;
        await db.collection('rateLimits').doc(prevDocId).set({
            count: LIMIT, uid, operation: OP,
            expiresAt: Timestamp.fromMillis(Date.now() + WIN * 2000),
        });
        // Current window has no counter doc → request must be allowed
        const { result, error } = await callDirect(indexModule.moderateContent, uid, {}, { text: 'hello', type: 'message' });
        expect(error).toBeUndefined();
        expect(result.allowed).toBe(true);
        await db.collection('rateLimits').doc(prevDocId).delete().catch(() => {});
    });

    it('RL-B7: rejected (exhausted) request does not write a new moderationLog entry', async () => {
        if (!indexModule) return;
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT);
        const before = (await db.collection('moderationLog').where('userId', '==', uid).get()).size;
        await callDirect(indexModule.moderateContent, uid, {}, { text: 'hi', type: 'message' });
        const after = (await db.collection('moderationLog').where('userId', '==', uid).get()).size;
        expect(after).toBe(before); // no new log entry from an exhausted caller
    });

    it('RL-M5: oversized text (>1000 chars) is rejected with invalid-argument before consuming rate-limit quota', async () => {
        if (!indexModule) return;
        const oversized = 'a'.repeat(1001);
        const { error } = await callDirect(indexModule.moderateContent, uid, {}, { text: oversized, type: 'message' });
        expect(error.code).toBe('invalid-argument');
        const wk = currentWindowKey(WIN);
        const counter = await db.collection('rateLimits').doc(`${OP}_${wk}_${uid}`).get();
        expect(counter.exists).toBe(false); // rejected before checkRateLimit ever ran
        const logSnap = await db.collection('moderationLog').where('userId', '==', uid).get();
        expect(logSnap.empty).toBe(true); // no expensive work (log write) occurred either
    });

    it('RL-M5b: exactly 1000 chars is allowed, 1001 is not (boundary)', async () => {
        if (!indexModule) return;
        const exact = 'a'.repeat(1000);
        const { result, error } = await callDirect(indexModule.moderateContent, uid, {}, { text: exact, type: 'message' });
        expect(error).toBeUndefined();
        expect(result.allowed).toBe(true);
    });

    it('RL-M4: a genuine concurrent burst through the full callable cannot exceed the configured limit (Promise.all, not sequential)', async () => {
        if (!indexModule) return;
        // Seed 2 below the real 60/hr limit so a burst of 5 concurrent calls
        // straddles the boundary: exactly 2 must succeed, 3 must be rejected —
        // proving atomicity through the FULL callable (auth, validation,
        // moderation, log write), not just the bare checkRateLimit helper
        // (already proven in isolation by rateLimiter.integration.test.js
        // RL-17/RL-18).
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT - 2);
        const BURST = 5;
        const results = await Promise.allSettled(
            Array.from({ length: BURST }, () =>
                callDirect(indexModule.moderateContent, uid, {}, { text: 'burst test', type: 'message' }),
            ),
        );
        const outcomes = results.map(r => r.value);
        const succeeded = outcomes.filter(o => o.error === undefined).length;
        const exhausted = outcomes.filter(o => o.error?.code === 'resource-exhausted').length;
        expect(succeeded).toBe(2);
        expect(exhausted).toBe(BURST - 2);
        const counterSnap = await db.collection('rateLimits').doc(seededDocId).get();
        expect(counterSnap.data().count).toBe(LIMIT); // exact boundary, no overshoot from the race
        const logSnap = await db.collection('moderationLog').where('userId', '==', uid).get();
        expect(logSnap.size).toBe(2); // only the 2 that actually passed wrote a log entry
    });
});

// â”€â”€â”€ createSegmentFromSweepNYC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('RL-C createSegmentFromSweepNYC â€” callable behavioral tests', () => {
    const OP = 'createSegmentFromSweepNYC';
    const LIMIT = 30;
    const WIN = 3600;
    const NYC_LAT = 40.7128;
    const NYC_LNG = -74.006;
    let uid;
    let seededDocId;

    beforeEach(() => {
        uid = `rl_nyc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        seededDocId = null;
        if (indexModule) indexModule._callableHooks.sweepNYCResult = null;
    });

    afterEach(async () => {
        if (seededDocId) await deleteCounter(seededDocId);
        if (indexModule) indexModule._callableHooks.sweepNYCResult = null;
    });

    it('RL-C1: unauthenticated request denied', async () => {
        if (!indexModule) return;
        const { error } = await callDirect(indexModule.createSegmentFromSweepNYC, null, {}, { lat: NYC_LAT, lng: NYC_LNG });
        expect(error.code).toBe('unauthenticated');
    });

    it('RL-C2: valid hooked request succeeds without calling real SweepNYC', async () => {
        if (!indexModule) return;
        indexModule._callableHooks.sweepNYCResult = async () => ({ success: true, segmentId: 'test-seg' });
        const { result, error } = await callDirect(indexModule.createSegmentFromSweepNYC, uid, {}, { lat: NYC_LAT, lng: NYC_LNG });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);
    });

    it('RL-C3: request at limit (30) succeeds', async () => {
        if (!indexModule) return;
        indexModule._callableHooks.sweepNYCResult = async () => ({ success: true, segmentId: 'seg-at-limit' });
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT - 1);
        const { result, error } = await callDirect(indexModule.createSegmentFromSweepNYC, uid, {}, { lat: NYC_LAT, lng: NYC_LNG });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);
    });

    it('RL-C4: request beyond limit returns resource-exhausted without calling SweepNYC', async () => {
        if (!indexModule) return;
        let providerCalled = false;
        indexModule._callableHooks.sweepNYCResult = async () => { providerCalled = true; return { success: true }; };
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT);
        const { error } = await callDirect(indexModule.createSegmentFromSweepNYC, uid, {}, { lat: NYC_LAT, lng: NYC_LNG });
        expect(error.code).toBe('resource-exhausted');
        expect(providerCalled).toBe(false);
    });

    it('RL-C5: second UID has independent quota', async () => {
        if (!indexModule) return;
        const uid2 = `${uid}_b`;
        indexModule._callableHooks.sweepNYCResult = async () => ({ success: true, segmentId: 'ind-quota' });
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT);
        const { error: e1 } = await callDirect(indexModule.createSegmentFromSweepNYC, uid, {}, { lat: NYC_LAT, lng: NYC_LNG });
        const { result: r2, error: e2 } = await callDirect(indexModule.createSegmentFromSweepNYC, uid2, {}, { lat: NYC_LAT, lng: NYC_LNG });
        expect(e1.code).toBe('resource-exhausted');
        expect(e2).toBeUndefined();
        expect(r2.success).toBe(true);
        // cleanup uid2 counter
        const wk = currentWindowKey(WIN);
        await db.collection('rateLimits').doc(`${OP}_${wk}_${uid2}`).delete().catch(() => {});
    });

    it('RL-C6: coordinates outside NYC bounds are rejected before provider call', async () => {
        if (!indexModule) return;
        let providerCalled = false;
        indexModule._callableHooks.sweepNYCResult = async () => { providerCalled = true; return { success: true }; };
        const { error } = await callDirect(indexModule.createSegmentFromSweepNYC, uid, {}, { lat: 34.0, lng: -118.2 });
        expect(error.code).toBe('invalid-argument');
        expect(providerCalled).toBe(false);
    });

    it('RL-S4: a genuine concurrent burst through the full callable cannot exceed the configured limit (Promise.all, not sequential)', async () => {
        if (!indexModule) return;
        indexModule._callableHooks.sweepNYCResult = async () => ({ success: true, segmentId: `seg-${Math.random()}` });
        // Seed 2 below the real 30/hr limit so a burst of 5 concurrent calls
        // straddles the boundary — proves atomicity through the full callable
        // (auth, coordinate validation, provider call, checkRateLimit), not
        // just the bare checkRateLimit helper.
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT - 2);
        const BURST = 5;
        const results = await Promise.allSettled(
            Array.from({ length: BURST }, () =>
                callDirect(indexModule.createSegmentFromSweepNYC, uid, {}, { lat: NYC_LAT, lng: NYC_LNG }),
            ),
        );
        const outcomes = results.map(r => r.value);
        const succeeded = outcomes.filter(o => o.error === undefined).length;
        const exhausted = outcomes.filter(o => o.error?.code === 'resource-exhausted').length;
        expect(succeeded).toBe(2);
        expect(exhausted).toBe(BURST - 2);
        const counterSnap = await db.collection('rateLimits').doc(seededDocId).get();
        expect(counterSnap.data().count).toBe(LIMIT); // exact boundary, no overshoot from the race
    });
});

// â”€â”€â”€ generateListingDescription â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('RL-D generateListingDescription â€” callable behavioral tests', () => {
    const OP = 'generateListingDescription';
    const LIMIT = 20;
    const WIN = 3600;
    let uid;
    let seededDocId;

    beforeEach(() => {
        uid = `rl_gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        seededDocId = null;
        if (indexModule) indexModule._callableHooks.geminiResponse = null;
    });

    afterEach(async () => {
        if (seededDocId) await deleteCounter(seededDocId);
        if (indexModule) indexModule._callableHooks.geminiResponse = null;
    });

    it('RL-D1: unauthenticated request denied without calling Gemini', async () => {
        if (!indexModule) return;
        let geminiCalled = false;
        indexModule._callableHooks.geminiResponse = async () => { geminiCalled = true; return { text: 'x' }; };
        const { error } = await callDirect(indexModule.generateListingDescription, null, {}, { features: ['covered'] });
        expect(error.code).toBe('unauthenticated');
        expect(geminiCalled).toBe(false);
    });

    it('RL-D2: valid hooked request returns description without calling real Gemini', async () => {
        if (!indexModule) return;
        indexModule._callableHooks.geminiResponse = async () => ({ text: 'Prime NYC parking.' });
        const { result, error } = await callDirect(indexModule.generateListingDescription, uid, {}, { features: ['covered', '24h'] });
        expect(error).toBeUndefined();
        expect(result.description).toBe('Prime NYC parking.');
    });

    it('RL-D3: request at limit (20) is allowed', async () => {
        if (!indexModule) return;
        indexModule._callableHooks.geminiResponse = async () => ({ text: 'At limit.' });
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT - 1);
        const { result, error } = await callDirect(indexModule.generateListingDescription, uid, {}, { features: ['ev-charging'] });
        expect(error).toBeUndefined();
        expect(typeof result.description).toBe('string');
    });

    it('RL-D4: request beyond limit returns resource-exhausted without calling Gemini', async () => {
        if (!indexModule) return;
        let geminiCalled = false;
        indexModule._callableHooks.geminiResponse = async () => { geminiCalled = true; return { text: 'x' }; };
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT);
        const { error } = await callDirect(indexModule.generateListingDescription, uid, {}, { features: ['covered'] });
        expect(error.code).toBe('resource-exhausted');
        expect(geminiCalled).toBe(false);
    });

    it('RL-D5: second UID has independent quota', async () => {
        if (!indexModule) return;
        const uid2 = `${uid}_b`;
        indexModule._callableHooks.geminiResponse = async () => ({ text: 'Independent.' });
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT);
        const { error: e1 } = await callDirect(indexModule.generateListingDescription, uid, {}, { features: ['covered'] });
        const { result: r2, error: e2 } = await callDirect(indexModule.generateListingDescription, uid2, {}, { features: ['covered'] });
        expect(e1.code).toBe('resource-exhausted');
        expect(e2).toBeUndefined();
        expect(r2.description).toBe('Independent.');
        const wk = currentWindowKey(WIN);
        await db.collection('rateLimits').doc(`${OP}_${wk}_${uid2}`).delete().catch(() => {});
    });

    it('RL-D6: missing features array returns invalid-argument before Gemini call', async () => {
        if (!indexModule) return;
        let geminiCalled = false;
        indexModule._callableHooks.geminiResponse = async () => { geminiCalled = true; return { text: 'x' }; };
        const { error } = await callDirect(indexModule.generateListingDescription, uid, {}, { features: 'not-array' });
        expect(error.code).toBe('invalid-argument');
        expect(geminiCalled).toBe(false);
    });
});

// ── claimUsername ─────────────────────────────────────────────────────────
// No prior dedicated rate-limit/abuse coverage existed for this callable
// (moderateContent/createSegmentFromSweepNYC/generateListingDescription were
// covered above under TM-13 Phase J; claimUsername's own 5/hr limit existed
// in source but was untested here). claimUsername never calls getAuth(), so
// no Auth-emulator user is needed — only Firestore state.

describe('RL-U claimUsername — callable behavioral tests', () => {
    const OP = 'claimUsername';
    const LIMIT = 5;
    const WIN = 3600;
    let uid;
    let seededDocId;

    beforeEach(() => {
        uid = `rl_usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        seededDocId = null;
    });

    afterEach(async () => {
        if (seededDocId) await deleteCounter(seededDocId);
        const un = await db.collection('usernames').where('uid', '==', uid).get();
        const b1 = db.batch(); un.docs.forEach(d => b1.delete(d.ref)); if (!un.empty) await b1.commit();
        await db.collection('users').doc(uid).delete().catch(() => {});
    });

    it('RL-U1: unauthenticated request denied', async () => {
        if (!indexModule) return;
        const { error } = await callDirect(indexModule.claimUsername, null, {}, { username: 'someName' });
        expect(error.code).toBe('unauthenticated');
    });

    it('RL-U2: normal first claim succeeds', async () => {
        if (!indexModule) return;
        const name = `rlu2_${Date.now()}`.slice(0, 20);
        const { result, error } = await callDirect(indexModule.claimUsername, uid, {}, { username: name });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);
        const doc = await db.collection('usernames').doc(name.toLowerCase()).get();
        expect(doc.exists).toBe(true);
        expect(doc.data().uid).toBe(uid);
        await db.collection('usernames').doc(name.toLowerCase()).delete();
    });

    it('RL-U3: same-UID idempotent retry on an orphaned reservation succeeds without triggering cooldown', async () => {
        if (!indexModule) return;
        const name = `rlu3_${Date.now()}`.slice(0, 20);
        const normalized = name.toLowerCase();
        // Simulate a reservation this exact uid already owns (e.g. from a
        // failed saveUserProfile) — no users/{uid} doc exists yet.
        await db.collection('usernames').doc(normalized).set({ uid, claimedAt: Timestamp.now() });
        const { result, error } = await callDirect(indexModule.claimUsername, uid, {}, { username: name });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);
        await db.collection('usernames').doc(normalized).delete();
    });

    it('RL-U4: rapid claim attempts are eventually rate-limited', async () => {
        if (!indexModule) return;
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT);
        const { error } = await callDirect(indexModule.claimUsername, uid, {}, { username: 'anyName' });
        expect(error.code).toBe('resource-exhausted');
    });

    it('RL-U5: a genuine concurrent burst cannot bypass the limit (Promise.all, not sequential)', async () => {
        if (!indexModule) return;
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT - 2);
        const BURST = 5;
        const results = await Promise.allSettled(
            Array.from({ length: BURST }, (_, i) =>
                callDirect(indexModule.claimUsername, uid, {}, { username: `burst${i}_${Date.now()}`.slice(0, 20) }),
            ),
        );
        const outcomes = results.map(r => r.value);
        const notExhausted = outcomes.filter(o => o.error?.code !== 'resource-exhausted').length;
        const exhausted = outcomes.filter(o => o.error?.code === 'resource-exhausted').length;
        expect(notExhausted).toBe(2); // exactly 2 slots were available
        expect(exhausted).toBe(BURST - 2);
        const counterSnap = await db.collection('rateLimits').doc(seededDocId).get();
        expect(counterSnap.data().count).toBe(LIMIT); // exact boundary, no overshoot
        // Cleanup whichever username(s) actually succeeded.
        const un = await db.collection('usernames').where('uid', '==', uid).get();
        const b = db.batch(); un.docs.forEach(d => b.delete(d.ref)); if (!un.empty) await b.commit();
    });

    it('RL-U6: an unavailable (already-taken) username attempt still consumes rate-limit quota', async () => {
        if (!indexModule) return;
        const name = `rlu6_${Date.now()}`.slice(0, 20);
        const normalized = name.toLowerCase();
        await db.collection('usernames').doc(normalized).set({ uid: 'someone-else', claimedAt: Timestamp.now() });
        const { error } = await callDirect(indexModule.claimUsername, uid, {}, { username: name });
        expect(error.code).toBe('already-exists');
        const wk = currentWindowKey(WIN);
        const counter = await db.collection('rateLimits').doc(`${OP}_${wk}_${uid}`).get();
        expect(counter.exists).toBe(true);
        expect(counter.data().count).toBe(1); // the failed attempt still cost one slot
        seededDocId = `${OP}_${wk}_${uid}`;
        await db.collection('usernames').doc(normalized).delete();
    });

    it('RL-U7: a banned/reserved username is rejected before the expensive uniqueness transaction runs', async () => {
        if (!indexModule) return;
        const { error } = await callDirect(indexModule.claimUsername, uid, {}, { username: 'fuckoff' });
        expect(error.code).toBe('invalid-argument');
        const doc = await db.collection('usernames').doc('fuckoff').get();
        expect(doc.exists).toBe(false); // the uniqueness transaction never ran
    });

    it('RL-U8: the username uniqueness transaction remains correct — a different UID cannot steal a claimed name', async () => {
        if (!indexModule) return;
        const name = `rlu8_${Date.now()}`.slice(0, 20);
        const normalized = name.toLowerCase();
        const first = await callDirect(indexModule.claimUsername, uid, {}, { username: name });
        expect(first.result.success).toBe(true);

        const otherUid = `${uid}_other`;
        const { error } = await callDirect(indexModule.claimUsername, otherUid, {}, { username: name });
        expect(error.code).toBe('already-exists');

        const doc = await db.collection('usernames').doc(normalized).get();
        expect(doc.data().uid).toBe(uid); // ownership unchanged
        await db.collection('usernames').doc(normalized).delete();
        const wk = currentWindowKey(WIN);
        await db.collection('rateLimits').doc(`${OP}_${wk}_${otherUid}`).delete().catch(() => {});
    });

    it('RL-U9: the 30-day rename cooldown is preserved and is independent of the rate limiter', async () => {
        if (!indexModule) return;
        const oldName = `rlu9old_${Date.now()}`.slice(0, 20);
        await db.collection('usernames').doc(oldName.toLowerCase()).set({ uid, claimedAt: Timestamp.now() });
        await db.collection('users').doc(uid).set({
            username: oldName,
            usernameChangedAt: Timestamp.fromMillis(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        });
        const { error } = await callDirect(indexModule.claimUsername, uid, {}, { username: `rlu9new_${Date.now()}`.slice(0, 20) });
        expect(error.code).toBe('failed-precondition');
        expect(error.message).toMatch(/\d+ days/);
        await db.collection('usernames').doc(oldName.toLowerCase()).delete();
    });

    it('RL-U10: exhausting the rate limit never creates a stray usernames document', async () => {
        if (!indexModule) return;
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT);
        await callDirect(indexModule.claimUsername, uid, {}, { username: `rlu10_${Date.now()}`.slice(0, 20) });
        const un = await db.collection('usernames').where('uid', '==', uid).get();
        expect(un.empty).toBe(true); // no partial/orphaned reservation from a rejected attempt
    });
});

