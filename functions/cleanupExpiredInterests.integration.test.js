'use strict';

/**
 * cleanupExpiredInterests exercises the real scheduled handler via .run()
 * against the Firestore emulator (no mocks). The emulator does NOT enforce
 * production composite-index requirements, so these tests prove query
 * *correctness* and cleanup *safety* semantics only — they cannot prove the
 * required index is deployed or READY in production. That is verified
 * separately (Cloud Logging / Firestore index metadata), not by this suite.
 */

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'parkqueen-46475363-ccf36';
const APP_NAME = '__cleanup_expired_interests_intg__';
const testApp = getApps().find(app => app.name === APP_NAME) ?? initializeApp({ projectId: PROJECT_ID }, APP_NAME);
const db = getFirestore(testApp);
const indexModule = require('./index.js');

const RUN = `${process.pid}_${Date.now()}`;
let sequence = 0;
const nextId = label => `cei_${label}_${RUN}_${++sequence}`;

const PAST = Timestamp.fromMillis(Date.now() - 60_000);
const FUTURE = Timestamp.fromMillis(Date.now() + 60 * 60_000);
const FAR_FUTURE = Timestamp.fromMillis(Date.now() + 24 * 60 * 60_000);

function headingSpot(overrides = {}) {
    return {
        finderId: 'finder_x',
        finderName: 'Finder',
        address: '1 Test St',
        lat: 40.7,
        lng: -74.0,
        status: 'interested',
        claimState: 'heading',
        interestedUserId: 'claimant_x',
        interestedUserName: 'Claimant',
        pingMode: 'now',
        reportedAt: PAST,
        expiresAt: FUTURE, // Ping itself still valid unless overridden
        interestExpiresAt: PAST, // claim expired
        ...overrides,
    };
}

async function getSpot(id) {
    return (await db.doc(`spots/${id}`).get()).data();
}

describe('cleanupExpiredInterests Function contract', () => {
    it('CEI-1: query is a bounded (limit 500), non-paginating scan of spots(status, interestExpiresAt)', () => {
        const src = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
        const fn = src.slice(src.indexOf('exports.cleanupExpiredInterests'), src.indexOf('exports.cleanupExpiredInterests') + 1500);
        expect(fn).toMatch(/\.collection\("spots"\)/);
        expect(fn).toMatch(/\.where\("status",\s*"==",\s*"interested"\)/);
        expect(fn).toMatch(/\.where\("interestExpiresAt",\s*"<=",\s*now\)/);
        expect(fn).toMatch(/\.limit\(500\)/);
    });

    it('CEI-2: an expired heading claim on a still-valid Ping is cleared and the Ping reopens to available', async () => {
        const id = nextId('reopen');
        await db.doc(`spots/${id}`).set(headingSpot());
        await indexModule.cleanupExpiredInterests.run();

        const spot = await getSpot(id);
        expect(spot.status).toBe('available');
        expect(spot.interestedUserId).toBeNull();
        expect(spot.claimState).toBeNull();
        expect(spot.claimStartedAt).toBeNull();
        expect(spot.interestExpiresAt).toBeNull();
    });

    it('CEI-3: an expired heading claim on an ALREADY-expired Ping is cleared but the Ping never reopens', async () => {
        const id = nextId('noreopen');
        await db.doc(`spots/${id}`).set(headingSpot({ expiresAt: PAST })); // Ping itself is expired too
        await indexModule.cleanupExpiredInterests.run();

        const spot = await getSpot(id);
        expect(spot.status).toBe('interested'); // untouched — never flipped to available
        expect(spot.interestedUserId).toBeNull(); // stale claim still cleared
        expect(spot.claimState).toBeNull();
    });

    it('CEI-4: a claim whose interestExpiresAt is still in the future is completely untouched', async () => {
        const id = nextId('notexpired');
        await db.doc(`spots/${id}`).set(headingSpot({ interestExpiresAt: FUTURE }));
        await indexModule.cleanupExpiredInterests.run();

        const spot = await getSpot(id);
        expect(spot.status).toBe('interested');
        expect(spot.interestedUserId).toBe('claimant_x');
    });

    it('CEI-5: a spot with no interestExpiresAt field at all (malformed/legacy) is never touched', async () => {
        const id = nextId('malformed');
        const seed = headingSpot();
        delete seed.interestExpiresAt;
        await db.doc(`spots/${id}`).set(seed);
        await indexModule.cleanupExpiredInterests.run();

        const spot = await getSpot(id);
        expect(spot.status).toBe('interested');
        expect(spot.interestedUserId).toBe('claimant_x');
    });

    it('CEI-6: a committed (scheduled) claim not yet at its own expiry is untouched — this Function only acts on expired heading claims', async () => {
        const id = nextId('committed');
        await db.doc(`spots/${id}`).set(headingSpot({
            claimState: 'committed',
            pingMode: 'later',
            expiresAt: FAR_FUTURE,
            interestExpiresAt: FAR_FUTURE, // committed claims mirror the Ping's own expiry
        }));
        await indexModule.cleanupExpiredInterests.run();

        const spot = await getSpot(id);
        expect(spot.status).toBe('interested');
        expect(spot.claimState).toBe('committed');
    });

    it('CEI-7: retrying the run is idempotent — a second invocation is a safe no-op on an already-cleaned spot', async () => {
        const id = nextId('retry');
        await db.doc(`spots/${id}`).set(headingSpot());
        await indexModule.cleanupExpiredInterests.run();
        const afterFirst = await getSpot(id);

        await indexModule.cleanupExpiredInterests.run();
        const afterSecond = await getSpot(id);

        expect(afterFirst.status).toBe('available');
        expect(afterSecond).toEqual(afterFirst); // no further change
    });

    it('CEI-8: a newer claim that replaces the stale one before cleanup runs is fully protected', async () => {
        const id = nextId('newer');
        await db.doc(`spots/${id}`).set(headingSpot()); // starts as an expired candidate
        // Simulate a race: someone re-claims the spot before the sweep executes.
        await db.doc(`spots/${id}`).update({
            interestedUserId: 'newer_claimant',
            interestExpiresAt: FUTURE,
        });

        await indexModule.cleanupExpiredInterests.run();

        const spot = await getSpot(id);
        expect(spot.status).toBe('interested');
        expect(spot.interestedUserId).toBe('newer_claimant');
    });

    it('CEI-9: creates no notification documents (this Function has never sent any — confirms the fix does not introduce new side effects)', async () => {
        const id = nextId('nonotif');
        await db.doc(`spots/${id}`).set(headingSpot());
        await indexModule.cleanupExpiredInterests.run();

        const snap = await db.collection('spotNotifications').where('spotId', '==', id).get();
        expect(snap.empty).toBe(true);
    });
});
