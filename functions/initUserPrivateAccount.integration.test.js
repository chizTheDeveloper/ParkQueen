'use strict';

/**
 * §3 — initUserPrivateAccount trigger integration tests.
 *
 * Verifies that the onDocumentCreated trigger for users/{userId} correctly
 * creates and populates users/{userId}/private/account via the Admin SDK
 * (bypassing the "allow write: if false" rule that blocks all client writes).
 *
 * Run via:  npm run test:functions
 * Emulators required: functions (5001), firestore (8080), auth (9099)
 */

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const PROJECT_ID = 'parkqueen-46475363-ccf36';
const APP_NAME = '__initUserPrivateAccount_intg__';

const testApp =
    getApps().find(a => a.name === APP_NAME) ??
    initializeApp({ projectId: PROJECT_ID }, APP_NAME);

const db = getFirestore(testApp);
const adminAuth = getAuth(testApp);

// ── helpers ──────────────────────────────────────────────────────────────────

async function nukeUser(uid) {
    await Promise.all([
        adminAuth.deleteUser(uid).catch(() => {}),
        db.recursiveDelete(db.doc(`users/${uid}`)).catch(() => {}),
    ]);
}

/** Poll until predicate returns truthy or timeout. */
async function waitFor(predicate, { timeoutMs = 45000, intervalMs = 500 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const result = await predicate();
        if (result) return result;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('waitFor: timed out');
}

async function waitForPrivateAccount(uid) {
    return waitFor(async () => {
        const snap = await db.doc(`users/${uid}/private/account`).get();
        return snap.exists ? snap.data() : null;
    });
}

async function createUserDoc(uid, extra = {}) {
    await db.doc(`users/${uid}`).set({
        id: uid,
        fullName: 'Test User',
        username: `test_${uid}`,
        crowns: 0,
        title: 'Newcomer',
        createdAt: FieldValue.serverTimestamp(),
        ...extra,
    });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('§3 — initUserPrivateAccount trigger', () => {
    const UID_A = 'onboarding_test_a';
    const UID_B = 'onboarding_test_b';

    beforeAll(async () => {
        await Promise.all([nukeUser(UID_A), nukeUser(UID_B)]);
    });

    afterAll(async () => {
        await Promise.all([nukeUser(UID_A), nukeUser(UID_B)]);
    });

    it('(OB-1) creates private/account when user doc is created', async () => {
        await createUserDoc(UID_A);
        const data = await waitForPrivateAccount(UID_A);
        expect(data).toBeTruthy();
    });

    it('(OB-2) sets moderationStatus to "active"', async () => {
        const data = await waitForPrivateAccount(UID_A);
        expect(data.moderationStatus).toBe('active');
    });

    it('(OB-3) sets reportCount to 0', async () => {
        const data = await waitForPrivateAccount(UID_A);
        expect(data.reportCount).toBe(0);
    });

    it('(OB-4) private/account only has expected keys (no leaked fields)', async () => {
        const data = await waitForPrivateAccount(UID_A);
        const keys = Object.keys(data).sort();
        expect(keys).toEqual(['moderationStatus', 'reportCount']);
    });

    it('(OB-5) merge:true preserves a field pre-seeded before trigger fires', async () => {
        const UID_C = 'onboarding_test_c';
        await nukeUser(UID_C);
        try {
            // Pre-seed a field on private/account (Admin SDK can bypass Rules)
            await db.doc(`users/${UID_C}/private/account`).set({ customField: 'preserved' });
            // Now create the user doc → trigger fires with merge: true
            await createUserDoc(UID_C);
            const data = await waitFor(async () => {
                const snap = await db.doc(`users/${UID_C}/private/account`).get();
                const d = snap.exists ? snap.data() : null;
                // Wait until trigger has run (moderationStatus present)
                return d?.moderationStatus ? d : null;
            });
            expect(data.moderationStatus).toBe('active');
            expect(data.customField).toBe('preserved'); // merge:true kept it
        } finally {
            await nukeUser(UID_C);
        }
    });

    it('(OB-6) two users each get their own isolated private/account', async () => {
        await createUserDoc(UID_B);
        const [dataA, dataB] = await Promise.all([
            waitForPrivateAccount(UID_A),
            waitForPrivateAccount(UID_B),
        ]);
        expect(dataA.moderationStatus).toBe('active');
        expect(dataB.moderationStatus).toBe('active');
        // Confirm they are separate documents
        const snapA = await db.doc(`users/${UID_A}/private/account`).get();
        const snapB = await db.doc(`users/${UID_B}/private/account`).get();
        expect(snapA.ref.path).not.toBe(snapB.ref.path);
    });

    it('(OB-7) private/account is a subcollection doc — not on the root user doc', async () => {
        const userSnap = await db.doc(`users/${UID_A}`).get();
        const accountSnap = await db.doc(`users/${UID_A}/private/account`).get();
        expect(userSnap.data()).not.toHaveProperty('moderationStatus');
        expect(accountSnap.data()).toHaveProperty('moderationStatus');
    });

    it('(OB-9) merge:true does not overwrite a pre-seeded email in private/account', async () => {
        const UID_E = 'onboarding_test_e';
        await nukeUser(UID_E);
        try {
            // Simulates verifyEmailOTP having already run before the trigger fires
            await db.doc(`users/${UID_E}/private/account`).set({ email: 'preserved@example.com' });
            await createUserDoc(UID_E);
            const data = await waitFor(async () => {
                const snap = await db.doc(`users/${UID_E}/private/account`).get();
                const d = snap.exists ? snap.data() : null;
                return d?.moderationStatus ? d : null;
            });
            expect(data.moderationStatus).toBe('active');
            expect(data.email).toBe('preserved@example.com');
        } finally {
            await nukeUser(UID_E);
        }
    });

    it('(OB-8) deleting and re-creating user doc re-triggers initialization', async () => {
        const UID_D = 'onboarding_test_d';
        await nukeUser(UID_D);
        try {
            // First creation
            await createUserDoc(UID_D);
            await waitForPrivateAccount(UID_D);

            // Delete everything and recreate
            await db.recursiveDelete(db.doc(`users/${UID_D}`));
            // Brief pause so emulator registers the delete before the re-create
            await new Promise(r => setTimeout(r, 300));
            await createUserDoc(UID_D);

            // Trigger should fire again and restore private/account
            const data = await waitForPrivateAccount(UID_D);
            expect(data.moderationStatus).toBe('active');
            expect(data.reportCount).toBe(0);
        } finally {
            await nukeUser(UID_D);
        }
    });
});
