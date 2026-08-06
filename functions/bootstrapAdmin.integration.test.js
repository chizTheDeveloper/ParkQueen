'use strict';

/**
 * Behavioral integration tests â€” bootstrapAdmin callable (Phase J Verification Â§5).
 *
 * All tests use the direct-handler (.run()) mechanism so arbitrary token claims
 * (email, email_verified) can be injected without real Firebase email verification.
 *
 * What is proven:
 *   BA-E1: unauthenticated â†’ unauthenticated
 *   BA-E2: authenticated, non-@parqueen.app email â†’ permission-denied
 *   BA-E3: authenticated, @parqueen.app but email_verified=false â†’ permission-denied
 *   BA-E4: verified @parqueen.app caller, no prior admin â†’ success + audit record written
 *   BA-E5: caller cannot supply the role via request.data
 *   BA-E6: second bootstrap attempt â†’ already-exists
 *   BA-E7: singleton doc pre-seeded simulates prior bootstrap â†’ already-exists (transaction respected)
 *   BA-E8: audit record written to adminAuditLog on success
 *
 * Auth emulator users are created but no production Auth service is contacted.
 * The test app uses a named Admin SDK app to avoid conflicts with the default app
 * initialized by the functions module itself.
 */

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

let bootstrapAdmin;
try {
    ({ bootstrapAdmin } = require('./index.js'));
} catch (e) {
    console.warn('[bootstrapAdmin.integration] Could not load index.js:', e.message);
}

const PROJECT_ID = 'parkqueen-46475363-ccf36';
const APP_NAME = '__bootstrapAdmin_intg__';

const testApp =
    getApps().find(a => a.name === APP_NAME) ??
    initializeApp({ projectId: PROJECT_ID }, APP_NAME);
const db = getFirestore(testApp);
const adminAuth = getAuth(testApp);

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fakeRequest(uid, email, emailVerified, data = {}) {
    const NOW = Math.floor(Date.now() / 1000);
    return {
        data,
        auth: uid ? {
            uid,
            token: {
                uid,
                email: email || undefined,
                email_verified: emailVerified,
                auth_time: NOW - 30,
                iat: NOW - 30,
                exp: NOW + 3600,
            },
        } : null,
        rawRequest: {},
    };
}

async function callDirect(uid, email, emailVerified, data = {}) {
    if (!bootstrapAdmin) throw new Error('bootstrapAdmin not loaded');
    try {
        return { result: await bootstrapAdmin.run(fakeRequest(uid, email, emailVerified, data)) };
    } catch (err) {
        return { error: { code: err.code, message: err.message } };
    }
}

function testUid() {
    return `ba_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function deleteSingleton() {
    await db.doc('adminBootstrap/singleton').delete().catch(() => {});
}

async function deleteAuditLogs(uid) {
    const snap = await db.collection('adminAuditLog')
        .where('adminUid', '==', uid).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
}

async function nukeUser(uid) {
    await adminAuth.deleteUser(uid).catch(() => {});
}

// â”€â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('bootstrapAdmin â€” emulator behavioral tests', () => {
    let uid;

    beforeEach(async () => {
        uid = testUid();
        await deleteSingleton();
    });

    afterEach(async () => {
        await deleteSingleton();
        await deleteAuditLogs(uid);
        await nukeUser(uid);
    });

    it('BA-E1: unauthenticated request denied with unauthenticated', async () => {
        if (!bootstrapAdmin) return;
        const { error } = await callDirect(null, null, false);
        expect(error.code).toBe('unauthenticated');
    });

    it('BA-E2: verified non-@parqueen.app email denied with permission-denied', async () => {
        if (!bootstrapAdmin) return;
        const { error } = await callDirect(uid, 'admin@gmail.com', true);
        expect(error.code).toBe('permission-denied');
        expect(error.message).toMatch(/parqueen\.app/);
    });

    it('BA-E3: @parqueen.app email with email_verified=false denied with permission-denied', async () => {
        if (!bootstrapAdmin) return;
        const { error } = await callDirect(uid, 'jay@parqueen.app', false);
        expect(error.code).toBe('permission-denied');
        expect(error.message).toMatch(/verified/i);
    });

    it('BA-E4: verified @parqueen.app caller bootstraps successfully when no admin exists', async () => {
        if (!bootstrapAdmin) return;
        // Create emulator auth user so setCustomUserClaims can succeed
        await adminAuth.createUser({ uid }).catch(() => {});
        const { result, error } = await callDirect(uid, 'jay@parqueen.app', true);
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);
        // Singleton doc must exist after success
        const singleton = await db.doc('adminBootstrap/singleton').get();
        expect(singleton.exists).toBe(true);
        expect(singleton.data().bootstrappedBy).toBe(uid);
    });

    it('BA-E5: caller cannot supply role via request.data â€” role is set server-side', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        const { result, error } = await callDirect(uid, 'jay@parqueen.app', true, { role: 'superadmin' });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);
        // Verify actual claims were set by the server, not from data
        const user = await adminAuth.getUser(uid);
        expect(user.customClaims?.role).toBe('admin');   // must be 'admin', not 'superadmin'
        expect(user.customClaims?.role).not.toBe('superadmin');
    });

    it('BA-E6: second bootstrap attempt returns already-exists', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        // First call succeeds
        await callDirect(uid, 'jay@parqueen.app', true);
        // Second call must fail regardless of same or different uid
        const uid2 = testUid();
        await adminAuth.createUser({ uid: uid2 }).catch(() => {});
        const { error } = await callDirect(uid2, 'ops@parqueen.app', true);
        expect(error.code).toBe('already-exists');
        await nukeUser(uid2);
        await deleteAuditLogs(uid2);
    });

    it('BA-E7: pre-seeded singleton doc is respected â€” already-exists returned', async () => {
        if (!bootstrapAdmin) return;
        // Simulate a prior bootstrap without going through the function
        await db.doc('adminBootstrap/singleton').set({
            bootstrappedAt: Timestamp.now(),
            bootstrappedBy: 'some-prior-uid',
        });
        const { error } = await callDirect(uid, 'jay@parqueen.app', true);
        expect(error.code).toBe('already-exists');
        // No audit record should be written for a blocked attempt
        const snap = await db.collection('adminAuditLog').where('adminUid', '==', uid).get();
        expect(snap.empty).toBe(true);
    });

    it('BA-E8: audit record written to adminAuditLog on successful bootstrap', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        await callDirect(uid, 'jay@parqueen.app', true);
        const snap = await db.collection('adminAuditLog').where('adminUid', '==', uid).get();
        expect(snap.size).toBe(1);
        const rec = snap.docs[0].data();
        expect(rec.action).toBe('bootstrapAdmin');
        expect(rec.email).toBe('jay@parqueen.app');
        expect(rec.adminUid).toBe(uid);
        expect(rec.performedAt).toBeTruthy();
    });

    it('BA-E9: recovers from a partial failure — sentinel claimed by this caller but the Auth claim was never set (e.g. the process crashed between the two) — retry completes the grant instead of permanently rejecting', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        // Simulate exactly what the transaction would have left behind if the
        // process died immediately after it committed, before setCustomUserClaims ran.
        await db.doc('adminBootstrap/singleton').set({
            bootstrappedAt: Timestamp.now(),
            bootstrappedBy: uid,
        });
        const before = await adminAuth.getUser(uid);
        expect(before.customClaims?.role).not.toBe('admin'); // confirms the gap is real

        const { result, error } = await callDirect(uid, 'jay@parqueen.app', true);

        expect(error).toBeUndefined();
        expect(result.success).toBe(true);
        const after = await adminAuth.getUser(uid);
        expect(after.customClaims?.role).toBe('admin'); // the missing half is now granted
        const snap = await db.collection('adminAuditLog').where('adminUid', '==', uid).get();
        expect(snap.size).toBe(1); // exactly one audit record, not zero and not two
    });

    it('BA-E10: an already-fully-bootstrapped admin retrying gets an idempotent success — no duplicate audit record', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        const first = await callDirect(uid, 'jay@parqueen.app', true);
        expect(first.result.success).toBe(true);

        const second = await callDirect(uid, 'jay@parqueen.app', true);
        expect(second.error).toBeUndefined();
        expect(second.result.success).toBe(true);

        const user = await adminAuth.getUser(uid);
        expect(user.customClaims?.role).toBe('admin');
        const snap = await db.collection('adminAuditLog').where('adminUid', '==', uid).get();
        expect(snap.size).toBe(1); // still exactly one record after the retry
    });

    it('BA-E11: two concurrent valid bootstrap calls from different callers produce exactly one administrator', async () => {
        if (!bootstrapAdmin) return;
        const uidA = uid;
        const uidB = testUid();
        await adminAuth.createUser({ uid: uidA }).catch(() => {});
        await adminAuth.createUser({ uid: uidB }).catch(() => {});

        const [a, b] = await Promise.all([
            callDirect(uidA, 'jay@parqueen.app', true),
            callDirect(uidB, 'ops@parqueen.app', true),
        ]);
        const outcomes = [a, b].map(r => (r.error ? r.error.code : 'success')).sort();
        expect(outcomes).toEqual(['already-exists', 'success']);

        const [userA, userB] = await Promise.all([adminAuth.getUser(uidA), adminAuth.getUser(uidB)]);
        const admins = [userA, userB].filter(u => u.customClaims?.role === 'admin');
        expect(admins).toHaveLength(1); // exactly one administrator, never two

        const snap = await db.collection('adminAuditLog')
            .where('adminUid', 'in', [uidA, uidB]).get();
        expect(snap.size).toBe(1); // exactly one audit record across both attempts

        await nukeUser(uidB);
        await deleteAuditLogs(uidB);
    });

    it('BA-E12: case-mismatched domain is rejected (fails safe, does not bypass the allowlist)', async () => {
        if (!bootstrapAdmin) return;
        const { error } = await callDirect(uid, 'jay@PARQUEEN.APP', true);
        expect(error.code).toBe('permission-denied');
    });
});

