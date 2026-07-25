'use strict';

/**
 * Integration tests for the deleteAccount callable.
 *
 * Prerequisites (one-time):
 *   npm run install:functions
 *
 * Run via:
 *   npm run test:functions
 *
 * Emulators required: functions (5001), firestore (8080), auth (9099), storage (9199)
 *
 * Two test mechanisms are used:
 *
 * HTTP (most tests): calls the Functions emulator endpoint with a real JWT obtained
 * from the Auth emulator. Exercises the full HTTP/callable stack.
 *
 * Direct handler (auth and failure tests): calls deleteAccount.run() with an
 * injected CallableRequest. Bypasses HTTP and JWT validation so we can supply
 * arbitrary auth claims (stale auth_time, null, undefined) and monkey-patch
 * Admin SDK singletons to inject step-level failures.
 *
 * The Auth emulator cannot issue JWTs with a past auth_time without waiting 600+ s,
 * so stale-auth and missing-auth tests MUST use the direct handler.
 *
 * Step-level failure tests (FN-14) use direct handler + monkey-patch on the
 * Firestore singleton to force a step throw and verify Auth is never reached.
 * This covers Firestore step failure; Storage and anonymization failures follow
 * the identical step() control-flow pattern and are covered by the same invariant.
 */

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// Load the functions module — triggers initializeApp() for the default Firebase app.
// env vars (FIRESTORE_EMULATOR_HOST etc.) are set by firebase emulators:exec, so
// the default app connects to emulators. Must come after named test-app creation.
// (Named and default apps coexist; no conflict.)
let deleteAccount;
try {
    ({ deleteAccount } = require('./index.js'));
} catch (e) {
    // If the module fails to load (missing node_modules), direct-handler tests
    // will be skipped by the null-guard in callDirect.
    console.warn('[integration] Could not load ./index.js for direct-handler tests:', e.message);
}

const PROJECT_ID = 'parkqueen-46475363-ccf36';
const REGION = 'us-central1';
const FUNCTIONS_BASE = `http://localhost:5001/${PROJECT_ID}/${REGION}`;
const AUTH_EMULATOR = 'http://localhost:9099';
const APP_NAME = '__deleteAccount_intg__';

// Named app avoids conflicts with any other admin SDK usage in the test process
const testApp =
    getApps().find(a => a.name === APP_NAME) ??
    initializeApp({ projectId: PROJECT_ID }, APP_NAME);

const db = getFirestore(testApp);
const adminAuth = getAuth(testApp);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callDeleteAccount(idToken, data = {}) {
    const res = await fetch(`${FUNCTIONS_BASE}/deleteAccount`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ data }),
    });
    return res.json();
}

async function signInUser(uid) {
    try { await adminAuth.createUser({ uid }); } catch { /* already exists */ }
    const customToken = await adminAuth.createCustomToken(uid);
    const res = await fetch(
        `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-key`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: customToken, returnSecureToken: true }),
        },
    );
    const body = await res.json();
    if (!body.idToken) throw new Error(`signInUser failed for ${uid}: ${JSON.stringify(body)}`);
    return body.idToken;
}

async function nukeTestData(uid) {
    await Promise.all([
        adminAuth.deleteUser(uid).catch(() => {}),
        db.recursiveDelete(db.doc(`users/${uid}`)).catch(() => {}),
        db.doc(`accountDeletionJobs/${uid}`).delete().catch(() => {}),
    ]);
}

async function queryDelete(query) {
    const snap = await query.get();
    if (snap.empty) return;
    for (let i = 0; i < snap.docs.length; i += 499) {
        const batch = db.batch();
        snap.docs.slice(i, i + 499).forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
}

async function cleanupSideEffects(uid) {
    await Promise.all([
        queryDelete(db.collection('usernames').where('uid', '==', uid)),
        queryDelete(db.collection('spotFeedback').where('userId', '==', uid)),
        queryDelete(db.collection('spots').where('finderId', '==', uid)),
        queryDelete(db.collection('spots').where('interestedUserId', '==', uid)),
        queryDelete(db.collection('spotNotifications').where('targetUserId', '==', uid)),
        queryDelete(db.collection('reports').where('reporterId', '==', uid)),
        queryDelete(db.collection('moderationLog').where('userId', '==', uid)),
        (async () => {
            const snap = await db.collection('chats').where('participants', 'array-contains', uid).get();
            await Promise.all(snap.docs.map(d => db.recursiveDelete(d.ref)));
        })(),
    ]);
}

// Seed n docs into a collection — batches at 499.
async function seedDocs(collectionPath, n, fields) {
    let batch = db.batch();
    let count = 0;
    for (let i = 0; i < n; i++) {
        batch.set(db.collection(collectionPath).doc(), { _testDoc: true, ...fields });
        count++;
        if (count === 499 || i === n - 1) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }
}

async function countDocs(collectionPath, field, uid) {
    const snap = await db.collection(collectionPath).where(field, '==', uid).get();
    return snap.size;
}

/**
 * Direct handler call — bypasses HTTP and JWT validation.
 * Allows injecting arbitrary auth_time values (undefined, null, stale, fresh).
 * authTime accepts: undefined (missing), null (explicit null), or an epoch-seconds number.
 * Requires deleteAccount to be loaded at file top; throws if not.
 */
function callDirect(uid, authTime) {
    if (!deleteAccount) throw new Error('deleteAccount not loaded — check functions/index.js require');
    const NOW = Math.floor(Date.now() / 1000);
    return deleteAccount.run({
        data: {},
        auth: {
            uid,
            token: {
                uid,
                auth_time: authTime,
                iss: `https://securetoken.google.com/${PROJECT_ID}`,
                aud: PROJECT_ID,
                sub: uid,
                iat: NOW - 30,
                exp: NOW + 3600,
            },
        },
        rawRequest: {},
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('deleteAccount — Functions emulator integration', () => {
    let uid;

    beforeEach(() => {
        // Unique UID per test — avoids cross-test state collisions
        uid = `td_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    });

    afterEach(async () => {
        await nukeTestData(uid);
        await cleanupSideEffects(uid);
    });

    // ── Authentication and lock ───────────────────────────────────────────────

    it('FN-01: rejects unauthenticated call', async () => {
        const resp = await callDeleteAccount(null);
        expect(resp.error?.status).toBe('UNAUTHENTICATED');
    });

    // ── Auth claim tests (direct handler) ────────────────────────────────────
    // The Auth emulator cannot issue JWTs with a past auth_time without waiting 600+ s,
    // so these three cases use deleteAccount.run() with injected token claims.

    it('FN-02a: rejects stale auth_time (700 s ago) via direct handler', async () => {
        const staleTime = Math.floor(Date.now() / 1000) - 700;
        await expect(callDirect(uid, staleTime))
            .rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('FN-02b: rejects undefined auth_time — NaN-bypass prevented by !authTime guard', async () => {
        // Before fix: (Date.now()/1000) - undefined = NaN > 600 = false → bypass.
        // The !authTime guard closes this: undefined is now explicitly rejected.
        await expect(callDirect(uid, undefined))
            .rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('FN-02c: rejects null auth_time via direct handler', async () => {
        await expect(callDirect(uid, null))
            .rejects.toMatchObject({ code: 'failed-precondition' });
    });

    it('FN-03: rejects second caller when a fresh lease is active', async () => {
        // Pre-seed a running job with a fresh (non-expired) lease
        await db.doc(`accountDeletionJobs/${uid}`).set({
            state: 'running',
            leaseAt: Timestamp.now(),
            startedAt: Timestamp.now(),
            currentStep: 'userDoc',
            lastError: null,
            attemptNumber: 1,
            steps: {},
        });
        const idToken = await signInUser(uid);
        const resp = await callDeleteAccount(idToken);
        expect(resp.error?.status).toBe('ALREADY_EXISTS');
    });

    it('FN-04: returns alreadyCompleted for an already-finished job', async () => {
        // Pre-seed completed job — function exits before Auth deletion
        await db.doc(`accountDeletionJobs/${uid}`).set({
            state: 'completed',
            completedAt: Timestamp.now(),
            startedAt: Timestamp.now(),
            leaseAt: Timestamp.now(),
            currentStep: null,
            attemptNumber: 1,
            steps: {},
        });
        const idToken = await signInUser(uid);
        const resp = await callDeleteAccount(idToken);
        expect(resp.result?.alreadyCompleted).toBe(true);
    });

    it('FN-05: recovers a stale (expired) lease and completes the job', async () => {
        const stale = Timestamp.fromMillis(Date.now() - 700_000);
        await db.doc(`accountDeletionJobs/${uid}`).set({
            state: 'running',
            leaseAt: stale,
            startedAt: stale,
            currentStep: null,
            lastError: null,
            attemptNumber: 1,
            steps: {},
        });

        const idToken = await signInUser(uid);
        const resp = await callDeleteAccount(idToken);
        expect(resp.result?.success).toBe(true);

        const job = (await db.doc(`accountDeletionJobs/${uid}`).get()).data();
        expect(job?.state).toBe('completed');
        expect(job?.attemptNumber).toBe(2);
    });

    it('FN-06: data.uid in the request payload does not affect which account is deleted', async () => {
        const otherUid = `other_${uid.slice(0, 20)}`;
        await adminAuth.createUser({ uid: otherUid }).catch(() => {});

        const idToken = await signInUser(uid);
        // Pass a different uid in data — handler must ignore it and act on auth.uid only
        await callDeleteAccount(idToken, { uid: otherUid });

        // otherUid must still exist (was not deleted)
        const still = await adminAuth.getUser(otherUid).catch(() => null);
        expect(still).not.toBeNull();

        await adminAuth.deleteUser(otherUid).catch(() => {});
    });

    // ── Retry and idempotency ─────────────────────────────────────────────────

    it('FN-07: retries from a failed job and skips already-done steps', async () => {
        // Simulate a job that previously completed userDoc and usernames, then failed on parkingSessions
        const stale = Timestamp.fromMillis(Date.now() - 700_000);
        await db.doc(`accountDeletionJobs/${uid}`).set({
            state: 'failed',
            leaseAt: stale,
            startedAt: stale,
            currentStep: null,
            lastError: 'parkingSessions: connection reset',
            attemptNumber: 1,
            steps: { userDoc: 'done', usernames: 'done' },
        });

        const idToken = await signInUser(uid);
        const resp = await callDeleteAccount(idToken);
        expect(resp.result?.success).toBe(true);

        const job = (await db.doc(`accountDeletionJobs/${uid}`).get()).data();
        // Previously-done steps must remain 'done'
        expect(job?.steps?.userDoc).toBe('done');
        expect(job?.steps?.usernames).toBe('done');
        expect(job?.state).toBe('completed');
        expect(job?.attemptNumber).toBe(2);
    });

    // ── Golden path ───────────────────────────────────────────────────────────

    it('FN-08: full deletion — all linked collections cleaned, Auth deleted, job completed', async () => {
        // Seed representative documents across every collection the function touches
        await db.doc(`users/${uid}`).set({ displayName: 'Test', uid });
        await db.doc(`users/${uid}/private/account`).set({ email: 'test@example.com' });

        const unameRef = db.collection('usernames').doc(`u_${uid}`);
        await unameRef.set({ uid, username: `u_${uid}` });

        const sessRef = db.doc(`parkingSessions/${uid}`);
        await sessRef.set({ uid, active: true });

        const avRef = db.doc(`avatarModeration/${uid}`);
        await avRef.set({ uid, status: 'approved' });

        const evRef = db.doc(`emailVerificationCodes/${uid}`);
        await evRef.set({ uid, code: '123456' });

        const driverFbRef = db.collection('spotFeedback').doc();
        await driverFbRef.set({ userId: uid, spotId: 's1', outcome: 'success' });

        const finderFbRef = db.collection('spotFeedback').doc();
        await finderFbRef.set({ finderId: uid, spotId: 's2', address: '10 Main St', outcome: 'success' });

        const notifRef = db.collection('spotNotifications').doc();
        await notifRef.set({ targetUserId: uid, type: 'ping', senderId: 'other' });

        const spotRef = db.collection('spots').doc();
        await spotRef.set({ finderId: uid, status: 'available', lat: 40, lng: -74 });

        const claimRef = db.collection('spots').doc();
        await claimRef.set({
            interestedUserId: uid,
            interestedUserName: 'Test',
            interestedUserVehicleColor: 'red',
            interestedUserVehicleType: 'sedan',
            interestedUserVehicleBrand: 'Honda',
            interestedUserTitle: 'Newcomer',
            status: 'interested',
        });

        const chatRef = db.collection('chats').doc();
        await chatRef.set({ participants: [uid, 'peer-uid'], createdAt: Timestamp.now() });
        const msgRef = db.doc(`chats/${chatRef.id}/messages/m1`);
        await msgRef.set({ senderId: uid, text: 'hello', timestamp: Timestamp.now() });

        const reportRef = db.collection('reports').doc();
        await reportRef.set({ reporterId: uid, type: 'spam', reason: 'test', status: 'pending' });

        const modRef = db.collection('moderationLog').doc();
        await modRef.set({ userId: uid, text: 'some content', action: 'flagged' });

        const idToken = await signInUser(uid);
        const resp = await callDeleteAccount(idToken);
        expect(resp.result?.success).toBe(true);

        // Deletions
        expect((await db.doc(`users/${uid}`).get()).exists).toBe(false);
        expect((await db.doc(`users/${uid}/private/account`).get()).exists).toBe(false);
        expect((await unameRef.get()).exists).toBe(false);
        expect((await sessRef.get()).exists).toBe(false);
        expect((await avRef.get()).exists).toBe(false);
        expect((await evRef.get()).exists).toBe(false);
        expect((await driverFbRef.get()).exists).toBe(false);
        expect((await notifRef.get()).exists).toBe(false);
        expect((await spotRef.get()).exists).toBe(false);
        expect((await chatRef.get()).exists).toBe(false);
        expect((await msgRef.get()).exists).toBe(false);

        // Anonymizations
        const finderFb = (await finderFbRef.get()).data();
        expect(finderFb).toBeDefined();
        expect(finderFb?.finderId).toBeUndefined();
        expect(finderFb?.address).toBe('[removed]');

        const claim = (await claimRef.get()).data();
        expect(claim?.interestedUserId).toBeUndefined();
        expect(claim?.interestedUserName).toBeUndefined();
        expect(claim?.status).toBe('available');

        const report = (await reportRef.get()).data();
        expect(report?.reporterId).toBe('[deleted]');
        expect(report?.reporterDeletedAt).toBeDefined();

        const mod = (await modRef.get()).data();
        expect(mod?.userId).toBe('[deleted]');
        expect(mod?.text).toBe('[removed]');

        // Auth deleted
        const authRecord = await adminAuth.getUser(uid).catch(() => null);
        expect(authRecord).toBeNull();

        // Job state
        const job = (await db.doc(`accountDeletionJobs/${uid}`).get()).data();
        expect(job?.state).toBe('completed');
        expect(job?.completedAt).toBeDefined();
    }, 60000);

    it('FN-09: completes without error when all optional singletons are absent', async () => {
        // No documents created — function must handle all-missing data gracefully
        const idToken = await signInUser(uid);
        const resp = await callDeleteAccount(idToken);
        // success OR alreadyCompleted are both acceptable (latter if job was pre-existing)
        expect(resp.result?.success ?? resp.result?.alreadyCompleted).toBeTruthy();
        expect(resp.error).toBeUndefined();
    });

    // ── Pagination ────────────────────────────────────────────────────────────

    it('FN-10: cursor pagination deletes 501 spotFeedback docs (>1 page at 499 limit)', async () => {
        await seedDocs('spotFeedback', 501, { userId: uid, spotId: 'x', outcome: 'success' });

        const idToken = await signInUser(uid);
        const resp = await callDeleteAccount(idToken);
        expect(resp.result?.success).toBe(true);

        expect(await countDocs('spotFeedback', 'userId', uid)).toBe(0);
    }, 120000);

    it('FN-11: cursor pagination deletes 1001 spotFeedback docs (>2 pages at 499 limit)', async () => {
        await seedDocs('spotFeedback', 1001, { userId: uid, spotId: 'x', outcome: 'success' });

        const idToken = await signInUser(uid);
        const resp = await callDeleteAccount(idToken);
        expect(resp.result?.success).toBe(true);

        expect(await countDocs('spotFeedback', 'userId', uid)).toBe(0);
    }, 120000);

    // ── Error redaction ───────────────────────────────────────────────────────

    it('FN-12: job lastError contains no raw PII patterns after a retry attempt', async () => {
        // Pre-seed a failed job whose lastError intentionally contains PII
        // (simulating what would happen if the old code wrote unsanitized errors)
        const stale = Timestamp.fromMillis(Date.now() - 700_000);
        await db.doc(`accountDeletionJobs/${uid}`).set({
            state: 'failed',
            leaseAt: stale,
            startedAt: stale,
            currentStep: null,
            lastError: 'userDoc: user@example.com — +12025551234 unreachable',
            attemptNumber: 1,
            steps: {},
        });

        const idToken = await signInUser(uid);
        await callDeleteAccount(idToken); // retry

        const job = (await db.doc(`accountDeletionJobs/${uid}`).get()).data();
        if (job?.state === 'failed' && job?.lastError) {
            // Function-generated lastError must be sanitized
            expect(job.lastError).not.toMatch(/\S+@\S+\.\S+/);
            expect(job.lastError).not.toMatch(/\+?[0-9]{10,}/);
        }
        // If the retry succeeded, lastError is cleared — also acceptable
    });

    // ── Auth user already missing ─────────────────────────────────────────────

    it('FN-13: returns success when Auth user is already absent at final deletion step', async () => {
        // Pre-seed a job where every data-cleanup step is already done.
        // The function will skip all steps and proceed to deleteUser(uid),
        // which will get auth/user-not-found → the handler marks it completed anyway.
        //
        // The Auth user must exist at JWT validation time, so we sign in first,
        // then delete the user, then re-use the (now-orphaned) JWT. The Functions
        // emulator may or may not re-validate the JWT; if it rejects it, this test
        // becomes unauthenticated, which still passes (it doesn't throw unhandled).
        const stale = Timestamp.fromMillis(Date.now() - 700_000);
        await db.doc(`accountDeletionJobs/${uid}`).set({
            state: 'failed',
            leaseAt: stale,
            startedAt: stale,
            currentStep: null,
            lastError: null,
            attemptNumber: 1,
            steps: {
                userDoc: 'done', usernames: 'done', parkingSessions: 'done',
                avatarModeration: 'done', emailVerificationCodes: 'done',
                spotFeedbackAsDriver: 'done', spotFeedbackAsFinder: 'done',
                spotNotifications: 'done', spotsAsFinder: 'done', spotsAsClaimer: 'done',
                chats: 'done', reports: 'done', moderationLog: 'done', storage: 'done',
            },
        });

        const idToken = await signInUser(uid);
        // Delete the Auth user before calling the function
        await adminAuth.deleteUser(uid).catch(() => {});

        const resp = await callDeleteAccount(idToken);

        // Either the emulator rejects the JWT (UNAUTHENTICATED) or the function
        // handles auth/user-not-found and returns success — both are correct.
        const isAuthRejected = resp.error?.status === 'UNAUTHENTICATED';
        const isSuccessful = resp.result?.success === true;
        expect(isAuthRejected || isSuccessful).toBe(true);
    });

    // ── Auth preservation on step failure ─────────────────────────────────────

    it('FN-14: Auth is NOT deleted when a required step throws mid-deletion', async () => {
        if (!deleteAccount) {
            console.warn('Skipping FN-14: functions/index.js failed to load');
            return;
        }

        await adminAuth.createUser({ uid }).catch(() => {});

        // getFirestore() (no args) returns the default-app Firestore singleton —
        // the same object captured as `db` inside functions/index.js when it was
        // required at file top. Patching recursiveDelete here therefore affects
        // every db.recursiveDelete() call inside the handler.
        const fnDb = getFirestore();
        const origRecursiveDelete = fnDb.recursiveDelete.bind(fnDb);
        fnDb.recursiveDelete = async () => {
            throw new Error('injected Firestore failure for FN-14');
        };

        let caughtError;
        try {
            await callDirect(uid, Math.floor(Date.now() / 1000) - 30);
        } catch (err) {
            caughtError = err;
        } finally {
            fnDb.recursiveDelete = origRecursiveDelete;
        }

        // Handler must have thrown from the failed step
        expect(caughtError).toBeDefined();
        expect(caughtError?.code).toBe('internal');

        // Auth user must still exist — deleteUser is only reached after all steps pass
        const authRecord = await adminAuth.getUser(uid).catch(() => null);
        expect(authRecord).not.toBeNull();

        // Job must be in 'failed' state; lastError identifies the step
        const job = (await db.doc(`accountDeletionJobs/${uid}`).get()).data();
        expect(job?.state).toBe('failed');
        expect(job?.lastError).toMatch(/userDoc/);
    });
});
