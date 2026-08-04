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

    it('PN-1 increments the global Ping count once for duplicate delivery and once for a recreated new ID', async () => {
        const firstSpotId = nextId('count');
        const secondSpotId = nextId('count');
        const statsRef = db.doc('stats/global');
        await statsRef.set({ totalSpotsPinged: 0 }, { merge: true });

        const firstEvent = createdEvent(firstSpotId, { finderId: 'owner_a', geohash: 'dr5r', lat: 40.7, lng: -73.9 });
        await indexModule.incrementTotalSpotsPinged.run(firstEvent);
        await indexModule.incrementTotalSpotsPinged.run(firstEvent);
        await indexModule.incrementTotalSpotsPinged.run(
            createdEvent(secondSpotId, { finderId: 'owner_a', geohash: 'dr5r', lat: 40.7, lng: -73.9 }),
        );

        expect((await statsRef.get()).data().totalSpotsPinged).toBe(2);
        await Promise.all([
            db.doc(`functionEvents/incrementTotalSpotsPinged_${firstSpotId}`).delete(),
            db.doc(`functionEvents/incrementTotalSpotsPinged_${secondSpotId}`).delete(),
        ]);
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

        expect(errors).not.toHaveBeenCalled();
        expect(batches.flat()).toHaveLength(1);
        const bell = await db.doc(`spotNotifications/nearby_${spotId}_${recipientId}`).get();
        expect(bell.data()).toMatchObject({
            spotId,
            senderId: ownerId,
            targetUserId: recipientId,
            claimId: null,
            type: 'nearby_spot',
        });

        await Promise.all([
            db.doc(`userLocations/${recipientId}`).delete(),
            db.doc(`users/${recipientId}/private/preferences`).delete(),
            db.doc(`spotNotifications/nearby_${spotId}_${recipientId}`).delete(),
            db.doc(`notificationDeliveries/nearby_${spotId}_${recipientId}`).delete(),
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
            db.doc(`spotNotifications/nearby_${spotId}_${recipientId}`).delete(),
            db.doc(`notificationDeliveries/nearby_${spotId}_${recipientId}`).delete(),
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
            senderId: ownerId,
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
});
