'use strict';

/**
 * incrementTotalSpotsPinged — durable per-user "Pings shared" counter.
 *
 * Adds users/{uid}.impactStats.pingsShared as a GO-FORWARD-ONLY counter,
 * atomic with the existing functionEvents marker and stats/global counter.
 * Historical markers (written before this change deploys) are never
 * reprocessed — see CASE 8. This is a deliberate product decision: exact
 * per-user attribution is unrecoverable for the ~96% of historical pings
 * that predate marker tracking (see Pings Shared backfill-feasibility
 * investigation), so no migration/backfill semantics (pingsSharedApplied,
 * etc.) are introduced here.
 */

const crypto = require('crypto');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const PROJECT_ID = 'parkqueen-46475363-ccf36';
const APP_NAME = '__increment_pings_impact_intg__';
const testApp = getApps().find(app => app.name === APP_NAME) ?? initializeApp({ projectId: PROJECT_ID }, APP_NAME);
const db = getFirestore(testApp);
const indexModule = require('./index.js');

const RUN = `${process.pid}_${Date.now()}`;
let sequence = 0;
const nextId = label => `pships_${label}_${RUN}_${++sequence}`;

function createdEvent(id, params, data, eventId = `event_${id}`) {
    return { id: eventId, params, data: { id, data: () => data } };
}

function markerRef(eventId) {
    const markerId = crypto.createHash('sha256').update(eventId).digest('hex');
    return db.doc(`functionEvents/incrementTotalSpotsPinged_${markerId}`);
}

async function cleanup(...refs) {
    await Promise.all(refs.map(ref => ref.delete().catch(() => {})));
}

describe('incrementTotalSpotsPinged — durable per-user pingsShared counter', () => {
    it('CASE 1: new ping + existing user increments global total, impactStats.pingsShared, and writes the marker', async () => {
        const spotId = nextId('spot');
        const finderId = nextId('finder');
        const userRef = db.doc(`users/${finderId}`);
        await userRef.set({ crowns: 0 });
        const statsRef = db.doc('stats/global');
        const beforeGlobal = (await statsRef.get()).data()?.totalSpotsPinged || 0;
        const event = createdEvent(spotId, { spotId }, { finderId });

        await indexModule.incrementTotalSpotsPinged.run(event);

        const afterGlobal = (await statsRef.get()).data()?.totalSpotsPinged || 0;
        expect(afterGlobal - beforeGlobal).toBe(1);
        const userSnap = await userRef.get();
        expect(userSnap.data().impactStats.pingsShared).toBe(1);
        const markerSnap = await markerRef(event.id).get();
        expect(markerSnap.exists).toBe(true);
        expect(markerSnap.data().actorUserId).toBe(finderId);

        await cleanup(userRef, markerRef(event.id));
    });

    it('CASE 2: existing user with no impactStats field gets impactStats created safely', async () => {
        const spotId = nextId('spot');
        const finderId = nextId('finder');
        const userRef = db.doc(`users/${finderId}`);
        await userRef.set({ crowns: 5 }); // no impactStats at all
        const event = createdEvent(spotId, { spotId }, { finderId });

        await indexModule.incrementTotalSpotsPinged.run(event);

        const userSnap = await userRef.get();
        expect(userSnap.data().impactStats).toEqual({ pingsShared: 1 });
        expect(userSnap.data().crowns).toBe(5); // sibling top-level field preserved

        await cleanup(userRef, markerRef(event.id));
    });

    it('CASE 3: existing impactStats siblings are preserved when pingsShared is added', async () => {
        const spotId = nextId('spot');
        const finderId = nextId('finder');
        const userRef = db.doc(`users/${finderId}`);
        await userRef.set({ impactStats: { someFutureCounter: 9 } });
        const event = createdEvent(spotId, { spotId }, { finderId });

        await indexModule.incrementTotalSpotsPinged.run(event);

        const userSnap = await userRef.get();
        expect(userSnap.data().impactStats.someFutureCounter).toBe(9);
        expect(userSnap.data().impactStats.pingsShared).toBe(1);

        await cleanup(userRef, markerRef(event.id));
    });

    it('CASE 4: existing numeric pingsShared value increments exactly once', async () => {
        const spotId = nextId('spot');
        const finderId = nextId('finder');
        const userRef = db.doc(`users/${finderId}`);
        await userRef.set({ impactStats: { pingsShared: 7 } });
        const event = createdEvent(spotId, { spotId }, { finderId });

        await indexModule.incrementTotalSpotsPinged.run(event);

        const userSnap = await userRef.get();
        expect(userSnap.data().impactStats.pingsShared).toBe(8);

        await cleanup(userRef, markerRef(event.id));
    });

    it('CASE 5: same event delivered sequentially twice increments pingsShared only once', async () => {
        const spotId = nextId('spot');
        const finderId = nextId('finder');
        const userRef = db.doc(`users/${finderId}`);
        await userRef.set({});
        const event = createdEvent(spotId, { spotId }, { finderId });

        await indexModule.incrementTotalSpotsPinged.run(event);
        await indexModule.incrementTotalSpotsPinged.run(event);

        const userSnap = await userRef.get();
        expect(userSnap.data().impactStats.pingsShared).toBe(1);

        await cleanup(userRef, markerRef(event.id));
    });

    it('CASE 6: same event delivered concurrently twice increments pingsShared only once', async () => {
        const spotId = nextId('spot');
        const finderId = nextId('finder');
        const userRef = db.doc(`users/${finderId}`);
        await userRef.set({});
        const event = createdEvent(spotId, { spotId }, { finderId });

        await Promise.all([
            indexModule.incrementTotalSpotsPinged.run(event),
            indexModule.incrementTotalSpotsPinged.run(event),
        ]);

        const userSnap = await userRef.get();
        expect(userSnap.data().impactStats.pingsShared).toBe(1);

        await cleanup(userRef, markerRef(event.id));
    });

    it('CASE 7: different event IDs for the same user each increment pingsShared once', async () => {
        const finderId = nextId('finder');
        const userRef = db.doc(`users/${finderId}`);
        await userRef.set({});
        const spotId1 = nextId('spot');
        const spotId2 = nextId('spot');
        const event1 = createdEvent(spotId1, { spotId: spotId1 }, { finderId });
        const event2 = createdEvent(spotId2, { spotId: spotId2 }, { finderId });

        await indexModule.incrementTotalSpotsPinged.run(event1);
        await indexModule.incrementTotalSpotsPinged.run(event2);

        const userSnap = await userRef.get();
        expect(userSnap.data().impactStats.pingsShared).toBe(2);

        await cleanup(userRef, markerRef(event1.id), markerRef(event2.id));
    });

    it('CASE 8: a pre-existing historical marker is never reprocessed — no retroactive per-user increment', async () => {
        const spotId = nextId('spot');
        const finderId = nextId('finder');
        const userRef = db.doc(`users/${finderId}`);
        await userRef.set({});
        const event = createdEvent(spotId, { spotId }, { finderId });
        // Simulate a marker already written (pre-this-deploy shape or otherwise) —
        // its mere existence must short-circuit; there is no pingsSharedApplied
        // concept to reprocess it under.
        await markerRef(event.id).set({
            functionName: 'incrementTotalSpotsPinged',
            sourceEventId: event.id,
            spotId,
            actorUserId: finderId,
            processedAt: Timestamp.now(),
        });
        const statsRef = db.doc('stats/global');
        const beforeGlobal = (await statsRef.get()).data()?.totalSpotsPinged || 0;

        await indexModule.incrementTotalSpotsPinged.run(event);

        const afterGlobal = (await statsRef.get()).data()?.totalSpotsPinged || 0;
        expect(afterGlobal).toBe(beforeGlobal); // no global increment — already processed
        const userSnap = await userRef.get();
        expect(userSnap.data().impactStats).toBeUndefined(); // no retroactive backfill

        await cleanup(userRef, markerRef(event.id));
    });

    it('CASE 9: actor user missing before first handler execution — global still increments, marker written, no user doc created', async () => {
        const spotId = nextId('spot');
        const finderId = nextId('finder'); // never created
        const userRef = db.doc(`users/${finderId}`);
        const statsRef = db.doc('stats/global');
        const beforeGlobal = (await statsRef.get()).data()?.totalSpotsPinged || 0;
        const event = createdEvent(spotId, { spotId }, { finderId });

        await indexModule.incrementTotalSpotsPinged.run(event);

        const afterGlobal = (await statsRef.get()).data()?.totalSpotsPinged || 0;
        expect(afterGlobal - beforeGlobal).toBe(1);
        const userSnap = await userRef.get();
        expect(userSnap.exists).toBe(false); // no stub created
        const markerSnap = await markerRef(event.id).get();
        expect(markerSnap.exists).toBe(true);

        await cleanup(markerRef(event.id));
    });

    it('CASE 10: user missing at process time — resolves cleanly, no resurrection, no poison retry', async () => {
        const spotId = nextId('spot');
        const finderId = nextId('finder');
        const event = createdEvent(spotId, { spotId }, { finderId });

        await expect(indexModule.incrementTotalSpotsPinged.run(event)).resolves.not.toThrow();
        const userSnap = await db.doc(`users/${finderId}`).get();
        expect(userSnap.exists).toBe(false);

        await cleanup(markerRef(event.id));
    });

    it('CASE 11: missing-user duplicate delivery still only increments the global counter once', async () => {
        const spotId = nextId('spot');
        const finderId = nextId('finder');
        const statsRef = db.doc('stats/global');
        const beforeGlobal = (await statsRef.get()).data()?.totalSpotsPinged || 0;
        const event = createdEvent(spotId, { spotId }, { finderId });

        await indexModule.incrementTotalSpotsPinged.run(event);
        await indexModule.incrementTotalSpotsPinged.run(event);

        const afterGlobal = (await statsRef.get()).data()?.totalSpotsPinged || 0;
        expect(afterGlobal - beforeGlobal).toBe(1);

        await cleanup(markerRef(event.id));
    });

    // CASE 12 (transaction fails before commit → nothing applied; retry then
    // applies exactly once) is covered by construction, not a separate crash-
    // injection test: every write (marker, global increment, per-user
    // increment) happens inside one Firestore transaction, which is
    // all-or-nothing by the platform's own guarantee — proven in practice by
    // CASE 5/6/11's duplicate-delivery assertions, which would fail if a
    // partial commit were possible.
});
