/**
 * Firestore Security Rules tests for private activity collections.
 *
 * Requires the Firestore emulator:
 *   firebase emulators:start --only firestore
 *
 * Then run:
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs';
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    collection,
    query,
    where,
} from 'firebase/firestore';

// ── Test identities ────────────────────────────────────────────────────────────
const OWNER_UID  = 'owner-aaa-111';
const OTHER_UID  = 'other-bbb-222';
const PROJECT_ID = 'demo-parkqueen-rules-test';

let testEnv: RulesTestEnvironment;

// ── Helpers ────────────────────────────────────────────────────────────────────
function ownerDb()  { return testEnv.authenticatedContext(OWNER_UID).firestore(); }
function otherDb()  { return testEnv.authenticatedContext(OTHER_UID).firestore(); }
function anonDb()   { return testEnv.unauthenticatedContext().firestore(); }

async function seedSpot(spotId: string, data: object) {
    await testEnv.withSecurityRulesDisabled(async ctx => {
        await setDoc(doc(ctx.firestore(), 'spots', spotId), data);
    });
}

async function seedFeedback(feedbackId: string, data: object) {
    await testEnv.withSecurityRulesDisabled(async ctx => {
        await setDoc(doc(ctx.firestore(), 'spotFeedback', feedbackId), data);
    });
}

// ── Setup ──────────────────────────────────────────────────────────────────────
beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: readFileSync('firestore.rules', 'utf8'),
            host:  'localhost',
            port:  8080,
        },
    });
});

afterAll(async () => {
    await testEnv.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
});

// ── spots collection ───────────────────────────────────────────────────────────
describe('spots — private activity (occupied/history)', () => {
    const SPOT_ID = 'spot-private-1';
    const occupiedSpot = {
        finderId:  OWNER_UID,
        address:   '123 Private St',
        status:    'occupied',
        reportedAt: new Date(),
        expiresAt:  new Date(Date.now() + 3_600_000),
    };

    beforeEach(async () => {
        await seedSpot(SPOT_ID, occupiedSpot);
    });

    // 1. Unauthenticated direct read is denied
    it('1. unauthenticated direct read is denied', async () => {
        await assertFails(getDoc(doc(anonDb(), 'spots', SPOT_ID)));
    });

    // 2. Unauthenticated list query is denied
    it('2. unauthenticated list query is denied', async () => {
        await assertFails(getDocs(collection(anonDb(), 'spots')));
    });

    // 3. Owner direct read succeeds (finderId == auth.uid)
    it('3. owner direct read succeeds', async () => {
        await assertSucceeds(getDoc(doc(ownerDb(), 'spots', SPOT_ID)));
    });

    // 4. Owner query filtered to their UID succeeds
    it('4. owner query where finderId == own uid succeeds', async () => {
        await assertSucceeds(
            getDocs(query(collection(ownerDb(), 'spots'), where('finderId', '==', OWNER_UID)))
        );
    });

    // 5. Owner broad query without ownership constraint is denied
    it('5. owner broad unfiltered list query is denied', async () => {
        await assertFails(getDocs(collection(ownerDb(), 'spots')));
    });

    // 6. Authenticated different user direct read of occupied spot is denied
    it('6. different user direct read of occupied spot is denied', async () => {
        await assertFails(getDoc(doc(otherDb(), 'spots', SPOT_ID)));
    });

    // 7. Authenticated different user query for owner's spots is denied
    it('7. different user query where finderId == owner uid is denied', async () => {
        await assertFails(
            getDocs(query(collection(otherDb(), 'spots'), where('finderId', '==', OWNER_UID)))
        );
    });

    // 8. Query targeting another user's UID is denied
    it('8. query requesting another uid is denied', async () => {
        await assertFails(
            getDocs(query(collection(otherDb(), 'spots'), where('finderId', '==', OWNER_UID)))
        );
    });
});

describe('spots — public Ping feed (available/interested)', () => {
    const AVAIL_ID = 'spot-available-1';
    const INT_ID   = 'spot-interested-1';
    const availSpot = {
        finderId:  OWNER_UID,
        address:   '456 Public Ave',
        status:    'available',
        expiresAt: new Date(Date.now() + 3_600_000),
    };
    const interestSpot = {
        finderId:        OWNER_UID,
        interestedUserId: OTHER_UID,
        address:         '789 Interest Blvd',
        status:          'interested',
        expiresAt:       new Date(Date.now() + 3_600_000),
    };

    beforeEach(async () => {
        await seedSpot(AVAIL_ID, availSpot);
        await seedSpot(INT_ID, interestSpot);
    });

    // 9. No alternate route exposes occupied spots — status-filtered queries only return public ones
    it('9. status-filtered query only returns available/interested spots, not occupied', async () => {
        const occupiedId = 'spot-occupied-check';
        await seedSpot(occupiedId, { ...availSpot, status: 'occupied', finderId: OTHER_UID });

        const snap = await assertSucceeds(
            getDocs(query(
                collection(ownerDb(), 'spots'),
                where('status', 'in', ['available', 'interested']),
            ))
        );
        const ids = snap.docs.map(d => d.id);
        expect(ids).toContain(AVAIL_ID);
        expect(ids).toContain(INT_ID);
        expect(ids).not.toContain(occupiedId);
    });

    // 10. Existing Profile Recent Activity query (finderId == own uid) succeeds
    it('10. Profile recent activity query succeeds for owner', async () => {
        await assertSucceeds(
            getDocs(query(collection(ownerDb(), 'spots'), where('finderId', '==', OWNER_UID)))
        );
    });

    // 11. Existing View All Activity query (finderId == own uid) succeeds
    it('11. ActivitiesView query succeeds for owner', async () => {
        await assertSucceeds(
            getDocs(query(collection(ownerDb(), 'spots'), where('finderId', '==', OWNER_UID)))
        );
    });
});

// ── spotFeedback collection ────────────────────────────────────────────────────
describe('spotFeedback — private parking confirmation', () => {
    const FB_ID = 'feedback-private-1';
    const feedbackDoc = {
        userId:    OWNER_UID,
        address:   '321 Parked Lane',
        outcome:   'success',
        createdAt: new Date(),
    };

    beforeEach(async () => {
        await seedFeedback(FB_ID, feedbackDoc);
    });

    // 1. Unauthenticated direct read is denied
    it('1. unauthenticated direct read is denied', async () => {
        await assertFails(getDoc(doc(anonDb(), 'spotFeedback', FB_ID)));
    });

    // 2. Unauthenticated list query is denied
    it('2. unauthenticated list query is denied', async () => {
        await assertFails(getDocs(collection(anonDb(), 'spotFeedback')));
    });

    // 3. Owner direct read succeeds
    it('3. owner direct read succeeds', async () => {
        await assertSucceeds(getDoc(doc(ownerDb(), 'spotFeedback', FB_ID)));
    });

    // 4. Owner query filtered to their UID succeeds
    it('4. owner query where userId == own uid succeeds', async () => {
        await assertSucceeds(
            getDocs(query(collection(ownerDb(), 'spotFeedback'), where('userId', '==', OWNER_UID)))
        );
    });

    // 5. Owner broad unfiltered list query is denied
    it('5. owner broad unfiltered list query is denied', async () => {
        await assertFails(getDocs(collection(ownerDb(), 'spotFeedback')));
    });

    // 6. Different user direct read is denied
    it('6. different user direct read is denied', async () => {
        await assertFails(getDoc(doc(otherDb(), 'spotFeedback', FB_ID)));
    });

    // 7. Different user query for owner feedback is denied
    it('7. different user query where userId == owner uid is denied', async () => {
        await assertFails(
            getDocs(query(collection(otherDb(), 'spotFeedback'), where('userId', '==', OWNER_UID)))
        );
    });

    // 8. Different user query for their own uid returns only their docs
    it('8. user can only query their own spotFeedback', async () => {
        // OTHER_UID has no feedback — query should return empty but be allowed
        await assertSucceeds(
            getDocs(query(collection(otherDb(), 'spotFeedback'), where('userId', '==', OTHER_UID)))
        );
    });

    // 12. Existing create behavior still works (signedIn user can create)
    it('12. signed-in user can create spotFeedback', async () => {
        await assertSucceeds(
            addDoc(collection(ownerDb(), 'spotFeedback'), {
                userId: OWNER_UID,
                address: '999 New St',
                outcome: 'success',
                createdAt: new Date(),
            })
        );
    });
});
