'use strict';

/**
 * Eventarc retry hardening — parqueen-system-events handlers.
 *
 * Confirms retry: true is enabled on the three marker-protected, atomic
 * system-event handlers proven safe (incrementTotalSpotsPinged,
 * updateTrustOnFeedback, updateTrustOnSpotDelete), and proves duplicate
 * Eventarc delivery is safe for each.
 *
 * Confirms retry remains OFF on:
 *  - awardCrowns — a real transaction-abort poison-event risk (see AC-7 in
 *    awardCrowns.integration.test.js: a missing driver user document throws
 *    inside the transaction before the processed marker can be written, so a
 *    redelivered event would retry that exact same throw for the full
 *    Eventarc retry window with no escape).
 *  - initUserPrivateAccount — NOT retry-safe as currently written: it
 *    unconditionally .set()s two literal keys (moderationStatus,
 *    reportCount) with merge:true on every invocation. A delayed redelivery
 *    of the original users/{uid} create event silently reverts any
 *    legitimate later change to either field back to its init value — proven
 *    below by the delayed-redelivery test. No current writer in this repo
 *    changes either field after creation, but that's a property of what code
 *    exists today, not a guarantee this handler's own write pattern
 *    provides. Needs a design change (e.g. only set fields not already
 *    present, or a processed-event marker) before retry can be safely
 *    enabled — out of scope for this change.
 *  - notifyNearbyUsers — separate messaging retry analysis, not in scope
 *    here.
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const PROJECT_ID = 'parkqueen-46475363-ccf36';
const APP_NAME = '__eventarc_retry_hardening_intg__';
const testApp = getApps().find(app => app.name === APP_NAME) ?? initializeApp({ projectId: PROJECT_ID }, APP_NAME);
const db = getFirestore(testApp);
const indexModule = require('./index.js');

const RUN = `${process.pid}_${Date.now()}`;
let sequence = 0;
const nextId = label => `erh_${label}_${RUN}_${++sequence}`;

function createdEvent(id, params, data, eventId = `event_${id}`) {
    return { id: eventId, params, data: { id, data: () => data } };
}

// ── initUserPrivateAccount: delayed-redelivery scenario ───────────────────────
// initUserPrivateAccount unconditionally .set()s two literal keys
// (moderationStatus, reportCount) with merge:true on every invocation,
// including a redelivered original users/{uid} create event. merge:true only
// protects OTHER keys (already proven by OB-5/OB-9 with unrelated fields like
// customField/email) — it does NOT protect these two specific keys from being
// reset to their init values if something legitimately changed them in the
// interim. No current writer in this repository changes either field after
// creation (see PR description / final report for the exhaustive search), but
// that is a property of what code happens to exist today, not a guarantee
// this handler's own write pattern provides — so retry is not safe on this
// handler as currently written.
describe('initUserPrivateAccount delayed-redelivery scenario', () => {
    it('T0-T4: a legitimate later mutation to moderationStatus/reportCount is silently reverted by a delayed redelivery of the original create event', async () => {
        const userId = nextId('user');
        const originalEvent = createdEvent(userId, { userId }, {}, `event_${userId}`);
        const accountRef = db.doc(`users/${userId}/private/account`);

        // T1: initUserPrivateAccount succeeds on first delivery.
        await indexModule.initUserPrivateAccount.run(originalEvent);
        expect((await accountRef.get()).data()).toEqual({ moderationStatus: 'active', reportCount: 0 });

        // T2: some legitimate later application action changes both fields
        // (stand-in for any future moderation/report-count feature — Admin
        // SDK write, bypassing the client-blocking `allow write: if false`
        // rule, exactly as any real server-side mutation would).
        await accountRef.set({ moderationStatus: 'suspended', reportCount: 3 }, { merge: true });
        expect((await accountRef.get()).data()).toEqual({ moderationStatus: 'suspended', reportCount: 3 });

        // T3/T4: Eventarc redelivers the SAME original users/{uid} create
        // event (at-least-once delivery — this is exactly what retry: true
        // legitimizes happening arbitrarily late).
        await indexModule.initUserPrivateAccount.run(originalEvent);

        // The T2 mutation does NOT survive — this is the retry-unsafety.
        const finalState = (await accountRef.get()).data();
        expect(finalState).toEqual({ moderationStatus: 'active', reportCount: 0 });
        expect(finalState).not.toEqual({ moderationStatus: 'suspended', reportCount: 3 });

        await accountRef.delete();
    });
});

function deletedEvent(id, params, data, time) {
    return { id: `event_${id}`, params, data: { id, data: () => data }, time };
}

async function cleanup(...refs) {
    await Promise.all(refs.map(ref => ref.delete().catch(() => {})));
}

// ── Config-contract: retry enabled/excluded exactly as decided ───────────────
describe('Eventarc retry configuration — parqueen-system-events handlers', () => {
    const src = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

    function sliceFn(exportName, nextExportName) {
        const start = src.indexOf(`exports.${exportName} = `);
        expect(start).toBeGreaterThan(-1);
        const end = nextExportName ? src.indexOf(`exports.${nextExportName}`, start) : start + 2000;
        return src.slice(start, end);
    }

    it('initUserPrivateAccount remains WITHOUT retry — a delayed redelivery of the create event would silently revert any later legitimate change to moderationStatus/reportCount (see the delayed-redelivery test below)', () => {
        expect(sliceFn('initUserPrivateAccount', 'cleanupExpiredSpotsHourly')).not.toMatch(/retry:\s*true/);
    });

    it('incrementTotalSpotsPinged has retry enabled', () => {
        expect(sliceFn('incrementTotalSpotsPinged', 'notifyNearbyUsers')).toMatch(/retry:\s*true/);
    });

    it('updateTrustOnFeedback has retry enabled', () => {
        expect(sliceFn('updateTrustOnFeedback', 'scheduleCleaningReminders')).toMatch(/retry:\s*true/);
    });

    it('updateTrustOnSpotDelete has retry enabled', () => {
        expect(sliceFn('updateTrustOnSpotDelete', 'adminResolveParseFailure')).toMatch(/retry:\s*true/);
    });

    it('awardCrowns remains WITHOUT retry — a missing driver/finder document throws before the processed marker can be written (see AC-7), so a redelivered event would retry an unrecoverable failure for the full Eventarc window', () => {
        expect(sliceFn('awardCrowns', 'adminDeleteSpot')).not.toMatch(/retry:\s*true/);
    });

    it('notifyNearbyUsers remains WITHOUT retry — out of scope, requires separate FCM partial-delivery retry analysis', () => {
        expect(sliceFn('notifyNearbyUsers', 'generateEmailOTP')).not.toMatch(/retry:\s*true/);
    });

    it('moderateAvatarUpload (already retry-enabled, out of scope for this change) is unaffected', () => {
        expect(sliceFn('moderateAvatarUpload', '_isAllowedImageHeader')).toMatch(/retry:\s*true/);
    });
});

// ── incrementTotalSpotsPinged: duplicate delivery ─────────────────────────────
describe('incrementTotalSpotsPinged duplicate-delivery safety', () => {
    it('the same event delivered twice sequentially increments stats/global by exactly 1', async () => {
        const spotId = nextId('spot');
        const finderId = nextId('finder');
        const statsRef = db.doc('stats/global');
        const before = (await statsRef.get()).data()?.totalSpotsPinged || 0;
        const event = createdEvent(spotId, { spotId }, { finderId });

        await indexModule.incrementTotalSpotsPinged.run(event);
        await indexModule.incrementTotalSpotsPinged.run(event);

        const after = (await statsRef.get()).data()?.totalSpotsPinged || 0;
        expect(after - before).toBe(1);

        const markerId = require('crypto').createHash('sha256').update(event.id).digest('hex');
        await cleanup(db.doc(`functionEvents/incrementTotalSpotsPinged_${markerId}`));
    });

    it('the same event delivered concurrently twice increments stats/global by exactly 1', async () => {
        const spotId = nextId('spot');
        const finderId = nextId('finder');
        const statsRef = db.doc('stats/global');
        const before = (await statsRef.get()).data()?.totalSpotsPinged || 0;
        const event = createdEvent(spotId, { spotId }, { finderId });

        await Promise.all([
            indexModule.incrementTotalSpotsPinged.run(event),
            indexModule.incrementTotalSpotsPinged.run(event),
        ]);

        const after = (await statsRef.get()).data()?.totalSpotsPinged || 0;
        expect(after - before).toBe(1);

        const markerId = require('crypto').createHash('sha256').update(event.id).digest('hex');
        await cleanup(db.doc(`functionEvents/incrementTotalSpotsPinged_${markerId}`));
    });
});

// ── updateTrustOnFeedback: duplicate delivery ─────────────────────────────────
describe('updateTrustOnFeedback duplicate-delivery safety', () => {
    it('the same feedback-created event delivered twice applies handoffsCompleted only once', async () => {
        const finderId = nextId('finder');
        const feedbackId = `${nextId('spot')}_${nextId('driver')}`;
        await db.doc(`users/${finderId}`).set({ crowns: 0 });

        const event = createdEvent(feedbackId, { feedbackId }, { outcome: 'success', finderId });
        await indexModule.updateTrustOnFeedback.run(event);
        await indexModule.updateTrustOnFeedback.run(event);

        const userSnap = await db.doc(`users/${finderId}`).get();
        expect(userSnap.data().trustStats.handoffsCompleted).toBe(1);

        await cleanup(
            db.doc(`users/${finderId}`),
            db.doc(`users/${finderId}/processedTrustEvents/${feedbackId}:finder`),
        );
    });

    it('a finder deleted before the event fires is a safe no-op — no throw, no marker (this is why retry-enabling this handler creates no poison-event risk: the only realistic missing-document precondition already terminates cleanly instead of throwing)', async () => {
        const finderId = nextId('finder'); // deliberately never created
        const feedbackId = `${nextId('spot')}_${nextId('driver')}`;
        const event = createdEvent(feedbackId, { feedbackId }, { outcome: 'success', finderId });

        await expect(indexModule.updateTrustOnFeedback.run(event)).resolves.not.toThrow();
        expect((await db.doc(`users/${finderId}/processedTrustEvents/${feedbackId}:finder`).get()).exists).toBe(false);
    });
});

// ── updateTrustOnSpotDelete: duplicate delivery ───────────────────────────────
describe('updateTrustOnSpotDelete duplicate-delivery safety', () => {
    it('the same spot-deleted event delivered twice applies the cancellation penalty only once', async () => {
        const finderId = nextId('finder');
        const spotId = nextId('spot');
        await db.doc(`users/${finderId}`).set({ crowns: 0 });

        const futureExpiry = Timestamp.fromMillis(Date.now() + 60 * 60 * 1000);
        const event = deletedEvent(
            spotId,
            { spotId },
            { status: 'interested', finderId, expiresAt: futureExpiry },
            new Date().toISOString(),
        );

        await indexModule.updateTrustOnSpotDelete.run(event);
        await indexModule.updateTrustOnSpotDelete.run(event);

        const userSnap = await db.doc(`users/${finderId}`).get();
        expect(userSnap.data().trustStats.handoffsCancelledByFinder).toBe(1);

        await cleanup(
            db.doc(`users/${finderId}`),
            db.doc(`users/${finderId}/processedTrustEvents/${spotId}:finder-cancel`),
        );
    });

    it('duplicate delivery of an already-expired spot deletion still applies zero penalty (expiration exemption preserved under retry)', async () => {
        const finderId = nextId('finder');
        const spotId = nextId('spot');
        await db.doc(`users/${finderId}`).set({ crowns: 0 });

        const now = Date.now();
        const event = deletedEvent(
            spotId,
            { spotId },
            { status: 'interested', finderId, expiresAt: Timestamp.fromMillis(now - 1000) },
            new Date(now).toISOString(),
        );

        await indexModule.updateTrustOnSpotDelete.run(event);
        await indexModule.updateTrustOnSpotDelete.run(event);

        const userSnap = await db.doc(`users/${finderId}`).get();
        expect(userSnap.data().trustStats?.handoffsCancelledByFinder || 0).toBe(0);

        await cleanup(db.doc(`users/${finderId}`));
    });
});
