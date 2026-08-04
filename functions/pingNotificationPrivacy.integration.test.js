'use strict';

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const PROJECT_ID = 'parkqueen-46475363-ccf36';
const APP_NAME = '__ping_notification_privacy_intg__';
const testApp = getApps().find(app => app.name === APP_NAME) ?? initializeApp({ projectId: PROJECT_ID }, APP_NAME);
const db = getFirestore(testApp);
const indexModule = require('./index.js');

const RUN = `${process.pid}_${Date.now()}`;
let sequence = 0;
const nextId = label => `pn_${label}_${RUN}_${++sequence}`;

function createdEvent(spotId, data, eventId = `event_${spotId}`) {
    return {
        id: eventId,
        params: { spotId },
        data: { id: spotId, data: () => data },
    };
}

async function removeCollectionDocs(collectionName, field, value) {
    const snap = await db.collection(collectionName).where(field, '==', value).get();
    await Promise.all(snap.docs.map(doc => doc.ref.delete()));
}

describe('Ping notification/privacy Function contract', () => {
    beforeEach(() => {
        if (!indexModule._pingNotificationHooks) return;
        indexModule._pingNotificationHooks.sendEach = async messages => ({
            successCount: messages.length,
            failureCount: 0,
            responses: messages.map(() => ({ success: true })),
        });
        indexModule._pingNotificationHooks.send = async () => 'message-id';
        indexModule._pingNotificationHooks.beforeStaleTokenCleanup = null;
        indexModule._pingNotificationHooks.now = null;
    });

    afterEach(() => {
        if (!indexModule._pingNotificationHooks) return;
        indexModule._pingNotificationHooks.sendEach = null;
        indexModule._pingNotificationHooks.send = null;
        indexModule._pingNotificationHooks.beforeStaleTokenCleanup = null;
        indexModule._pingNotificationHooks.now = null;
        vi.restoreAllMocks();
    });

    it('PN-1 increments once for a retry and again when the same Ping ID is genuinely recreated', async () => {
        const spotId = nextId('count');
        const statsRef = db.doc('stats/global');
        await statsRef.set({ totalSpotsPinged: 0 }, { merge: true });

        const firstEvent = createdEvent(spotId, { finderId: 'owner_a', geohash: 'dr5r', lat: 40.7, lng: -73.9 }, nextId('event'));
        await indexModule.incrementTotalSpotsPinged.run(firstEvent);
        await indexModule.incrementTotalSpotsPinged.run(firstEvent);
        await indexModule.incrementTotalSpotsPinged.run(
            createdEvent(spotId, { finderId: 'owner_a', geohash: 'dr5r', lat: 40.7, lng: -73.9 }, nextId('event')),
        );

        expect((await statsRef.get()).data().totalSpotsPinged).toBe(2);
        await removeCollectionDocs('functionEvents', 'spotId', spotId);
    });

    it('PN-2 ignores malformed created Ping documents', async () => {
        const spotId = nextId('malformed');
        const statsRef = db.doc('stats/global');
        await statsRef.set({ totalSpotsPinged: 20 }, { merge: true });
        await indexModule.incrementTotalSpotsPinged.run(createdEvent(spotId, { finderId: '', geohash: null }));
        expect((await statsRef.get()).data().totalSpotsPinged).toBe(20);
    });

    it('PN-3 retries do not duplicate nearby push or bell delivery', async () => {
        const spotId = nextId('nearby');
        const ownerId = nextId('owner');
        const recipientId = nextId('recipient');
        const now = Date.now();
        const geohash = require('geofire-common').geohashForLocation([40.7128, -74.006], 9);
        await db.doc(`userLocations/${recipientId}`).set({
            lastGeohash: geohash,
            lastGeohashUpdatedAt: Timestamp.fromMillis(now),
        });
        await db.doc(`users/${recipientId}/private/preferences`).set({
            fcmToken: `token_${recipientId}`,
            notificationsEnabled: true,
            notificationRadius: 1,
        });
        const batches = [];
        indexModule._pingNotificationHooks.sendEach = async messages => {
            batches.push(messages);
            return { successCount: messages.length, failureCount: 0, responses: messages.map(() => ({ success: true })) };
        };

        const prefix = geohash.substring(0, 4);
        const seededLocations = await db.collection('userLocations')
            .where('lastGeohash', '>=', prefix)
            .where('lastGeohash', '<=', `${prefix}\uf8ff`)
            .get();
        expect(seededLocations.docs.some(doc => doc.id === recipientId)).toBe(true);
        expect((await db.doc(`users/${recipientId}/private/preferences`).get()).exists).toBe(true);
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

        const event = createdEvent(spotId, { finderId: ownerId, geohash, lat: 40.7128, lng: -74.006 });
        await indexModule.notifyNearbyUsers.run(event);
        await indexModule.notifyNearbyUsers.run(event);
        await indexModule.notifyNearbyUsers.run(createdEvent(
            spotId,
            { finderId: ownerId, geohash, lat: 40.7128, lng: -74.006 },
            nextId('recreated_event'),
        ));

        expect(errors).not.toHaveBeenCalled();
        expect(batches.flat()).toHaveLength(2);
        const bells = await db.collection('spotNotifications').where('spotId', '==', spotId).get();
        expect(bells.docs).toHaveLength(2);
        expect(bells.docs[0].data()).toMatchObject({
            spotId,
            senderId: ownerId,
            targetUserId: recipientId,
            claimId: null,
            type: 'nearby_spot',
        });

        await Promise.all([
            db.doc(`userLocations/${recipientId}`).delete(),
            db.doc(`users/${recipientId}/private/preferences`).delete(),
            ...bells.docs.map(doc => doc.ref.delete()),
            removeCollectionDocs('notificationDeliveries', 'spotId', spotId),
        ]);
    });

    it('PN-4 stale-token cleanup preserves a replacement token written after send', async () => {
        const spotId = nextId('stale');
        const ownerId = nextId('owner');
        const recipientId = nextId('recipient');
        const now = Date.now();
        const geohash = require('geofire-common').geohashForLocation([40.7128, -74.006], 9);
        const prefsRef = db.doc(`users/${recipientId}/private/preferences`);
        await db.doc(`userLocations/${recipientId}`).set({ lastGeohash: geohash, lastGeohashUpdatedAt: Timestamp.fromMillis(now) });
        await prefsRef.set({ fcmToken: 'stale-token', notificationsEnabled: true, notificationRadius: 1 });
        indexModule._pingNotificationHooks.sendEach = async messages => ({
            successCount: 0,
            failureCount: messages.length,
            responses: messages.map(() => ({ success: false, error: { code: 'messaging/registration-token-not-registered' } })),
        });
        indexModule._pingNotificationHooks.beforeStaleTokenCleanup = async () => {
            await prefsRef.update({ fcmToken: 'replacement-token' });
        };

        await indexModule.notifyNearbyUsers.run(createdEvent(spotId, { finderId: ownerId, geohash, lat: 40.7128, lng: -74.006 }));
        expect((await prefsRef.get()).data().fcmToken).toBe('replacement-token');

        await Promise.all([
            db.doc(`userLocations/${recipientId}`).delete(), prefsRef.delete(),
            removeCollectionDocs('spotNotifications', 'spotId', spotId),
            removeCollectionDocs('notificationDeliveries', 'spotId', spotId),
        ]);
    });

    it('PN-5 scheduled reminder uses recipient language and records complete deterministic metadata', async () => {
        const spotId = nextId('reminder');
        const ownerId = nextId('owner');
        const claimerId = nextId('claimer');
        const now = Timestamp.now();
        await db.doc(`users/${claimerId}/private/preferences`).set({ fcmToken: 'reminder-token', lang: 'es' });
        await db.doc(`spots/${spotId}`).set({
            finderId: ownerId,
            finderName: 'Owner',
            status: 'interested',
            claimState: 'committed',
            interestedUserId: claimerId,
            claimReminderAt: Timestamp.fromMillis(now.toMillis() - 1000),
            claimAutoReleaseAt: Timestamp.fromMillis(now.toMillis() + 600000),
            expiresAt: Timestamp.fromMillis(now.toMillis() + 1200000),
        });
        const sent = [];
        indexModule._pingNotificationHooks.send = async message => { sent.push(message); return 'message-id'; };
        await indexModule.processScheduledClaims.run({});
        await indexModule.processScheduledClaims.run({});

        expect(sent).toHaveLength(1);
        expect(sent[0].notification.title).toBe('🅿️ Lugar abriéndose pronto');
        const notifications = await db.collection('spotNotifications').where('spotId', '==', spotId).get();
        expect(notifications.docs).toHaveLength(1);
        expect(notifications.docs[0].data()).toMatchObject({
            spotId,
            senderId: null,
            actorType: 'system',
            subjectUserId: ownerId,
            targetUserId: claimerId,
            type: 'scheduled_claim_reminder',
        });

        await Promise.all([
            db.doc(`spots/${spotId}`).delete(),
            db.doc(`users/${claimerId}/private/preferences`).delete(),
            ...notifications.docs.map(doc => doc.ref.delete()),
        ]);
    });

    it('PN-6 auto-release transition and both participant notifications commit once', async () => {
        const spotId = nextId('release');
        const ownerId = nextId('owner');
        const claimerId = nextId('claimer');
        const now = Timestamp.now();
        await db.doc(`spots/${spotId}`).set({
            finderId: ownerId,
            status: 'interested',
            claimState: 'committed',
            interestedUserId: claimerId,
            claimReminderAt: null,
            claimAutoReleaseAt: Timestamp.fromMillis(now.toMillis() - 1000),
            expiresAt: Timestamp.fromMillis(now.toMillis() + 600000),
        });
        await indexModule.processScheduledClaims.run({});
        await indexModule.processScheduledClaims.run({});

        expect((await db.doc(`spots/${spotId}`).get()).data()).toMatchObject({
            status: 'available', interestedUserId: null, claimState: null,
        });
        const notifications = await db.collection('spotNotifications').where('spotId', '==', spotId).get();
        expect(notifications.docs).toHaveLength(2);
        expect(notifications.docs.map(doc => doc.data().targetUserId).sort()).toEqual([claimerId, ownerId].sort());
        expect(notifications.docs.every(doc => typeof doc.data().claimId === 'string')).toBe(true);
        expect(notifications.docs.every(doc => doc.data().senderId === null)).toBe(true);

        await Promise.all([db.doc(`spots/${spotId}`).delete(), ...notifications.docs.map(doc => doc.ref.delete())]);
    });

    it('PN-7 invalid self-claim is released without a self-notification', async () => {
        const spotId = nextId('self');
        const ownerId = nextId('owner');
        const now = Timestamp.now();
        await db.doc(`spots/${spotId}`).set({
            finderId: ownerId,
            status: 'interested',
            claimState: 'committed',
            interestedUserId: ownerId,
            claimReminderAt: null,
            claimAutoReleaseAt: Timestamp.fromMillis(now.toMillis() - 1000),
            expiresAt: Timestamp.fromMillis(now.toMillis() + 600000),
        });
        await indexModule.processScheduledClaims.run({});
        const notifications = await db.collection('spotNotifications').where('spotId', '==', spotId).get();
        expect(notifications.empty).toBe(true);
        expect((await db.doc(`spots/${spotId}`).get()).data().status).toBe('available');
        await db.doc(`spots/${spotId}`).delete();
    });

    it('PN-8 leaves one durable bell and does not retry an ambiguous failed push attempt', async () => {
        const spotId = nextId('ambiguous');
        const ownerId = nextId('owner');
        const recipientId = nextId('recipient');
        const geohash = require('geofire-common').geohashForLocation([40.7128, -74.006], 9);
        await db.doc(`userLocations/${recipientId}`).set({ lastGeohash: geohash, lastGeohashUpdatedAt: Timestamp.now() });
        await db.doc(`users/${recipientId}/private/preferences`).set({ fcmToken: 'ambiguous-token', notificationRadius: 1 });
        let attempts = 0;
        indexModule._pingNotificationHooks.sendEach = async () => { attempts += 1; throw new Error('ambiguous provider result'); };
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        const event = createdEvent(spotId, { finderId: ownerId, geohash, lat: 40.7128, lng: -74.006 }, nextId('event'));

        await indexModule.notifyNearbyUsers.run(event);
        await indexModule.notifyNearbyUsers.run(event);

        expect(attempts).toBe(1);
        expect(errors).toHaveBeenCalledTimes(1);
        expect((await db.collection('spotNotifications').where('spotId', '==', spotId).get()).docs).toHaveLength(1);
        const deliveries = await db.collection('notificationDeliveries').where('spotId', '==', spotId).get();
        expect(deliveries.docs).toHaveLength(1);
        expect(deliveries.docs[0].data().status).toBe('reserved');
        await Promise.all([
            db.doc(`userLocations/${recipientId}`).delete(),
            db.doc(`users/${recipientId}/private/preferences`).delete(),
            removeCollectionDocs('spotNotifications', 'spotId', spotId),
            removeCollectionDocs('notificationDeliveries', 'spotId', spotId),
        ]);
    });

    it('PN-9 a later claim with the same timeout has a distinct generation and cannot collide', async () => {
        const spotId = nextId('claim_generation');
        const ownerId = nextId('owner');
        const firstClaimerId = nextId('claimer');
        const secondClaimerId = nextId('claimer');
        const timeout = Timestamp.fromMillis(Date.now() - 1000);
        const expiresAt = Timestamp.fromMillis(Date.now() + 600000);
        const spotRef = db.doc(`spots/${spotId}`);
        await spotRef.set({
            finderId: ownerId, status: 'interested', claimState: 'committed', interestedUserId: firstClaimerId,
            claimReminderAt: null, claimAutoReleaseAt: timeout, expiresAt,
        });
        await indexModule.processScheduledClaims.run({});
        await spotRef.update({
            status: 'interested', claimState: 'committed', interestedUserId: secondClaimerId,
            claimReminderAt: null, claimAutoReleaseAt: timeout, expiresAt,
        });
        await indexModule.processScheduledClaims.run({});

        const notifications = await db.collection('spotNotifications').where('spotId', '==', spotId).get();
        expect(notifications.docs).toHaveLength(4);
        expect(new Set(notifications.docs.map(doc => doc.data().claimId)).size).toBe(2);
        expect(notifications.docs.every(doc => doc.data().senderId === null)).toBe(true);
        await Promise.all([spotRef.delete(), ...notifications.docs.map(doc => doc.ref.delete())]);
    });

    it('PN-10 partial multicast success is terminal per recipient and never resends the success', async () => {
        const spotId = nextId('partial');
        const ownerId = nextId('owner');
        const recipientIds = [nextId('recipient'), nextId('recipient')];
        const geohash = require('geofire-common').geohashForLocation([40.7128, -74.006], 9);
        await Promise.all(recipientIds.flatMap((recipientId, index) => [
            db.doc(`userLocations/${recipientId}`).set({ lastGeohash: geohash, lastGeohashUpdatedAt: Timestamp.now() }),
            db.doc(`users/${recipientId}/private/preferences`).set({ fcmToken: `partial-token-${index}`, notificationRadius: 1 }),
        ]));
        let attempts = 0;
        indexModule._pingNotificationHooks.sendEach = async messages => {
            attempts += 1;
            return {
                successCount: 1,
                failureCount: 1,
                responses: messages.map((_, index) => index === 0
                    ? { success: true }
                    : { success: false, error: { code: 'messaging/internal-error' } }),
            };
        };
        const event = createdEvent(spotId, { finderId: ownerId, geohash, lat: 40.7128, lng: -74.006 }, nextId('event'));

        await indexModule.notifyNearbyUsers.run(event);
        await indexModule.notifyNearbyUsers.run(event);

        expect(attempts).toBe(1);
        const deliveries = await db.collection('notificationDeliveries').where('spotId', '==', spotId).get();
        expect(deliveries.docs.map(doc => doc.data().status).sort()).toEqual(['failed', 'sent']);
        expect((await db.collection('spotNotifications').where('spotId', '==', spotId).get()).docs).toHaveLength(2);
        await Promise.all([
            ...recipientIds.flatMap(recipientId => [
                db.doc(`userLocations/${recipientId}`).delete(),
                db.doc(`users/${recipientId}/private/preferences`).delete(),
            ]),
            removeCollectionDocs('spotNotifications', 'spotId', spotId),
            removeCollectionDocs('notificationDeliveries', 'spotId', spotId),
        ]);
    });
});
