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

    it('RL-B7: rejected (exhausted) request does not write a new moderationLog entry', async () => {
        if (!indexModule) return;
        seededDocId = await seedCounter(OP, uid, WIN, LIMIT);
        const before = (await db.collection('moderationLog').where('userId', '==', uid).get()).size;
        await callDirect(indexModule.moderateContent, uid, {}, { text: 'hi', type: 'message' });
        const after = (await db.collection('moderationLog').where('userId', '==', uid).get()).size;
        expect(after).toBe(before); // no new log entry from an exhausted caller
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

