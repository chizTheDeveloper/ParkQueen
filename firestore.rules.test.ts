/**
 * Firestore Security Rules tests — ParQueen private activity collections.
 *
 * Run via:
 *   npm run test:rules          (starts emulator automatically, then exits)
 *   npm run test:rules:unit     (assumes emulator already on :8080)
 *
 * Requires Java 11+ and Firebase CLI with the Firestore emulator installed.
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
    Timestamp,
} from 'firebase/firestore';

// ── Test identities ────────────────────────────────────────────────────────────
const OWNER_UID  = 'owner-aaa-111';
const OTHER_UID  = 'other-bbb-222';
const ADMIN_UID  = 'admin-ccc-333';
const THIRD_UID  = 'third-ddd-444';
const PROJECT_ID = 'demo-parkqueen-rules-test';

let testEnv: RulesTestEnvironment;

// ── Contexts ───────────────────────────────────────────────────────────────────
function ownerDb()  { return testEnv.authenticatedContext(OWNER_UID).firestore(); }
function otherDb()  { return testEnv.authenticatedContext(OTHER_UID).firestore(); }
function adminDb()  { return testEnv.authenticatedContext(ADMIN_UID, { role: 'admin' }).firestore(); }
function thirdDb()  { return testEnv.authenticatedContext(THIRD_UID).firestore(); }
function anonDb()   { return testEnv.unauthenticatedContext().firestore(); }

// ── Seed helpers (bypass rules) ────────────────────────────────────────────────
async function seed(col: string, id: string, data: object) {
    await testEnv.withSecurityRulesDisabled(async ctx => {
        await setDoc(doc(ctx.firestore(), col, id), data);
    });
}

// ── Common timestamps ─────────────────────────────────────────────────────────
const FUTURE = Timestamp.fromMillis(Date.now() + 3_600_000);
const PAST   = Timestamp.fromMillis(Date.now() - 3_600_000);

// ── Spot fixtures ──────────────────────────────────────────────────────────────
const occupiedSpot = {
    finderId:    OWNER_UID,
    finderName:  'TestFinder',
    address:     '123 Private St',
    lat:         40.7128,
    lng:         -74.006,
    status:      'occupied',
    pingMode:    'now',
    reportedAt:  PAST,
    expiresAt:   PAST,
};

const availableSpot = {
    finderId:   OWNER_UID,
    finderName: 'TestFinder',
    address:    '456 Public Ave',
    lat:        40.714,
    lng:        -74.01,
    status:     'available',
    pingMode:   'now',
    reportedAt: Timestamp.now(),
    expiresAt:  FUTURE,
};

const interestedSpot = {
    finderId:        OWNER_UID,
    finderName:      'TestFinder',
    address:         '789 Interest Blvd',
    lat:             40.72,
    lng:             -74.0,
    status:          'interested',
    interestedUserId: OTHER_UID,
    pingMode:        'now',
    reportedAt:      Timestamp.now(),
    expiresAt:       FUTURE,
};

const claimedSpot = {
    finderId:          OWNER_UID,
    finderName:        'TestFinder',
    address:           '111 Hold Ave',
    lat:               40.73,
    lng:               -74.01,
    status:            'claimed',
    claimedBy:         OTHER_UID,
    holdRequestStatus: 'accepted',
    pingMode:          'now',
    reportedAt:        Timestamp.now(),
    expiresAt:         FUTURE,
};

// Spot with NO optional fields (no interestedUserId, no claimedBy)
const bareAvailableSpot = {
    finderId:   OWNER_UID,
    address:    '555 Bare St',
    lat:        40.70,
    lng:        -74.02,
    status:     'available',
    reportedAt: Timestamp.now(),
    expiresAt:  FUTURE,
};

// ── Global setup ───────────────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// SPOTS — PRIVATE HISTORY (occupied)
// ═══════════════════════════════════════════════════════════════════════════════
describe('spots — private occupied/history', () => {
    const ID = 'spot-occupied-1';
    beforeEach(async () => { await seed('spots', ID, occupiedSpot); });

    // 1
    it('S1: unauthenticated direct read denied', async () => {
        await assertFails(getDoc(doc(anonDb(), 'spots', ID)));
    });

    // 2
    it('S2: unauthenticated list query denied', async () => {
        await assertFails(getDocs(collection(anonDb(), 'spots')));
    });

    // 3
    it('S3: owner (finderId) direct read succeeds', async () => {
        await assertSucceeds(getDoc(doc(ownerDb(), 'spots', ID)));
    });

    // 4
    it('S4: owner finder-history query (finderId == own uid) succeeds', async () => {
        await assertSucceeds(
            getDocs(query(collection(ownerDb(), 'spots'), where('finderId', '==', OWNER_UID)))
        );
    });

    // 5
    it('S5: different user direct read of occupied spot denied', async () => {
        await assertFails(getDoc(doc(otherDb(), 'spots', ID)));
    });

    // 6
    it('S6: different user query where finderId == owner uid denied', async () => {
        await assertFails(
            getDocs(query(collection(otherDb(), 'spots'), where('finderId', '==', OWNER_UID)))
        );
    });

    // 7
    it('S7: broad unfiltered authenticated list denied', async () => {
        await assertFails(getDocs(collection(ownerDb(), 'spots')));
    });

    // 13
    it('S13: unrelated user cannot read non-public spot', async () => {
        // OTHER_UID is neither finderId, interestedUserId nor claimedBy on an occupied spot
        await seed('spots', 'spot-occ-unrelated', { ...occupiedSpot, finderId: ADMIN_UID });
        await assertFails(getDoc(doc(otherDb(), 'spots', 'spot-occ-unrelated')));
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPOTS — PUBLIC PING FEED (available / interested)
// ═══════════════════════════════════════════════════════════════════════════════
describe('spots — public Ping feed (available/interested)', () => {
    beforeEach(async () => {
        await seed('spots', 'spot-avail',    availableSpot);
        await seed('spots', 'spot-interest', interestedSpot);
        await seed('spots', 'spot-occ',      occupiedSpot);
    });

    // 8
    it('S8: available spot readable by any signed-in user', async () => {
        await assertSucceeds(getDoc(doc(otherDb(), 'spots', 'spot-avail')));
    });

    // 9
    it('S9: interested spot readable by any signed-in user', async () => {
        await assertSucceeds(getDoc(doc(otherDb(), 'spots', 'spot-interest')));
    });

    // 10 — production query shape: status IN [...] AND expiresAt > now
    it('S10: production live-Ping query (status+expiresAt) succeeds and excludes occupied', async () => {
        const snap = await assertSucceeds(
            getDocs(query(
                collection(ownerDb(), 'spots'),
                where('status', 'in', ['available', 'interested']),
                where('expiresAt', '>', Timestamp.now()),
            ))
        );
        const ids = snap.docs.map(d => d.id);
        expect(ids).toContain('spot-avail');
        expect(ids).toContain('spot-interest');
        expect(ids).not.toContain('spot-occ');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPOTS — CLAIM ARMS (interestedUserId / claimedBy)
// ═══════════════════════════════════════════════════════════════════════════════
describe('spots — claimer arms', () => {
    // 11 — claimedBy arm
    it('S11: hold claimer (claimedBy) can read claimed spot', async () => {
        await seed('spots', 'spot-claimed', claimedSpot);
        // OTHER_UID is claimedBy
        await assertSucceeds(getDoc(doc(otherDb(), 'spots', 'spot-claimed')));
    });

    // 12 — interestedUserId arm
    it('S12: interested user (interestedUserId) can read interested spot', async () => {
        await seed('spots', 'spot-int', interestedSpot);
        // OTHER_UID is interestedUserId
        await assertSucceeds(getDoc(doc(otherDb(), 'spots', 'spot-int')));
    });

    it('S12b: third user cannot read occupied spot where they are neither finder nor claimer', async () => {
        const thirdUid = 'third-ddd-444';
        await seed('spots', 'spot-claimed', claimedSpot);
        const thirdDb = testEnv.authenticatedContext(thirdUid).firestore();
        await assertFails(getDoc(doc(thirdDb, 'spots', 'spot-claimed')));
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPOTS — MISSING OPTIONAL FIELDS (no Rules runtime errors)
// ═══════════════════════════════════════════════════════════════════════════════
describe('spots — missing optional fields do not cause errors', () => {
    // 15
    it('S15a: available spot with no interestedUserId or claimedBy is readable (any signed-in)', async () => {
        await seed('spots', 'spot-bare', bareAvailableSpot);
        await assertSucceeds(getDoc(doc(otherDb(), 'spots', 'spot-bare')));
    });

    it('S15b: occupied spot with no interestedUserId or claimedBy — only finder can read', async () => {
        await seed('spots', 'spot-bare-occ', { ...bareAvailableSpot, status: 'occupied', expiresAt: PAST });
        await assertSucceeds(getDoc(doc(ownerDb(), 'spots', 'spot-bare-occ')));
        await assertFails(getDoc(doc(otherDb(), 'spots', 'spot-bare-occ')));
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPOTS — ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
describe('spots — admin access', () => {
    // 14
    it('S14: admin can read any spot regardless of status', async () => {
        await seed('spots', 'spot-occ-admin', { ...occupiedSpot, finderId: OTHER_UID });
        await assertSucceeds(getDoc(doc(adminDb(), 'spots', 'spot-occ-admin')));
    });

    it('S14b: admin can run unfiltered list', async () => {
        await seed('spots', 'spot-avail', availableSpot);
        await seed('spots', 'spot-occ', occupiedSpot);
        await assertSucceeds(getDocs(collection(adminDb(), 'spots')));
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPOTS — SECURITY REGRESSION (original vulnerability closed)
// ═══════════════════════════════════════════════════════════════════════════════
describe('spots — security regression: cross-user history attack denied', () => {
    beforeEach(async () => {
        await seed('spots', 'spot-private', occupiedSpot);  // finderId = OWNER_UID
    });

    it('R1: direct read of another user occupied spot denied', async () => {
        await assertFails(getDoc(doc(otherDb(), 'spots', 'spot-private')));
    });

    it('R2: query where finderId == another UID denied', async () => {
        await assertFails(
            getDocs(query(collection(otherDb(), 'spots'), where('finderId', '==', OWNER_UID)))
        );
    });

    it('R3: unfiltered spots list denied', async () => {
        await assertFails(getDocs(collection(otherDb(), 'spots')));
    });

    it('R4: mixed-status query (available+occupied combined) not possible — status-filtered query excludes occupied', async () => {
        await seed('spots', 'spot-avail', availableSpot);
        // A query for only ['available', 'occupied'] — the occupied entry finderId != reader → rule would deny
        // In practice Firestore denies the whole query if ANY doc could fail the rule.
        // We verify the safe production query shape works and returns only available docs.
        const snap = await assertSucceeds(
            getDocs(query(
                collection(otherDb(), 'spots'),
                where('status', 'in', ['available', 'interested']),
            ))
        );
        const ids = snap.docs.map(d => d.id);
        expect(ids).not.toContain('spot-private');
        expect(ids).toContain('spot-avail');
    });

    it('R5: owner finder-history query still succeeds (not broken)', async () => {
        await assertSucceeds(
            getDocs(query(collection(ownerDb(), 'spots'), where('finderId', '==', OWNER_UID)))
        );
    });

    it('R6: live Ping query still succeeds (not broken)', async () => {
        await seed('spots', 'spot-avail', availableSpot);
        await assertSucceeds(
            getDocs(query(
                collection(ownerDb(), 'spots'),
                where('status', 'in', ['available', 'interested']),
                where('expiresAt', '>', Timestamp.now()),
            ))
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPOT FEEDBACK — private parking confirmations
// ═══════════════════════════════════════════════════════════════════════════════
describe('spotFeedback', () => {
    const FB_ID = 'fb-1';
    const feedbackDoc = {
        userId:    OWNER_UID,
        address:   '321 Parked Lane',
        outcome:   'success',
        createdAt: Timestamp.now(),
    };

    beforeEach(async () => { await seed('spotFeedback', FB_ID, feedbackDoc); });

    // 16
    it('F1: unauthenticated read denied', async () => {
        await assertFails(getDoc(doc(anonDb(), 'spotFeedback', FB_ID)));
    });

    // 17
    it('F2: owner direct read succeeds', async () => {
        await assertSucceeds(getDoc(doc(ownerDb(), 'spotFeedback', FB_ID)));
    });

    // 18
    it('F3: different user direct read denied', async () => {
        await assertFails(getDoc(doc(otherDb(), 'spotFeedback', FB_ID)));
    });

    // 19
    it('F4: owner-filtered list (userId == own uid) succeeds', async () => {
        await assertSucceeds(
            getDocs(query(collection(ownerDb(), 'spotFeedback'), where('userId', '==', OWNER_UID)))
        );
    });

    // 20
    it('F5: broad unfiltered list denied', async () => {
        await assertFails(getDocs(collection(ownerDb(), 'spotFeedback')));
    });

    it('F6: other-user-targeted list denied', async () => {
        await assertFails(
            getDocs(query(collection(otherDb(), 'spotFeedback'), where('userId', '==', OWNER_UID)))
        );
    });

    it('F7: signed-in user can create feedback', async () => {
        await seed('spots', 'feedback-spot', {
            ...interestedSpot,
            status: 'occupied',
        });
        await assertSucceeds(
            setDoc(doc(otherDb(), 'spotFeedback', `feedback-spot_${OTHER_UID}`), {
                spotId:    'feedback-spot',
                userId:    OTHER_UID,
                finderId:  OWNER_UID,
                address:   '999 New St',
                outcome:   'success',
                failureReason: null,
                createdAt: Timestamp.now(),
            })
        );
    });

    it('F8: user cannot forge successful feedback for a spot they did not claim', async () => {
        await seed('spots', 'feedback-spot', {
            ...interestedSpot,
            status: 'occupied',
        });
        await assertFails(
            setDoc(doc(thirdDb(), 'spotFeedback', `feedback-spot_${THIRD_UID}`), {
                spotId: 'feedback-spot',
                userId: THIRD_UID,
                finderId: OWNER_UID,
                address: '999 New St',
                outcome: 'success',
                failureReason: null,
                createdAt: Timestamp.now(),
            })
        );
    });

    it('F9: feedback cannot be overwritten to trigger rewards twice', async () => {
        await assertFails(
            setDoc(doc(ownerDb(), 'spotFeedback', FB_ID), {
                ...feedbackDoc,
                outcome: 'success',
                createdAt: Timestamp.now(),
            })
        );
    });

    it('F10: feedback for a non-occupied spot is rejected', async () => {
        await seed('spots', 'avail-feedback-spot', {
            ...interestedSpot,
            status: 'interested', // not occupied — rule requires status == 'occupied'
        });
        await assertFails(
            setDoc(doc(otherDb(), 'spotFeedback', `avail-feedback-spot_${OTHER_UID}`), {
                spotId:    'avail-feedback-spot',
                userId:    OTHER_UID,
                finderId:  OWNER_UID,
                address:   '999 Not Occupied St',
                outcome:   'success',
                createdAt: Timestamp.now(),
            })
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHATS — participants only
// ═══════════════════════════════════════════════════════════════════════════════
describe('chats and messages — participant isolation', () => {
    const CHAT_ID = `${OTHER_UID}_${OWNER_UID}`;
    const chatData = {
        id: CHAT_ID,
        participants: [OWNER_UID, OTHER_UID],
        participantNames: {
            [OWNER_UID]: 'Owner',
            [OTHER_UID]: 'Other',
        },
        relatedSpotTitle: 'Street Spot',
        lastMessage: 'Conversation started',
        lastMessageTimestamp: Timestamp.now(),
        lastSenderId: OWNER_UID,
    };

    beforeEach(async () => {
        await seed('chats', CHAT_ID, chatData);
        await testEnv.withSecurityRulesDisabled(async ctx => {
            await setDoc(
                doc(ctx.firestore(), 'chats', CHAT_ID, 'messages', 'message-1'),
                { senderId: OWNER_UID, text: 'On my way out', timestamp: Timestamp.now() },
            );
        });
    });

    it('C1: participant can read their chat and messages', async () => {
        await assertSucceeds(getDoc(doc(ownerDb(), 'chats', CHAT_ID)));
        await assertSucceeds(getDocs(collection(ownerDb(), 'chats', CHAT_ID, 'messages')));
    });

    it('C2: non-participant cannot read a chat or its messages', async () => {
        await assertFails(getDoc(doc(thirdDb(), 'chats', CHAT_ID)));
        await assertFails(getDocs(collection(thirdDb(), 'chats', CHAT_ID, 'messages')));
    });

    it('C3: participant query used by the inbox remains allowed', async () => {
        await assertSucceeds(
            getDocs(query(collection(ownerDb(), 'chats'), where('participants', 'array-contains', OWNER_UID)))
        );
    });

    it('C4: non-participant cannot alter another chat', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(
            upd(doc(thirdDb(), 'chats', CHAT_ID), {
                lastMessage: 'spoofed',
                lastMessageTimestamp: Timestamp.now(),
                lastSenderId: THIRD_UID,
            })
        );
    });

    it('C5: message sender must match the authenticated participant', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'chats', CHAT_ID, 'messages'), {
                senderId: OTHER_UID,
                text: 'spoofed',
                timestamp: Timestamp.now(),
            })
        );
    });

    it('C6: participant can send a correctly attributed message', async () => {
        await assertSucceeds(
            addDoc(collection(ownerDb(), 'chats', CHAT_ID, 'messages'), {
                senderId: OWNER_UID,
                text: 'Leaving now',
                timestamp: Timestamp.now(),
            })
        );
    });

    it('C7: participant can delete their chat', async () => {
        const { deleteDoc } = await import('firebase/firestore');
        await assertSucceeds(deleteDoc(doc(ownerDb(), 'chats', CHAT_ID)));
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPOT NOTIFICATIONS — Ping participants only
// ═══════════════════════════════════════════════════════════════════════════════
describe('spotNotifications — participant-bound creation', () => {
    beforeEach(async () => {
        await seed('spots', 'notification-spot', interestedSpot);
    });

    it('N1: finder can notify the active claimer', async () => {
        await assertSucceeds(
            addDoc(collection(ownerDb(), 'spotNotifications'), {
                spotId: 'notification-spot',
                senderId: OWNER_UID,
                targetUserId: OTHER_UID,
                type: 'delayed',
                message: 'Driver needs a few more minutes',
                createdAt: Timestamp.now(),
            })
        );
    });

    it('N2: claimer can notify the finder', async () => {
        await assertSucceeds(
            addDoc(collection(otherDb(), 'spotNotifications'), {
                spotId: 'notification-spot',
                senderId: OTHER_UID,
                targetUserId: OWNER_UID,
                type: 'claimer_cancelled',
                message: 'The other driver canceled',
                createdAt: Timestamp.now(),
            })
        );
    });

    it('N3: unrelated user cannot send a notification for another Ping', async () => {
        await assertFails(
            addDoc(collection(thirdDb(), 'spotNotifications'), {
                spotId: 'notification-spot',
                senderId: THIRD_UID,
                targetUserId: OWNER_UID,
                type: 'handoff_success',
                message: 'spoofed',
                createdAt: Timestamp.now(),
            })
        );
    });

    it('N4: sender cannot impersonate another participant', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'spotNotifications'), {
                spotId: 'notification-spot',
                senderId: OTHER_UID,
                targetUserId: OTHER_UID,
                type: 'delayed',
                message: 'spoofed',
                createdAt: Timestamp.now(),
            })
        );
    });

    it('N5: notification with a timestamp older than 5 minutes is rejected', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'spotNotifications'), {
                spotId: 'notification-spot',
                senderId: OWNER_UID,
                targetUserId: OTHER_UID,
                type: 'delayed',
                message: 'This message is stale',
                createdAt: PAST, // 1 hour ago — outside the 5-minute window
            })
        );
    });

    it('N6: finder cannot send notification to a user who is not the claimer of the Ping', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'spotNotifications'), {
                spotId: 'notification-spot',
                senderId: OWNER_UID,
                targetUserId: THIRD_UID, // not the interestedUserId of this spot (OTHER_UID is)
                type: 'delayed',
                message: 'Wrong target',
                createdAt: Timestamp.now(),
            })
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARKING SESSIONS — path-keyed owner-only
// ═══════════════════════════════════════════════════════════════════════════════
describe('parkingSessions', () => {
    const sessionData = {
        active:    true,
        lat:       40.71,
        lng:       -74.0,
        address:   '42 Session St',
        startedAt: Timestamp.now(),
    };

    beforeEach(async () => {
        await seed('parkingSessions', OWNER_UID, sessionData);
    });

    // 21
    it('P1: owner can read their own session (path-keyed)', async () => {
        await assertSucceeds(getDoc(doc(ownerDb(), 'parkingSessions', OWNER_UID)));
    });

    // 22
    it('P2: different authenticated user cannot read another session', async () => {
        await assertFails(getDoc(doc(otherDb(), 'parkingSessions', OWNER_UID)));
    });

    // 23
    it('P3: unauthenticated user cannot read a session', async () => {
        await assertFails(getDoc(doc(anonDb(), 'parkingSessions', OWNER_UID)));
    });

    // 24 — collection-group / alternate path bypass check
    it('P4: owner can write to their own session path', async () => {
        await assertSucceeds(
            setDoc(doc(ownerDb(), 'parkingSessions', OWNER_UID), { ...sessionData, active: false })
        );
    });

    it('P5: different user cannot write to another session path', async () => {
        await assertFails(
            setDoc(doc(otherDb(), 'parkingSessions', OWNER_UID), { active: false })
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE PROFILE — users/{uid}/private/profile (owner-only demographics)
// ═══════════════════════════════════════════════════════════════════════════════
describe('users/private/profile', () => {
    const privateData = {
        homeArea:   'Brooklyn',
        driverType: 'Daily commuter',
        ageRange:   '25–34',
        gender:     'Female',
    };

    function privateDoc(db: ReturnType<typeof ownerDb>) {
        return doc(db, 'users', OWNER_UID, 'private', 'profile');
    }

    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async ctx => {
            await setDoc(doc(ctx.firestore(), 'users', OWNER_UID, 'private', 'profile'), privateData);
        });
    });

    // 31
    it('PP1: owner can read their own private profile', async () => {
        await assertSucceeds(getDoc(privateDoc(ownerDb())));
    });

    // 32
    it('PP2: owner can write (create/overwrite) their own private profile', async () => {
        await assertSucceeds(setDoc(privateDoc(ownerDb()), { ...privateData, ageRange: '35–44' }));
    });

    // 33
    it('PP3: owner can update their own private profile', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertSucceeds(upd(privateDoc(ownerDb()), { ageRange: '35–44' }));
    });

    // 34
    it('PP4: another authenticated user cannot read private profile', async () => {
        await assertFails(getDoc(doc(otherDb(), 'users', OWNER_UID, 'private', 'profile')));
    });

    // 35
    it('PP5: another authenticated user cannot list the private subcollection', async () => {
        await assertFails(getDocs(collection(otherDb(), 'users', OWNER_UID, 'private')));
    });

    // 36
    it('PP6: another authenticated user cannot write to private profile', async () => {
        await assertFails(
            setDoc(doc(otherDb(), 'users', OWNER_UID, 'private', 'profile'), { gender: 'Male' })
        );
    });

    // 37
    it('PP7: unauthenticated user cannot read private profile', async () => {
        await assertFails(getDoc(doc(anonDb(), 'users', OWNER_UID, 'private', 'profile')));
    });

    // 38
    it('PP8: unauthenticated user cannot write to private profile', async () => {
        await assertFails(
            setDoc(doc(anonDb(), 'users', OWNER_UID, 'private', 'profile'), { gender: 'Male' })
        );
    });

    // 39
    it('PP9: admin can read any private profile', async () => {
        await assertSucceeds(getDoc(doc(adminDb(), 'users', OWNER_UID, 'private', 'profile')));
    });

    // 40
    it('PP10: owner private doc is isolated — other owner cannot read a different user private doc', async () => {
        await testEnv.withSecurityRulesDisabled(async ctx => {
            await setDoc(doc(ctx.firestore(), 'users', OTHER_UID, 'private', 'profile'), { gender: 'Male' });
        });
        await assertFails(getDoc(doc(ownerDb(), 'users', OTHER_UID, 'private', 'profile')));
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC USER DOC DENYLIST — private fields must be rejected on users/{uid}
// ═══════════════════════════════════════════════════════════════════════════════
describe('users/{uid} public doc — private field denylist', () => {
    const publicUserData = {
        fullName: 'Jay Castro',
        username: 'jayc',
        crowns: 0,
        title: 'Newcomer',
        moderationStatus: 'active',
        reportCount: 0,
        blockedUsers: [],
        notificationRadius: 1,
    };

    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async ctx => {
            await setDoc(doc(ctx.firestore(), 'users', OWNER_UID), publicUserData);
        });
    });

    // 41
    it('PD1: owner cannot write dob to users/{uid} via update', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { dob: '1990-01-01' }));
    });

    // 42
    it('PD2: owner cannot write gender to users/{uid} via update', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { gender: 'Female' }));
    });

    // 43
    it('PD3: owner cannot write homeArea to users/{uid} via update', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { homeArea: 'Brooklyn' }));
    });

    // 44
    it('PD4: owner cannot write driverType to users/{uid} via update', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { driverType: 'Daily commuter' }));
    });

    // 45
    it('PD5: owner cannot write ageRange to users/{uid} via update', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { ageRange: '25–34' }));
    });

    // 46
    it('PD6: owner cannot include dob in a create (new user doc)', async () => {
        const tempUid = 'temp-create-test-uid';
        await assertFails(
            setDoc(doc(ownerDb(), 'users', tempUid), { ...publicUserData, dob: '1990-01-01' })
        );
    });

    // 47
    it('PD7: legitimate display-name update still succeeds', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertSucceeds(upd(doc(ownerDb(), 'users', OWNER_UID), { fullName: 'Jay Updated' }));
    });

    // 48 — notificationRadius moved to private/preferences; root write now blocked (TM-04)
    it('PD8: notificationRadius write to root doc is now blocked', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { notificationRadius: 2 }));
    });

    // 49
    it('PD9: owner can create a clean user doc without private fields', async () => {
        // Only public fields — private fields must go to subcollections
        const newUid = 'pd9-clean-create-uid-' + Date.now();
        await assertSucceeds(
            setDoc(
                doc(testEnv.authenticatedContext(newUid).firestore(), 'users', newUid),
                { fullName: 'New User', username: 'newuser', crowns: 0, title: 'Newcomer' }
            )
        );
    });

    // 50
    it('PD10: owner can write allowed private fields to the private subcollection', async () => {
        await assertSucceeds(
            setDoc(
                doc(ownerDb(), 'users', OWNER_UID, 'private', 'profile'),
                { dob: '1990-01-01', gender: 'Female', homeArea: 'Brooklyn' },
                { merge: true } as any
            )
        );
    });

    // 51
    it('PD11: other authenticated user cannot read or write the private profile', async () => {
        await assertFails(getDoc(doc(otherDb(), 'users', OWNER_UID, 'private', 'profile')));
    });

    // 52
    it('PD12: unauthenticated user cannot read or write the private profile', async () => {
        await assertFails(getDoc(doc(anonDb(), 'users', OWNER_UID, 'private', 'profile')));
    });

    // 53
    it('PD13: owner cannot write phone to public users/{uid} via update', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { phone: '+15551234567' }));
    });

    // 54
    it('PD14: owner cannot include phone in public users/{uid} create', async () => {
        const newUid = 'pd14-uid-' + Date.now();
        await assertFails(
            setDoc(
                doc(testEnv.authenticatedContext(newUid).firestore(), 'users', newUid),
                { fullName: 'Test', username: 'testpd14', phone: '+15551234567' }
            )
        );
    });

    // 55
    it('PD15: owner cannot write email to public users/{uid} via update', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { email: 'test@example.com' }));
    });

    // 56
    it('PD16: owner cannot include email in public users/{uid} create', async () => {
        const newUid = 'pd16-uid-' + Date.now();
        await assertFails(
            setDoc(
                doc(testEnv.authenticatedContext(newUid).firestore(), 'users', newUid),
                { fullName: 'Test', username: 'testpd16', email: 'test@example.com' }
            )
        );
    });

    // 57
    it('PD17: owner can read users/{uid}/private/account', async () => {
        await assertSucceeds(getDoc(doc(ownerDb(), 'users', OWNER_UID, 'private', 'account')));
    });

    // 58
    it('PD18: other authenticated user cannot read users/{uid}/private/account', async () => {
        await assertFails(getDoc(doc(otherDb(), 'users', OWNER_UID, 'private', 'account')));
    });

    // 59
    it('PD19: unauthenticated user cannot read users/{uid}/private/account', async () => {
        await assertFails(getDoc(doc(anonDb(), 'users', OWNER_UID, 'private', 'account')));
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TM-11 — users/{uid} update allowlist
// ═══════════════════════════════════════════════════════════════════════════════
describe('users — update allowlist (TM-11)', () => {
    const publicUserData = { fullName: 'Alice', username: 'alice99', fcmToken: 'tok123' };

    beforeEach(async () => {
        await seed('users', OWNER_UID, publicUserData);
    });

    it('TM11-A: owner can update an explicitly allowed field (fullName)', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertSucceeds(upd(doc(ownerDb(), 'users', OWNER_UID), { fullName: 'Alice B.' }));
    });

    it('TM11-B: owner cannot update fcmToken on root doc (moved to private/preferences)', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { fcmToken: 'newtoken' }));
    });

    it('TM11-C: owner cannot update crowns (not in allowlist)', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { crowns: 999 }));
    });

    it('TM11-D: owner cannot update title (not in allowlist)', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { title: 'King' }));
    });

    it('TM11-E: owner cannot write an arbitrary unknown field', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { evilField: true }));
    });

    it('TM11-F: other user cannot update another user\'s profile fields', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(otherDb(), 'users', OWNER_UID), { fullName: 'Hacked' }));
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TM-10 — spots create schema validation
// ═══════════════════════════════════════════════════════════════════════════════
describe('spots — create schema (TM-10)', () => {
    const validSpot = {
        lat: 40.7128,
        lng: -74.0060,
        type: 'free',
        status: 'available',
        finderId: OWNER_UID,
        finderName: 'Alice',
        pingMode: 'now',
        reportedAt: Timestamp.now(),
        expiresAt: FUTURE,
        geohash: 'dr5ru',
        address: '123 Main St, New York, NY',
    };

    it('TM10-A: valid spot create succeeds', async () => {
        await assertSucceeds(addDoc(collection(ownerDb(), 'spots'), validSpot));
    });

    it('TM10-B: create with forged finderId denied', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'spots'), { ...validSpot, finderId: OTHER_UID })
        );
    });

    it('TM10-C: create with non-available status denied', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'spots'), { ...validSpot, status: 'occupied' })
        );
    });

    it('TM10-D: create with non-free type denied', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'spots'), { ...validSpot, type: 'paid' })
        );
    });

    it('TM10-E: create missing required field (address) denied', async () => {
        const { address: _a, ...noAddress } = validSpot;
        await assertFails(addDoc(collection(ownerDb(), 'spots'), noAddress));
    });

    it('TM10-F: create with past expiresAt denied', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'spots'), { ...validSpot, expiresAt: PAST })
        );
    });

    it('TM10-G: create with extra unknown field denied', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'spots'), { ...validSpot, adminOverride: true })
        );
    });

    it('TM10-H: unauthenticated create denied', async () => {
        await assertFails(addDoc(collection(anonDb(), 'spots'), validSpot));
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TM-08 — reports create schema validation
// ═══════════════════════════════════════════════════════════════════════════════
describe('reports — create schema (TM-08)', () => {
    const validReport = {
        reporterId: OWNER_UID,
        reportedUserId: OTHER_UID,
        type: 'behavior',
        reason: 'User was rude.',
        status: 'pending',
        createdAt: Timestamp.now(),
    };

    it('TM08-A: valid report create succeeds', async () => {
        await assertSucceeds(addDoc(collection(ownerDb(), 'reports'), validReport));
    });

    it('TM08-B: report with forged reporterId denied', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'reports'), { ...validReport, reporterId: OTHER_UID })
        );
    });

    it('TM08-C: self-report denied', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'reports'), { ...validReport, reportedUserId: OWNER_UID })
        );
    });

    it('TM08-D: report with invalid type denied', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'reports'), { ...validReport, type: 'made_up' })
        );
    });

    it('TM08-E: report with status other than pending denied', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'reports'), { ...validReport, status: 'resolved' })
        );
    });

    it('TM08-F: report with empty reason denied', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'reports'), { ...validReport, reason: '' })
        );
    });

    it('TM08-G: unauthenticated report create denied', async () => {
        await assertFails(addDoc(collection(anonDb(), 'reports'), validReport));
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TM-07 — listings write disabled
// ═══════════════════════════════════════════════════════════════════════════════
describe('listings — write disabled (TM-07)', () => {
    it('TM07-A: authenticated user cannot create a listing', async () => {
        await assertFails(
            addDoc(collection(ownerDb(), 'listings'), { title: 'My Garage', price: 10 })
        );
    });

    it('TM07-B: authenticated user cannot write to a specific listing', async () => {
        await assertFails(
            setDoc(doc(ownerDb(), 'listings', 'listing-123'), { title: 'Exploit' })
        );
    });

    it('TM07-C: any signed-in user can still read listings', async () => {
        await assertSucceeds(getDocs(collection(ownerDb(), 'listings')));
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TM-09 — parseFailures update field restriction
// ═══════════════════════════════════════════════════════════════════════════════
describe('parseFailures — update allowlist (TM-09)', () => {
    beforeEach(async () => {
        await seed('parseFailures', 'failure-1', { count: 1, lastSeenAt: Timestamp.now() });
    });

    it('TM09-A: signed-in user can increment count and update lastSeenAt', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertSucceeds(
            upd(doc(ownerDb(), 'parseFailures', 'failure-1'), {
                count: 2,
                lastSeenAt: Timestamp.now(),
            })
        );
    });

    it('TM09-B: signed-in user cannot add resolvedAt', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(
            upd(doc(ownerDb(), 'parseFailures', 'failure-1'), {
                count: 2,
                resolvedAt: Timestamp.now(),
            })
        );
    });

    it('TM09-C: signed-in user cannot add arbitrary fields', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(
            upd(doc(ownerDb(), 'parseFailures', 'failure-1'), { injected: true })
        );
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TM-14 — adminBootstrap singleton not client-writable
// ═══════════════════════════════════════════════════════════════════════════════
describe('adminBootstrap — client writes blocked (TM-14)', () => {
    it('TM14-A: unauthenticated cannot write adminBootstrap/singleton', async () => {
        await assertFails(
            setDoc(doc(anonDb(), 'adminBootstrap', 'singleton'), { bootstrappedBy: 'anon' })
        );
    });

    it('TM14-B: authenticated user cannot write adminBootstrap/singleton', async () => {
        await assertFails(
            setDoc(doc(ownerDb(), 'adminBootstrap', 'singleton'), { bootstrappedBy: OWNER_UID })
        );
    });

    it('TM14-C: admin can read adminBootstrap/singleton', async () => {
        await assertSucceeds(getDoc(doc(adminDb(), 'adminBootstrap', 'singleton')));
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TM-04 — Private user data separated from public user document
// ═══════════════════════════════════════════════════════════════════════════════
describe('TM-04 — private user data isolation', () => {
    beforeEach(async () => {
        await seed('users', OWNER_UID, {
            fullName: 'Owner',
            crowns: 0,
            title: 'Newcomer',
            moderationStatus: 'active',
            reportCount: 0,
        });
    });

    it('TM04-A: owner cannot write fcmToken to root users doc', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { fcmToken: 'tok123' }));
    });

    it('TM04-B: owner cannot write blockedUsers to root users doc', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { blockedUsers: [] }));
    });

    it('TM04-C: owner cannot write notificationsEnabled to root users doc', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { notificationsEnabled: true }));
    });

    it('TM04-D: owner cannot write lang to root users doc', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { lang: 'en' }));
    });

    it('TM04-E: owner cannot write lastGeohash to root users doc', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { lastGeohash: 'dr5ru' }));
    });

    it('TM04-F: owner can write and read private/preferences', async () => {
        await assertSucceeds(
            setDoc(doc(ownerDb(), 'users', OWNER_UID, 'private', 'preferences'),
                { notificationRadius: 2, notificationsEnabled: true })
        );
        await assertSucceeds(getDoc(doc(ownerDb(), 'users', OWNER_UID, 'private', 'preferences')));
    });

    it('TM04-G: other user cannot read private/preferences', async () => {
        await assertFails(getDoc(doc(otherDb(), 'users', OWNER_UID, 'private', 'preferences')));
    });

    it('TM04-H: unauthenticated cannot read private/preferences', async () => {
        await assertFails(getDoc(doc(anonDb(), 'users', OWNER_UID, 'private', 'preferences')));
    });

    it('TM04-I: owner can write and read private/social', async () => {
        await assertSucceeds(
            setDoc(doc(ownerDb(), 'users', OWNER_UID, 'private', 'social'), { blockedUsers: [] })
        );
        await assertSucceeds(getDoc(doc(ownerDb(), 'users', OWNER_UID, 'private', 'social')));
    });

    it('TM04-J: other user cannot read private/social', async () => {
        await assertFails(getDoc(doc(otherDb(), 'users', OWNER_UID, 'private', 'social')));
    });

    it('TM04-K: owner can write and read userLocations/{uid}', async () => {
        await assertSucceeds(
            setDoc(doc(ownerDb(), 'userLocations', OWNER_UID), { lastGeohash: 'dr5ru', lastGeohashUpdatedAt: Timestamp.now() })
        );
        await assertSucceeds(getDoc(doc(ownerDb(), 'userLocations', OWNER_UID)));
    });

    it('TM04-L: user cannot write to another user\'s userLocations doc', async () => {
        await assertFails(
            setDoc(doc(otherDb(), 'userLocations', OWNER_UID), { lastGeohash: 'dr5ru', lastGeohashUpdatedAt: Timestamp.now() })
        );
    });

    it('TM04-M: unauthenticated cannot read userLocations', async () => {
        await assertFails(getDoc(doc(anonDb(), 'userLocations', OWNER_UID)));
    });

    it('TM04-N: owner cannot create root doc containing moderationStatus', async () => {
        const { setDoc: sd } = await import('firebase/firestore');
        await assertFails(sd(doc(ownerDb(), 'users', OWNER_UID + '_new'), {
            fullName: 'Test', crowns: 0, title: 'Newcomer', moderationStatus: 'active',
        }));
    });

    it('TM04-O: owner cannot write reportCount to root users doc', async () => {
        const { updateDoc: upd } = await import('firebase/firestore');
        // Use a value different from the seed (0) so affectedKeys() is non-empty
        await assertFails(upd(doc(ownerDb(), 'users', OWNER_UID), { reportCount: 5 }));
    });

    it('TM04-P: owner cannot write to private/account (server-only)', async () => {
        const { setDoc: sd } = await import('firebase/firestore');
        await assertFails(sd(doc(ownerDb(), 'users', OWNER_UID, 'private', 'account'), { moderationStatus: 'active' }));
    });

    it('TM04-Q: private/preferences rejects invalid lang value', async () => {
        await assertFails(
            setDoc(doc(ownerDb(), 'users', OWNER_UID, 'private', 'preferences'), { lang: 'fr' })
        );
    });

    it('TM04-R: private/preferences rejects notificationRadius out of bounds', async () => {
        await assertFails(
            setDoc(doc(ownerDb(), 'users', OWNER_UID, 'private', 'preferences'), { notificationRadius: 200 })
        );
    });

    it('TM04-S: private/preferences rejects extra unknown fields', async () => {
        await assertFails(
            setDoc(doc(ownerDb(), 'users', OWNER_UID, 'private', 'preferences'), { notificationRadius: 1, suspiciousField: 'x' })
        );
    });

    it('TM04-T: private/social rejects extra fields beyond blockedUsers', async () => {
        await assertFails(
            setDoc(doc(ownerDb(), 'users', OWNER_UID, 'private', 'social'), { blockedUsers: [], extraField: true })
        );
    });

    it('TM04-U: userLocations rejects extra fields beyond schema', async () => {
        await assertFails(
            setDoc(doc(ownerDb(), 'userLocations', OWNER_UID), { lastGeohash: 'dr5ru', lastGeohashUpdatedAt: Timestamp.now(), extraField: 'x' })
        );
    });

    it('TM04-V: owner can register a device token', async () => {
        await assertSucceeds(
            setDoc(doc(ownerDb(), 'users', OWNER_UID, 'devices', 'device1'), {
                fcmToken: 'tok_abc', registeredAt: Timestamp.now(),
            })
        );
    });

    it('TM04-W: other user cannot write to owner\'s device documents', async () => {
        await assertFails(
            setDoc(doc(otherDb(), 'users', OWNER_UID, 'devices', 'device1'), {
                fcmToken: 'tok_abc', registeredAt: Timestamp.now(),
            })
        );
    });
});
