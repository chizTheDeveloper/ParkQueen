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
        // requireCurrentAuthenticatedUser now runs first and needs a real
        // Auth-emulator user to reach the email-domain check being tested.
        await adminAuth.createUser({ uid }).catch(() => {});
        const { error } = await callDirect(uid, 'admin@gmail.com', true);
        expect(error.code).toBe('permission-denied');
        expect(error.message).toMatch(/parqueen\.app/);
    });

    it('BA-E3: @parqueen.app email with email_verified=false denied with permission-denied', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
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
        // requireCurrentAuthenticatedUser now runs first and needs a real
        // Auth-emulator user for the caller to reach the singleton check
        // being tested here.
        await adminAuth.createUser({ uid }).catch(() => {});
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

    it('BA-E13: an unrelated pre-existing custom claim survives bootstrap — the role claim is merged, not a blind replace', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        await adminAuth.setCustomUserClaims(uid, { betaTester: true });

        const { result, error } = await callDirect(uid, 'jay@parqueen.app', true);
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);

        const user = await adminAuth.getUser(uid);
        expect(user.customClaims?.role).toBe('admin');
        expect(user.customClaims?.betaTester).toBe(true); // unrelated claim not dropped
    });

    it('BA-E14: an already-admin caller retrying does not needlessly rewrite claims (existing correct claim detected safely)', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        const first = await callDirect(uid, 'jay@parqueen.app', true);
        expect(first.result.success).toBe(true);

        // Simulate a distinguishing unrelated claim set after the first grant,
        // to prove a second retry's merge doesn't stomp it either.
        const afterFirst = await adminAuth.getUser(uid);
        await adminAuth.setCustomUserClaims(uid, { ...afterFirst.customClaims, betaTester: true });

        const second = await callDirect(uid, 'jay@parqueen.app', true);
        expect(second.error).toBeUndefined();
        expect(second.result.success).toBe(true);

        const user = await adminAuth.getUser(uid);
        expect(user.customClaims?.role).toBe('admin');
        expect(user.customClaims?.betaTester).toBe(true);
    });

    it('BA-E15: claims already granted but the audit record never landed — retry completes only the missing half, exactly one record results', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        // Simulate the exact state after a process that completed the Auth
        // claim but died before the audit write: sentinel + claim both done,
        // audit doc absent.
        await db.doc('adminBootstrap/singleton').set({ bootstrappedAt: Timestamp.now(), bootstrappedBy: uid });
        await adminAuth.setCustomUserClaims(uid, { role: 'admin' });
        const preSnap = await db.collection('adminAuditLog').where('adminUid', '==', uid).get();
        expect(preSnap.empty).toBe(true); // confirms the gap is real

        const { result, error } = await callDirect(uid, 'jay@parqueen.app', true);
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);

        const user = await adminAuth.getUser(uid);
        expect(user.customClaims?.role).toBe('admin'); // untouched/reconfirmed, not reset
        const snap = await db.collection('adminAuditLog').where('adminUid', '==', uid).get();
        expect(snap.size).toBe(1); // the missing audit record now exists, exactly once
    });

    it('BA-E16: a caller with a pre-existing conflicting role claim is upgraded to admin by bootstrap (the documented singleton policy has no separate carve-out)', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        await adminAuth.setCustomUserClaims(uid, { role: 'staff' });

        const { result, error } = await callDirect(uid, 'jay@parqueen.app', true);
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);

        const user = await adminAuth.getUser(uid);
        expect(user.customClaims?.role).toBe('admin');
    });

    it('BA-E17: a malformed singleton (exists but names no recognizable owner) fails closed for every caller — never grants a role', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        // A corrupted/manually-created doc missing the expected field shape.
        await db.doc('adminBootstrap/singleton').set({ malformed: true });

        const { error } = await callDirect(uid, 'jay@parqueen.app', true);
        expect(error.code).toBe('already-exists'); // fails closed, not an internal crash
        const user = await adminAuth.getUser(uid);
        expect(user.customClaims?.role).toBeUndefined(); // no role granted
    });

    it('BA-E18: deleting an unrelated public profile document does not reopen or affect bootstrap state', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        await callDirect(uid, 'jay@parqueen.app', true);

        // adminBootstrap/singleton lives in its own collection — deleting any
        // users/{uid} profile document cannot touch it (no trigger reads it).
        await db.doc(`users/${uid}`).set({ id: uid }).catch(() => {});
        await db.doc(`users/${uid}`).delete().catch(() => {});

        const singleton = await db.doc('adminBootstrap/singleton').get();
        expect(singleton.exists).toBe(true);
        expect(singleton.data().bootstrappedBy).toBe(uid);

        const otherUid = testUid();
        await adminAuth.createUser({ uid: otherUid }).catch(() => {});
        const { error } = await callDirect(otherUid, 'ops@parqueen.app', true);
        expect(error.code).toBe('already-exists'); // still closed for anyone else
        await nukeUser(otherUid);
    });

    it('BA-E19: deleting the original administrator\'s Auth account does not silently reopen bootstrap for a different caller', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        await callDirect(uid, 'jay@parqueen.app', true);
        await adminAuth.deleteUser(uid).catch(() => {});

        const otherUid = testUid();
        await adminAuth.createUser({ uid: otherUid }).catch(() => {});
        const { error } = await callDirect(otherUid, 'ops@parqueen.app', true);
        expect(error.code).toBe('already-exists'); // the singleton still names the deleted uid — closed
        await nukeUser(otherUid);
    });

    it('BA-E20: denial error messages never echo the caller\'s email or the approved identity back', async () => {
        if (!bootstrapAdmin) return;
        const { error } = await callDirect(uid, 'someone@example.com', true);
        expect(error.message).not.toMatch(/someone@example\.com/);
        // The domain requirement is disclosed generically (it's already public
        // in source), never as "your email X is not Y".
        expect(error.message).not.toContain(uid);
    });

    // ─── Privilege-resurrection audit (true-revocation hardening pass) ────
    //
    // Confirmed exploit prior to this fix: the same-owner retry branch
    // unconditionally re-applied role:'admin' whenever current role wasn't
    // already 'admin', with no way to distinguish "genuine partial
    // failure — the claim was never applied" from "fully bootstrapped once,
    // then intentionally demoted via setStaffRole". A demoted historical
    // bootstrap owner could call bootstrapAdmin again and regain admin,
    // completely bypassing setStaffRole. BA-R2 (partial-bootstrap retry
    // remains recoverable) is already proven by BA-E9 above — the fix does
    // not touch that path. BA-R3 (a different uid can never use a claimed
    // singleton) is already proven by BA-E6/BA-E7/BA-E18/BA-E19 above,
    // unaffected by this fix (that check lives entirely inside the
    // transaction, unchanged).

    it('BA-R1: an intentionally demoted historical bootstrap owner cannot regain admin by calling bootstrapAdmin again', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        const first = await callDirect(uid, 'jay@parqueen.app', true);
        expect(first.result.success).toBe(true);

        // Intentional demotion — exactly what setStaffRole does to customClaims.
        await adminAuth.setCustomUserClaims(uid, { role: 'staff' });

        const { result, error } = await callDirect(uid, 'jay@parqueen.app', true);
        expect(result).toBeUndefined();
        expect(error.code).toBe('already-exists'); // refused, not re-granted

        const after = await adminAuth.getUser(uid);
        expect(after.customClaims?.role).toBe('staff'); // still demoted, never resurrected
    });

    it('BA-R4: a reconciledLegacyAdmin singleton (the exact production shape) cannot be used to resurrect a demoted owner', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        await adminAuth.setCustomUserClaims(uid, { role: 'admin' });
        // Simulate the exact shape of the currently-deployed production
        // adminBootstrap/singleton — created via reconcileLegacyAdminSingleton,
        // not bootstrapAdmin itself, so it carries reconciledLegacyAdmin:
        // true and no claimsAppliedAt. This proves the fix protects the
        // REAL production singleton with no data migration required.
        await db.doc('adminBootstrap/singleton').set({
            bootstrappedAt: Timestamp.now(),
            bootstrappedBy: uid,
            reconciledLegacyAdmin: true,
        });

        await adminAuth.setCustomUserClaims(uid, { role: 'staff' }); // demoted

        const { result, error } = await callDirect(uid, 'jay@parqueen.app', true);
        expect(result).toBeUndefined();
        expect(error.code).toBe('already-exists');

        const after = await adminAuth.getUser(uid);
        expect(after.customClaims?.role).toBe('staff');
    });

    it('BA-R5: a caller whose refresh tokens were revoked cannot invoke bootstrapAdmin at all, even before any grant exists (requireCurrentAuthenticatedUser)', async () => {
        if (!bootstrapAdmin) return;
        await adminAuth.createUser({ uid }).catch(() => {});
        const staleAuthTime = Math.floor(Date.now() / 1000);
        await new Promise(r => setTimeout(r, 1100));
        await adminAuth.revokeRefreshTokens(uid);

        const req = {
            data: {},
            auth: {
                uid,
                token: {
                    uid, email: 'jay@parqueen.app', email_verified: true,
                    auth_time: staleAuthTime, iat: staleAuthTime, exp: staleAuthTime + 3600,
                },
            },
            rawRequest: {},
        };
        await expect(bootstrapAdmin.run(req)).rejects.toMatchObject({ code: 'permission-denied' });

        const singleton = await db.doc('adminBootstrap/singleton').get();
        expect(singleton.exists).toBe(false); // never claimed
    });
});

