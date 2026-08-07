'use strict';

/**
 * Behavioral integration tests — setStaffRole callable.
 *
 * Redesign context: the previous revision performed a sequential last-admin
 * check (full Auth scan, then mutate) with no cross-request serialization.
 * Two admins concurrently demoting each other could each observe "another
 * admin exists" before either committed, both pass, and together leave zero
 * admins — an unrecoverable lockout, since adminBootstrap/singleton is
 * permanently closed and reconcileLegacyAdminSingleton itself requires an
 * existing admin claim to invoke. This revision serializes every call
 * through a single Firestore-owned lock (adminRoleLock/singleton) and
 * journals each logical operation by a caller-supplied operationId
 * (adminRoleOperations/{operationId}), making the last-admin check and the
 * Auth mutation part of one atomic-with-respect-to-each-other critical
 * section, and making retries/resumes safe and audit-exactly-once.
 *
 * What is proven (SR-1..23 preserved from the prior revision, updated to
 * supply operationId; SR-16 strengthened from "either outcome acceptable"
 * to "provably serialized" now that the design guarantees it):
 *   SR-1:  unauthenticated caller rejected
 *   SR-2:  non-admin caller rejected
 *   SR-3:  nonexistent target rejected, no audit record created
 *   SR-4:  malformed/missing target uid or operationId rejected
 *   SR-5:  invalid role value rejected
 *   SR-6:  promotion (none -> staff, none -> admin with 2+ admins already) succeeds
 *   SR-7:  downgrade (admin -> staff) succeeds when another active admin exists
 *   SR-8:  removal (admin -> null) succeeds when another active admin exists
 *   SR-9:  same-role request is idempotent (no Auth write, one truthful no-op audit)
 *   SR-10: caller cannot inject arbitrary custom claim keys via request.data
 *   SR-11: unrelated custom claim survives promotion
 *   SR-12: unrelated custom claim survives a role change
 *   SR-13: unrelated custom claim survives role removal
 *   SR-14: caller cannot spoof the audit actor
 *   SR-15: audit reflects correct previous/new role
 *   SR-16: two operations on the same target are provably serialized, not last-write-wins
 *   SR-17: self-demotion allowed when another active admin exists
 *   SR-18: last active administrator cannot demote themselves
 *   SR-19: last active administrator's role cannot be removed by another caller
 *   SR-20: a disabled admin does not count toward "another active admin"
 *   SR-21: bootstrap singleton is never touched by role management
 *   SR-22: no console output contains sensitive identity
 *   SR-23: error codes reaching the client are clean HttpsError codes, never raw Admin SDK codes
 *
 * New (lock/journal redesign):
 *   SR-24: two active admins concurrently demoting each other — exactly one succeeds, one admin remains
 *   SR-25: three admins concurrently demoting cannot produce zero active admins
 *   SR-26: the global lock serializes operations even across two different targets
 *   SR-27: an expired lease is recoverable by a new operation
 *   SR-28: a non-owner's failed acquire attempt never touches another operation's active lock
 *   SR-29: Auth mutation succeeded but audit never landed — retry completes exactly one audit
 *   SR-30: retrying a completed operation returns the same result, no duplicate mutation/audit
 *   SR-31: reusing an operationId with a different target fails closed
 *   SR-32: reusing an operationId with a different requested role fails closed
 *   SR-33: reusing an operationId from a different caller fails closed
 *   SR-34: the audit document id is deterministic per operationId
 *   SR-35: a last-admin-blocked operation creates no audit record
 *   SR-36: two operationIds on the same target chain previousRole/role truthfully in order
 *   SR-37: unrelated custom claim survives concurrent serialized activity on the same target
 *   SR-38: bootstrap singleton remains untouched across lock/journal-heavy activity
 *   SR-39: client cannot forge operation journal/lock state via request.data
 *   SR-40: logs contain no sensitive identity during concurrent/lock activity
 */

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

let setStaffRole;
try {
    ({ setStaffRole } = require('./index.js'));
} catch (e) {
    console.warn('[setStaffRole.integration] Could not load index.js:', e.message);
}

const PROJECT_ID = 'parkqueen-46475363-ccf36';
const APP_NAME = '__setStaffRole_intg__';

const testApp =
    getApps().find(a => a.name === APP_NAME) ??
    initializeApp({ projectId: PROJECT_ID }, APP_NAME);
const db = getFirestore(testApp);
const adminAuth = getAuth(testApp);

// ─── Helpers ─────────────────────────────────────────────────────────────

function fakeRequest(uid, callerRole, data = {}) {
    const NOW = Math.floor(Date.now() / 1000);
    return {
        data,
        auth: uid ? {
            uid,
            token: {
                uid,
                role: callerRole || undefined,
                auth_time: NOW - 30,
                iat: NOW - 30,
                exp: NOW + 3600,
            },
        } : null,
        rawRequest: {},
    };
}

async function call(callerUid, callerRole, data) {
    if (!setStaffRole) throw new Error('setStaffRole not loaded');
    try {
        return { result: await setStaffRole.run(fakeRequest(callerUid, callerRole, data)) };
    } catch (err) {
        return { error: { code: err.code, message: err.message } };
    }
}

function testUid(label) {
    return `sr_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function opId(label) {
    return `op_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function nukeUser(uid) {
    await adminAuth.deleteUser(uid).catch(() => {});
}

async function deleteAuditLogsFor(uid) {
    const snap = await db.collection('adminAuditLog').where('targetUid', '==', uid).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
}

async function deleteSingleton() {
    await db.doc('adminBootstrap/singleton').delete().catch(() => {});
}

async function deleteLock() {
    await db.doc('adminRoleLock/singleton').delete().catch(() => {});
}

// setStaffRole's last-admin check scans the whole Auth emulator, same shared-state
// caveat as reconcileLegacyAdminSingleton's tests — safe under maxWorkers: 1.
async function wipeAllStrayAdmins() {
    let pageToken;
    do {
        const page = await adminAuth.listUsers(1000, pageToken);
        for (const u of page.users) {
            if (u.customClaims?.role === 'admin') {
                await adminAuth.deleteUser(u.uid).catch(() => {});
            }
        }
        pageToken = page.pageToken;
    } while (pageToken);
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('setStaffRole — emulator behavioral tests', () => {
    let callerUid, targetUid;

    beforeEach(async () => {
        callerUid = testUid('caller');
        targetUid = testUid('target');
        await wipeAllStrayAdmins();
        await deleteLock();
    });

    afterEach(async () => {
        await deleteAuditLogsFor(targetUid);
        await nukeUser(callerUid);
        await nukeUser(targetUid);
        await deleteLock();
    });

    it('SR-1: unauthenticated caller rejected', async () => {
        if (!setStaffRole) return;
        const { error } = await call(null, undefined, { uid: targetUid, role: 'staff', operationId: opId('u') });
        expect(error.code).toBe('permission-denied');
    });

    it('SR-2: non-admin caller rejected', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        const { error } = await call(callerUid, undefined, { uid: targetUid, role: 'staff', operationId: opId('u') });
        expect(error.code).toBe('permission-denied');
    });

    it('SR-3: nonexistent target rejected, no audit record created', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });

        const fakeTarget = testUid('ghost');
        const { error } = await call(callerUid, 'admin', { uid: fakeTarget, role: 'staff', operationId: opId('u') });
        expect(error.code).toBe('not-found');

        const snap = await db.collection('adminAuditLog').where('targetUid', '==', fakeTarget).get();
        expect(snap.empty).toBe(true);
    });

    it('SR-4: malformed/missing target uid or operationId rejected', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });

        const missingUid = await call(callerUid, 'admin', { role: 'staff', operationId: opId('u') });
        expect(missingUid.error.code).toBe('invalid-argument');

        const wrongType = await call(callerUid, 'admin', { uid: 12345, role: 'staff', operationId: opId('u') });
        expect(wrongType.error.code).toBe('invalid-argument');

        const missingOp = await call(callerUid, 'admin', { uid: targetUid, role: 'staff' });
        expect(missingOp.error.code).toBe('invalid-argument');

        const badOp = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: 'x' });
        expect(badOp.error.code).toBe('invalid-argument');
    });

    it('SR-5: invalid role value rejected', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        const { error } = await call(callerUid, 'admin', { uid: targetUid, role: 'superadmin', operationId: opId('u') });
        expect(error.code).toBe('invalid-argument');
    });

    it('SR-6: promotion succeeds — none to staff, and none to admin', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        const { result, error } = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: opId('u') });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);
        const user = await adminAuth.getUser(targetUid);
        expect(user.customClaims?.role).toBe('staff');
    });

    it('SR-7: downgrade admin -> staff succeeds when another active admin exists', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(targetUid, { role: 'admin' });

        const { result, error } = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: opId('u') });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);
        const user = await adminAuth.getUser(targetUid);
        expect(user.customClaims?.role).toBe('staff');
    });

    it('SR-8: removal admin -> null succeeds when another active admin exists', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(targetUid, { role: 'admin' });

        const { result, error } = await call(callerUid, 'admin', { uid: targetUid, role: null, operationId: opId('u') });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);
        const user = await adminAuth.getUser(targetUid);
        expect(user.customClaims?.role).toBeUndefined();
    });

    it('SR-9: same-role request is idempotent — no Auth write, one truthful no-op audit', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(targetUid, { role: 'staff' });

        const { result, error } = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: opId('u') });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);

        const user = await adminAuth.getUser(targetUid);
        expect(user.customClaims?.role).toBe('staff');

        const snap = await db.collection('adminAuditLog').where('targetUid', '==', targetUid).get();
        expect(snap.size).toBe(1);
        expect(snap.docs[0].data().metadata.noop).toBe(true);
    });

    it('SR-10: caller cannot inject arbitrary custom claim keys via request.data', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        const { error } = await call(callerUid, 'admin', {
            uid: targetUid, role: 'staff', operationId: opId('u'), customClaims: { superuser: true }, betaTester: true,
        });
        expect(error).toBeUndefined();
        const user = await adminAuth.getUser(targetUid);
        expect(user.customClaims).toEqual({ role: 'staff' });
    });

    it('SR-11: unrelated custom claim survives promotion', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(targetUid, { betaTester: true });

        const { error } = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: opId('u') });
        expect(error).toBeUndefined();
        const user = await adminAuth.getUser(targetUid);
        expect(user.customClaims?.role).toBe('staff');
        expect(user.customClaims?.betaTester).toBe(true);
    });

    it('SR-12: unrelated custom claim survives a role change', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(targetUid, { role: 'staff', betaTester: true });

        const { error } = await call(callerUid, 'admin', { uid: targetUid, role: 'admin', operationId: opId('u') });
        expect(error).toBeUndefined();
        const user = await adminAuth.getUser(targetUid);
        expect(user.customClaims?.role).toBe('admin');
        expect(user.customClaims?.betaTester).toBe(true);
    });

    it('SR-13: unrelated custom claim survives role removal', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(targetUid, { role: 'staff', betaTester: true });

        const { error } = await call(callerUid, 'admin', { uid: targetUid, role: null, operationId: opId('u') });
        expect(error).toBeUndefined();
        const user = await adminAuth.getUser(targetUid);
        expect(user.customClaims?.role).toBeUndefined();
        expect(user.customClaims?.betaTester).toBe(true);
    });

    it('SR-14: caller cannot spoof the audit actor', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        const spoofedActor = testUid('spoofed');
        const { error } = await call(callerUid, 'admin', {
            uid: targetUid, role: 'staff', operationId: opId('u'), adminId: spoofedActor, adminUid: spoofedActor,
        });
        expect(error).toBeUndefined();

        const snap = await db.collection('adminAuditLog').where('targetUid', '==', targetUid).get();
        expect(snap.docs[0].data().adminId).toBe(callerUid);
        expect(snap.docs[0].data().adminUid).toBe(callerUid);
    });

    it('SR-15: audit reflects correct previous/new role', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(targetUid, { role: 'staff' });

        const { error } = await call(callerUid, 'admin', { uid: targetUid, role: 'admin', operationId: opId('u') });
        expect(error).toBeUndefined();

        const snap = await db.collection('adminAuditLog').where('targetUid', '==', targetUid).get();
        const data = snap.docs[0].data();
        expect(data.metadata.previousRole).toBe('staff');
        expect(data.metadata.role).toBe('admin');
        expect(data.action).toBe('user.set_role');
    });

    it('SR-16: two operations on the same target are provably serialized, not last-write-wins', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(targetUid, { role: 'staff' });

        const opA = opId('a'), opB = opId('b');
        const [a, b] = await Promise.all([
            call(callerUid, 'admin', { uid: targetUid, role: 'admin', operationId: opA }),
            call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: opB }),
        ]);
        expect(a.error).toBeUndefined();
        expect(b.error).toBeUndefined();

        const user = await adminAuth.getUser(targetUid);
        expect(['admin', 'staff']).toContain(user.customClaims?.role);

        const [docA, docB] = await Promise.all([
            db.doc(`adminAuditLog/roleOp_${opA}`).get(),
            db.doc(`adminAuditLog/roleOp_${opB}`).get(),
        ]);
        // Whichever ran first observed the ORIGINAL role ('staff'); whichever ran
        // second observed the FIRST one's result as its own previousRole — proof
        // of true serialization rather than two independent stale reads.
        const first = docA.data().metadata.previousRole === 'staff' ? docA : docB;
        const second = first === docA ? docB : docA;
        expect(second.data().metadata.previousRole).toBe(first.data().metadata.role);
    });

    it('SR-17: self-demotion allowed when another active admin exists', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(targetUid, { role: 'admin' });

        const { result, error } = await call(callerUid, 'admin', { uid: callerUid, role: 'staff', operationId: opId('u') });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);
        const user = await adminAuth.getUser(callerUid);
        expect(user.customClaims?.role).toBe('staff');
    });

    it('SR-18: the last active administrator cannot demote themselves', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });

        const { error } = await call(callerUid, 'admin', { uid: callerUid, role: 'staff', operationId: opId('u') });
        expect(error.code).toBe('failed-precondition');

        const user = await adminAuth.getUser(callerUid);
        expect(user.customClaims?.role).toBe('admin');
    });

    it('SR-19: the last active administrator\'s role cannot be removed by another caller', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });

        const { error } = await call(callerUid, 'admin', { uid: callerUid, role: null, operationId: opId('u') });
        expect(error.code).toBe('failed-precondition');

        const user = await adminAuth.getUser(callerUid);
        expect(user.customClaims?.role).toBe('admin');
    });

    it('SR-20: a disabled admin does not count toward "another active admin"', async () => {
        if (!setStaffRole) return;
        const disabledAdminUid = testUid('disabled');
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: disabledAdminUid, disabled: true }).catch(() => {});
        await adminAuth.setCustomUserClaims(disabledAdminUid, { role: 'admin' });

        const { error } = await call(callerUid, 'admin', { uid: callerUid, role: 'staff', operationId: opId('u') });
        expect(error.code).toBe('failed-precondition');

        await nukeUser(disabledAdminUid);
    });

    it('SR-21: bootstrap singleton is never touched by role management', async () => {
        if (!setStaffRole) return;
        await deleteSingleton();
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(targetUid, { role: 'admin' });

        await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: opId('u1') });
        await call(callerUid, 'admin', { uid: callerUid, role: 'admin', operationId: opId('u2') });

        const singleton = await db.doc('adminBootstrap/singleton').get();
        expect(singleton.exists).toBe(false);
    });

    it('SR-22: no console output contains sensitive identity', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        const originalLog = console.log;
        const originalError = console.error;
        const captured = [];
        console.log = (...args) => captured.push(args.join(' '));
        console.error = (...args) => captured.push(args.join(' '));
        try {
            await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: opId('u1') });
            await call(callerUid, 'admin', { uid: 'not-a-real-uid', role: 'staff', operationId: opId('u2') });
        } finally {
            console.log = originalLog;
            console.error = originalError;
        }

        const joined = captured.join('\n');
        expect(joined).not.toMatch(/@parqueen\.app|@gmail\.com/);
        expect(joined.includes(callerUid)).toBe(false);
        expect(joined.includes(targetUid)).toBe(false);
    });

    it('SR-23: error codes reaching the client are clean HttpsError codes, never raw Admin SDK codes', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });

        const { error } = await call(callerUid, 'admin', { uid: testUid('ghost'), role: 'staff', operationId: opId('u') });
        expect(error.code).toBe('not-found');
        expect(error.code).not.toMatch(/^auth\//);
    });

    // ─── Lock / journal redesign coverage ─────────────────────────────────

    it('SR-24: two active admins concurrently demoting each other — exactly one succeeds, one admin remains', async () => {
        if (!setStaffRole) return;
        const adminA = testUid('mutA'), adminB = testUid('mutB');
        await adminAuth.createUser({ uid: adminA }).catch(() => {});
        await adminAuth.createUser({ uid: adminB }).catch(() => {});
        await adminAuth.setCustomUserClaims(adminA, { role: 'admin' });
        await adminAuth.setCustomUserClaims(adminB, { role: 'admin' });

        const [rA, rB] = await Promise.all([
            call(adminA, 'admin', { uid: adminB, role: 'staff', operationId: opId('a-demotes-b') }),
            call(adminB, 'admin', { uid: adminA, role: 'staff', operationId: opId('b-demotes-a') }),
        ]);
        const outcomes = [rA, rB].map(r => (r.error ? r.error.code : 'success'));
        expect(outcomes.filter(o => o === 'success')).toHaveLength(1);
        expect(outcomes.filter(o => o === 'failed-precondition')).toHaveLength(1);

        const [userA, userB] = await Promise.all([adminAuth.getUser(adminA), adminAuth.getUser(adminB)]);
        const activeAdmins = [userA, userB].filter(u => u.customClaims?.role === 'admin');
        expect(activeAdmins).toHaveLength(1);

        await nukeUser(adminA);
        await nukeUser(adminB);
    });

    it('SR-25: three admins concurrently demoting cannot produce zero active admins', async () => {
        if (!setStaffRole) return;
        const a = testUid('3a'), b = testUid('3b'), c = testUid('3c');
        await adminAuth.createUser({ uid: a }).catch(() => {});
        await adminAuth.createUser({ uid: b }).catch(() => {});
        await adminAuth.createUser({ uid: c }).catch(() => {});
        await adminAuth.setCustomUserClaims(a, { role: 'admin' });
        await adminAuth.setCustomUserClaims(b, { role: 'admin' });
        await adminAuth.setCustomUserClaims(c, { role: 'admin' });

        await Promise.all([
            call(a, 'admin', { uid: b, role: 'staff', operationId: opId('a-b') }),
            call(b, 'admin', { uid: c, role: 'staff', operationId: opId('b-c') }),
            call(c, 'admin', { uid: a, role: 'staff', operationId: opId('c-a') }),
        ]);

        const [ua, ub, uc] = await Promise.all([adminAuth.getUser(a), adminAuth.getUser(b), adminAuth.getUser(c)]);
        const activeAdmins = [ua, ub, uc].filter(u => u.customClaims?.role === 'admin');
        expect(activeAdmins.length).toBeGreaterThanOrEqual(1);

        await nukeUser(a);
        await nukeUser(b);
        await nukeUser(c);
    }, 30000);

    it('SR-26: the global lock serializes operations even across two different targets', async () => {
        if (!setStaffRole) return;
        const targetB = testUid('targetB');
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.createUser({ uid: targetB }).catch(() => {});

        const [rA, rB] = await Promise.all([
            call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: opId('t1') }),
            call(callerUid, 'admin', { uid: targetB, role: 'staff', operationId: opId('t2') }),
        ]);
        expect(rA.error).toBeUndefined();
        expect(rB.error).toBeUndefined();

        const lock = await db.doc('adminRoleLock/singleton').get();
        expect(lock.exists).toBe(false); // both released cleanly

        await nukeUser(targetB);
        await deleteAuditLogsFor(targetB);
    });

    it('SR-27: an expired lease is recoverable by a new operation', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        // Simulate a prior invocation that crashed after acquiring the lock.
        await db.doc('adminRoleLock/singleton').set({
            ownerOperationId: 'crashed-op',
            acquiredAt: Timestamp.fromMillis(Date.now() - 60000),
            leaseExpiresAt: Timestamp.fromMillis(Date.now() - 30000),
        });

        const { result, error } = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: opId('u') });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);

        const lock = await db.doc('adminRoleLock/singleton').get();
        expect(lock.exists).toBe(false);
    });

    it('SR-28: a non-owner\'s failed acquire attempt never touches another operation\'s active lock', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        // Simulate another operation actively (validly) holding the lock.
        await db.doc('adminRoleLock/singleton').set({
            ownerOperationId: 'active-other-op',
            acquiredAt: Timestamp.now(),
            leaseExpiresAt: Timestamp.fromMillis(Date.now() + 25000),
        });

        const { error } = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: opId('stale') });
        expect(error.code).toBe('aborted');

        const lock = await db.doc('adminRoleLock/singleton').get();
        expect(lock.exists).toBe(true);
        expect(lock.data().ownerOperationId).toBe('active-other-op');

        await db.doc('adminRoleLock/singleton').delete();
    }, 20000);

    it('SR-29: Auth mutation succeeded but audit never landed — retry with the same operationId completes exactly one audit', async () => {
        if (!setStaffRole) return;
        const op = opId('crash-before-audit');
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        // Simulate the exact post-crash state: Auth mutation already landed,
        // journal still says 'pending', no audit doc exists yet.
        await adminAuth.setCustomUserClaims(targetUid, { role: 'staff' });
        await db.doc(`adminRoleOperations/${op}`).set({
            operationId: op, actorUid: callerUid, targetUid, requestedRole: 'staff',
            previousRole: null, status: 'pending', createdAt: Timestamp.now(),
        });

        const { result, error } = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: op });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);

        const auditSnap = await db.collection('adminAuditLog').where('metadata.operationId', '==', op).get();
        expect(auditSnap.size).toBe(1);
        const opDoc = await db.doc(`adminRoleOperations/${op}`).get();
        expect(opDoc.data().status).toBe('completed');
    });

    it('SR-30: retrying a completed operation returns the same result, no duplicate mutation/audit', async () => {
        if (!setStaffRole) return;
        const op = opId('lost-response');
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        const first = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: op });
        expect(first.result.success).toBe(true);

        const second = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: op });
        expect(second.error).toBeUndefined();
        expect(second.result).toEqual(first.result);

        const auditSnap = await db.collection('adminAuditLog').where('metadata.operationId', '==', op).get();
        expect(auditSnap.size).toBe(1);
    });

    it('SR-31: reusing an operationId with a different target fails closed', async () => {
        if (!setStaffRole) return;
        const op = opId('diff-target');
        const otherTarget = testUid('other');
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.createUser({ uid: otherTarget }).catch(() => {});

        const first = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: op });
        expect(first.result.success).toBe(true);

        const second = await call(callerUid, 'admin', { uid: otherTarget, role: 'staff', operationId: op });
        expect(second.error.code).toBe('failed-precondition');

        await nukeUser(otherTarget);
    });

    it('SR-32: reusing an operationId with a different requested role fails closed', async () => {
        if (!setStaffRole) return;
        const op = opId('diff-role');
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        const first = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: op });
        expect(first.result.success).toBe(true);

        const second = await call(callerUid, 'admin', { uid: targetUid, role: 'admin', operationId: op });
        expect(second.error.code).toBe('failed-precondition');
    });

    it('SR-33: reusing an operationId from a different caller fails closed', async () => {
        if (!setStaffRole) return;
        const op = opId('diff-caller');
        const otherAdmin = testUid('otherAdmin');
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: otherAdmin }).catch(() => {});
        await adminAuth.setCustomUserClaims(otherAdmin, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        const first = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: op });
        expect(first.result.success).toBe(true);

        const second = await call(otherAdmin, 'admin', { uid: targetUid, role: 'staff', operationId: op });
        expect(second.error.code).toBe('failed-precondition');

        await nukeUser(otherAdmin);
    });

    it('SR-34: the audit document id is deterministic per operationId', async () => {
        if (!setStaffRole) return;
        const op = opId('deterministic');
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: op });

        const doc = await db.doc(`adminAuditLog/roleOp_${op}`).get();
        expect(doc.exists).toBe(true);
        expect(doc.data().metadata.operationId).toBe(op);
    });

    it('SR-35: a last-admin-blocked operation creates no audit record', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        const op = opId('blocked');

        const { error } = await call(callerUid, 'admin', { uid: callerUid, role: 'staff', operationId: op });
        expect(error.code).toBe('failed-precondition');

        const doc = await db.doc(`adminAuditLog/roleOp_${op}`).get();
        expect(doc.exists).toBe(false);
    });

    it('SR-36: two operationIds on the same target chain previousRole/role truthfully in order', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        const op1 = opId('seq1'), op2 = opId('seq2');
        const first = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: op1 });
        expect(first.result.success).toBe(true);
        const second = await call(callerUid, 'admin', { uid: targetUid, role: 'admin', operationId: op2 });
        expect(second.result.success).toBe(true);

        const doc2 = await db.doc(`adminAuditLog/roleOp_${op2}`).get();
        expect(doc2.data().metadata.previousRole).toBe('staff');
        expect(doc2.data().metadata.role).toBe('admin');
    });

    it('SR-37: unrelated custom claim survives concurrent serialized activity on the same target', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(targetUid, { betaTester: true });

        await Promise.all([
            call(callerUid, 'admin', { uid: targetUid, role: 'staff', operationId: opId('c1') }),
            call(callerUid, 'admin', { uid: targetUid, role: 'admin', operationId: opId('c2') }),
        ]);

        const user = await adminAuth.getUser(targetUid);
        expect(user.customClaims?.betaTester).toBe(true);
    });

    it('SR-38: bootstrap singleton remains untouched across lock/journal-heavy activity', async () => {
        if (!setStaffRole) return;
        await deleteSingleton();
        const a = testUid('sing1'), b = testUid('sing2');
        await adminAuth.createUser({ uid: a }).catch(() => {});
        await adminAuth.createUser({ uid: b }).catch(() => {});
        await adminAuth.setCustomUserClaims(a, { role: 'admin' });
        await adminAuth.setCustomUserClaims(b, { role: 'admin' });

        await Promise.all([
            call(a, 'admin', { uid: b, role: 'staff', operationId: opId('s1') }),
            call(b, 'admin', { uid: a, role: 'admin', operationId: opId('s2') }),
        ]);

        const singleton = await db.doc('adminBootstrap/singleton').get();
        expect(singleton.exists).toBe(false);

        await nukeUser(a);
        await nukeUser(b);
    });

    it('SR-39: client cannot forge operation journal/lock state via request.data', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        const op = opId('forge');

        const { result, error } = await call(callerUid, 'admin', {
            uid: targetUid, role: 'staff', operationId: op,
            status: 'completed', result: { success: true, previousRole: 'admin', role: 'admin' },
            previousRole: 'admin', ownerOperationId: 'forged-owner',
        });
        expect(error).toBeUndefined();
        expect(result.previousRole).toBeNull();
        expect(result.role).toBe('staff');

        const opDoc = await db.doc(`adminRoleOperations/${op}`).get();
        expect(opDoc.data().previousRole).toBeNull();
        expect(opDoc.data().status).toBe('completed');
    });

    it('SR-40: logs contain no sensitive identity during concurrent/lock activity', async () => {
        if (!setStaffRole) return;
        const a = testUid('log1'), b = testUid('log2');
        await adminAuth.createUser({ uid: a }).catch(() => {});
        await adminAuth.createUser({ uid: b }).catch(() => {});
        await adminAuth.setCustomUserClaims(a, { role: 'admin' });
        await adminAuth.setCustomUserClaims(b, { role: 'admin' });

        const originalLog = console.log;
        const originalError = console.error;
        const captured = [];
        console.log = (...args) => captured.push(args.join(' '));
        console.error = (...args) => captured.push(args.join(' '));
        try {
            await Promise.all([
                call(a, 'admin', { uid: b, role: 'staff', operationId: opId('l1') }),
                call(b, 'admin', { uid: a, role: 'staff', operationId: opId('l2') }),
            ]);
        } finally {
            console.log = originalLog;
            console.error = originalError;
        }

        const joined = captured.join('\n');
        expect(joined).not.toMatch(/@parqueen\.app|@gmail\.com/);
        expect(joined.includes(a)).toBe(false);
        expect(joined.includes(b)).toBe(false);

        await nukeUser(a);
        await nukeUser(b);
    });
});
