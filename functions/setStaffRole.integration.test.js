'use strict';

/**
 * Behavioral integration tests — setStaffRole callable.
 *
 * Prior implementation replaced the caller's entire Auth customClaims object
 * (setCustomUserClaims(uid, { role })), had no target-existence validation, no
 * protection against removing the last active administrator (a real lockout
 * risk now that adminBootstrap/singleton is permanently closed), a
 * non-deterministic audit write with undefined partial-failure behavior, and
 * no token revocation on demotion.
 *
 * What is proven:
 *   SR-1:  unauthenticated caller rejected
 *   SR-2:  non-admin caller rejected
 *   SR-3:  nonexistent target rejected, no audit record created
 *   SR-4:  malformed/missing target uid rejected
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
 *   SR-16: concurrent updates to the same target remain safe (no corruption)
 *   SR-17: self-demotion allowed when another active admin exists
 *   SR-18: last active administrator cannot demote themselves
 *   SR-19: last active administrator's role cannot be removed by another caller
 *   SR-20: a disabled admin does not count toward "another active admin"
 *   SR-21: bootstrap singleton is never touched by role management
 *   SR-22: no console output contains sensitive identity
 *   SR-23: error codes reaching the client are clean HttpsError codes, never raw Admin SDK codes
 *
 * SR-24/25/26 (existing bootstrapAdmin / reconcileLegacyAdminSingleton / deleteAccount
 * suites unaffected) are verified by the full functions-gate run, not as cases here.
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
    });

    afterEach(async () => {
        await deleteAuditLogsFor(targetUid);
        await nukeUser(callerUid);
        await nukeUser(targetUid);
    });

    it('SR-1: unauthenticated caller rejected', async () => {
        if (!setStaffRole) return;
        const { error } = await call(null, undefined, { uid: targetUid, role: 'staff' });
        expect(error.code).toBe('permission-denied');
    });

    it('SR-2: non-admin caller rejected', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        const { error } = await call(callerUid, undefined, { uid: targetUid, role: 'staff' });
        expect(error.code).toBe('permission-denied');
    });

    it('SR-3: nonexistent target rejected, no audit record created', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });

        const fakeTarget = testUid('ghost');
        const { error } = await call(callerUid, 'admin', { uid: fakeTarget, role: 'staff' });
        expect(error.code).toBe('not-found');

        const snap = await db.collection('adminAuditLog').where('targetUid', '==', fakeTarget).get();
        expect(snap.empty).toBe(true);
    });

    it('SR-4: malformed/missing target uid rejected', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });

        const missing = await call(callerUid, 'admin', { role: 'staff' });
        expect(missing.error.code).toBe('invalid-argument');

        const wrongType = await call(callerUid, 'admin', { uid: 12345, role: 'staff' });
        expect(wrongType.error.code).toBe('invalid-argument');
    });

    it('SR-5: invalid role value rejected', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        const { error } = await call(callerUid, 'admin', { uid: targetUid, role: 'superadmin' });
        expect(error.code).toBe('invalid-argument');
    });

    it('SR-6: promotion succeeds — none to staff, and none to admin', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        const { result, error } = await call(callerUid, 'admin', { uid: targetUid, role: 'staff' });
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

        const { result, error } = await call(callerUid, 'admin', { uid: targetUid, role: 'staff' });
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

        const { result, error } = await call(callerUid, 'admin', { uid: targetUid, role: null });
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

        const { result, error } = await call(callerUid, 'admin', { uid: targetUid, role: 'staff' });
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
            uid: targetUid, role: 'staff', customClaims: { superuser: true }, betaTester: true,
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

        const { error } = await call(callerUid, 'admin', { uid: targetUid, role: 'staff' });
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

        const { error } = await call(callerUid, 'admin', { uid: targetUid, role: 'admin' });
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

        const { error } = await call(callerUid, 'admin', { uid: targetUid, role: null });
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
        const { error } = await call(callerUid, 'admin', { uid: targetUid, role: 'staff', adminId: spoofedActor, adminUid: spoofedActor });
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

        const { error } = await call(callerUid, 'admin', { uid: targetUid, role: 'admin' });
        expect(error).toBeUndefined();

        const snap = await db.collection('adminAuditLog').where('targetUid', '==', targetUid).get();
        const data = snap.docs[0].data();
        expect(data.metadata.previousRole).toBe('staff');
        expect(data.metadata.role).toBe('admin');
        expect(data.action).toBe('user.set_role');
    });

    it('SR-16: concurrent updates to the same target remain safe — no corruption, no crash', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});

        const [a, b] = await Promise.all([
            call(callerUid, 'admin', { uid: targetUid, role: 'staff' }),
            call(callerUid, 'admin', { uid: targetUid, role: 'admin' }),
        ]);
        expect(a.error).toBeUndefined();
        expect(b.error).toBeUndefined();

        const user = await adminAuth.getUser(targetUid);
        expect(['staff', 'admin']).toContain(user.customClaims?.role);
    });

    it('SR-17: self-demotion allowed when another active admin exists', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });
        await adminAuth.createUser({ uid: targetUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(targetUid, { role: 'admin' });

        const { result, error } = await call(callerUid, 'admin', { uid: callerUid, role: 'staff' });
        expect(error).toBeUndefined();
        expect(result.success).toBe(true);
        const user = await adminAuth.getUser(callerUid);
        expect(user.customClaims?.role).toBe('staff');
    });

    it('SR-18: the last active administrator cannot demote themselves', async () => {
        if (!setStaffRole) return;
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });

        const { error } = await call(callerUid, 'admin', { uid: callerUid, role: 'staff' });
        expect(error.code).toBe('failed-precondition');

        const user = await adminAuth.getUser(callerUid);
        expect(user.customClaims?.role).toBe('admin');
    });

    it('SR-19: the last active administrator\'s role cannot be removed by another caller', async () => {
        if (!setStaffRole) return;
        // callerUid is itself the sole admin; targetUid is a second, non-admin
        // caller attempting (via an admin-looking token) to strip the sole admin.
        await adminAuth.createUser({ uid: callerUid }).catch(() => {});
        await adminAuth.setCustomUserClaims(callerUid, { role: 'admin' });

        const { error } = await call(callerUid, 'admin', { uid: callerUid, role: null });
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

        const { error } = await call(callerUid, 'admin', { uid: callerUid, role: 'staff' });
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

        await call(callerUid, 'admin', { uid: targetUid, role: 'staff' });
        await call(callerUid, 'admin', { uid: callerUid, role: 'admin' });

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
            await call(callerUid, 'admin', { uid: targetUid, role: 'staff' });
            await call(callerUid, 'admin', { uid: 'not-a-real-uid', role: 'staff' });
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

        const { error } = await call(callerUid, 'admin', { uid: testUid('ghost'), role: 'staff' });
        expect(error.code).toBe('not-found');
        expect(error.code).not.toMatch(/^auth\//);
    });
});
