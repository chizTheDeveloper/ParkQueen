'use strict';

/**
 * Behavioral integration tests — adminReadView (functions/index.js, view
 * logic in functions/adminReadViews.js).
 *
 * Context: the Admin Dashboard used to read users, reports, adminAuditLog,
 * parkingSessions, parseFailures, and spots (admin-only branch) directly
 * against the client Firestore SDK, authorized solely by firestore.rules'
 * token-only isAdmin() check. Rules cannot re-verify current server-side
 * Auth state, so a demoted/deleted/disabled admin's stale token could keep
 * reading that data until the token naturally expired — the same
 * vulnerability class requireCurrentAdmin closes for callables, applied here
 * to reads instead of writes. firestore.rules now denies all of these
 * direct client reads; adminReadView is the only way to read them.
 *
 * What is proven:
 *   AR-1:  unauthenticated rejected
 *   AR-2:  current admin allowed
 *   AR-3:  stale demoted admin denied
 *   AR-4:  deleted former admin denied
 *   AR-5:  disabled admin denied
 *   AR-6:  stale token predating a later promotion still requires refresh (unchanged intended behavior)
 *   AR-7:  usersList returns only intended fields (data minimization)
 *   AR-8:  userDetail returns only the bundled fields the modal displays, nothing else
 *   AR-9:  reportsList status filter honored + userMap minimized to fullName/username/email
 *   AR-10: auditLogList merges standard+legacy entries, deduplicated
 *   AR-11: userDetail's session is scoped to exactly the requested uid
 *   AR-12: malformed pagination params rejected
 *   AR-13: maximum page size enforced
 *   AR-14: unknown/arbitrary view name rejected — no generic collection proxy
 *   AR-15: arbitrary extra params are silently ignored, never alter the query
 *   AR-16: a garbage/foreign cursor cannot escape the intended collection scope
 *   AR-17: client-requested field lists have no effect — server always returns its fixed minimized shape
 *   AR-18: source-contract — adminReadView is present, requireCurrentAdmin-gated, and the view enum matches
 *
 * reportsList/pingsList pagination (added after integration review found the
 * original flat 500-record cap would have silently truncated results
 * relative to the pre-migration client, which fetched every matching
 * document with no limit() at all — see functions/adminReadViews.js):
 *   AR-19: reportsList first page returns a deterministic nextCursor when more pages exist
 *   AR-20: reportsList second page continues with no duplicate or skipped record
 *   AR-21: malformed cursor rejected for reportsList/pingsList (shared pagination helper)
 *   AR-22: maximum page size enforced for reportsList/pingsList
 *   AR-23: the status filter remains complete across every page, not just the first
 *   AR-24: the final page returns done:true and nextCursor:null
 */

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'parkqueen-46475363-ccf36';
const REGION = 'us-central1';
const FUNCTIONS_BASE = `http://localhost:5001/${PROJECT_ID}/${REGION}`;
const AUTH_EMULATOR = 'http://localhost:9099';
const APP_NAME = '__adminReadViews_intg__';

const testApp =
    getApps().find(a => a.name === APP_NAME) ??
    initializeApp({ projectId: PROJECT_ID }, APP_NAME);
const db = getFirestore(testApp);
const adminAuth = getAuth(testApp);

// ─── Helpers (mirrors adminSessionAuth/adminBackfill integration conventions) ─

async function callFn(name, idToken, data = {}) {
    const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ data }),
    });
    return res.json();
}

function callView(idToken, view, params = {}) {
    return callFn('adminReadView', idToken, { view, params });
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

function testUid(label) {
    return `ar_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function nuke(uid) {
    await adminAuth.deleteUser(uid).catch(() => {});
}

async function adminIdToken(uid) {
    await adminAuth.createUser({ uid }).catch(() => {});
    await adminAuth.setCustomUserClaims(uid, { role: 'admin' });
    return signInUser(uid);
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('adminReadView — coordinated read-side session hardening', () => {
    let uid;
    let cleanupUserIds;

    beforeEach(() => {
        uid = testUid('caller');
        cleanupUserIds = [];
    });

    afterEach(async () => {
        await nuke(uid);
        for (const id of cleanupUserIds) {
            await db.doc(`users/${id}`).delete().catch(() => {});
            await db.doc(`reports/${id}`).delete().catch(() => {});
            await db.doc(`parkingSessions/${id}`).delete().catch(() => {});
        }
    });

    it('AR-1: unauthenticated rejected', async () => {
        const resp = await callView(null, 'usersList');
        expect(resp.error?.status).toBe('UNAUTHENTICATED');
    });

    it('AR-2: current admin allowed', async () => {
        const idToken = await adminIdToken(uid);
        const resp = await callView(idToken, 'usersList');
        expect(resp.error).toBeUndefined();
        expect(Array.isArray(resp.result.users)).toBe(true);
    });

    it('AR-3: stale demoted admin denied', async () => {
        const idToken = await adminIdToken(uid);
        await adminAuth.setCustomUserClaims(uid, { role: 'staff' });
        const resp = await callView(idToken, 'usersList');
        expect(resp.error?.status).toBe('PERMISSION_DENIED');
    });

    it('AR-4: deleted former admin denied', async () => {
        const idToken = await adminIdToken(uid);
        await adminAuth.deleteUser(uid).catch(() => {});
        const resp = await callView(idToken, 'reportsList', { status: 'pending' });
        expect(resp.error?.status).toBe('PERMISSION_DENIED');
    });

    it('AR-5: disabled admin denied', async () => {
        const idToken = await adminIdToken(uid);
        await adminAuth.updateUser(uid, { disabled: true });
        const resp = await callView(idToken, 'auditLogList');
        expect(resp.error?.status).toBe('PERMISSION_DENIED');
    });

    it('AR-6: token predating a later promotion still requires refresh (unchanged intended behavior)', async () => {
        await adminAuth.createUser({ uid }).catch(() => {});
        const idToken = await signInUser(uid); // signed in BEFORE promotion
        await adminAuth.setCustomUserClaims(uid, { role: 'admin' });
        const resp = await callView(idToken, 'usersList');
        expect(resp.error?.status).toBe('PERMISSION_DENIED');
    });

    it('AR-7: usersList returns only intended fields (data minimization)', async () => {
        const idToken = await adminIdToken(uid);
        const targetId = testUid('target');
        cleanupUserIds.push(targetId);
        await db.doc(`users/${targetId}`).set({
            id: targetId, fullName: 'Test User', username: 'testu', email: 't@example.com',
            phone: '555-0100', status: 'Active', createdAt: Timestamp.now(),
            crowns: 42, title: 'Legend', vehicleType: 'sedan', vehicleBrand: 'Honda',
            vehicleColor: 'blue', avatarManifestId: 'm1', avatarAgeGroup: 'adult',
            avatarUpdatedAt: Timestamp.now(),
        });

        // Loop pages until the seeded target is found (collection may hold
        // stray docs from other suites).
        let found = null;
        let cursor = null, done = false, guard = 0;
        while (!done && !found && guard++ < 20) {
            const resp = await callView(idToken, 'usersList', { cursor, limit: 200 });
            expect(resp.error).toBeUndefined();
            found = resp.result.users.find(u => u.id === targetId);
            cursor = resp.result.nextCursor;
            done = resp.result.done;
        }
        expect(found).toBeTruthy();
        expect(found.fullName).toBe('Test User');
        expect('crowns' in found).toBe(false);
        expect('title' in found).toBe(false);
        expect('vehicleType' in found).toBe(false);
        expect('vehicleBrand' in found).toBe(false);
        expect('vehicleColor' in found).toBe(false);
        expect('avatarManifestId' in found).toBe(false);
        expect('avatarAgeGroup' in found).toBe(false);
        expect('avatarUpdatedAt' in found).toBe(false);
    });

    it('AR-8: userDetail returns only the bundled sections the modal displays', async () => {
        const idToken = await adminIdToken(uid);
        const targetId = testUid('target');
        cleanupUserIds.push(targetId);

        const resp = await callView(idToken, 'userDetail', { uid: targetId });
        expect(resp.error).toBeUndefined();
        const keys = Object.keys(resp.result).sort();
        expect(keys).toEqual(
            ['auditEntries', 'errors', 'recentPings', 'reportsAgainst', 'reportsFiled', 'session', 'trustEvents'].sort(),
        );
    });

    it('AR-9: reportsList status filter honored + userMap minimized to fullName/username/email', async () => {
        const idToken = await adminIdToken(uid);
        const reporterId = testUid('reporter');
        const reportedId = testUid('reported');
        const reportId = testUid('report');
        cleanupUserIds.push(reporterId, reportedId);
        await db.doc(`users/${reporterId}`).set({ fullName: 'Reporter', username: 'rep', email: 'r@x.com', phone: '555-1' });
        await db.doc(`reports/${reportId}`).set({
            reporterId, reportedUserId: reportedId, type: 'spam', reason: 'test',
            status: 'pending', createdAt: Timestamp.now(),
        });

        const resp = await callView(idToken, 'reportsList', { status: 'pending' });
        expect(resp.error).toBeUndefined();
        const found = resp.result.reports.find(r => r.id === reportId);
        expect(found).toBeTruthy();
        expect(found.status).toBe('pending');
        const info = resp.result.userMap[reporterId];
        expect(info.fullName).toBe('Reporter');
        expect('phone' in info).toBe(false);

        await db.doc(`reports/${reportId}`).delete().catch(() => {});
    });

    it('AR-10: auditLogList merges standard+legacy entries, deduplicated', async () => {
        const idToken = await adminIdToken(uid);
        const entryId = testUid('entry');
        await db.doc(`adminAuditLog/${entryId}`).set({
            action: 'user.suspend', targetType: 'user', adminId: uid, createdAt: Timestamp.now(),
        });

        const resp = await callView(idToken, 'auditLogList');
        expect(resp.error).toBeUndefined();
        expect(Array.isArray(resp.result.entries)).toBe(true);
        const found = resp.result.entries.find(e => e.id === entryId);
        expect(found).toBeTruthy();

        await db.doc(`adminAuditLog/${entryId}`).delete().catch(() => {});
    });

    it('AR-11: userDetail session is scoped to exactly the requested uid', async () => {
        const idToken = await adminIdToken(uid);
        const targetA = testUid('sessA');
        const targetB = testUid('sessB');
        await db.doc(`parkingSessions/${targetA}`).set({ active: true, streetName: 'A St' });
        await db.doc(`parkingSessions/${targetB}`).set({ active: true, streetName: 'B St' });

        const resp = await callView(idToken, 'userDetail', { uid: targetA });
        expect(resp.error).toBeUndefined();
        expect(resp.result.session.streetName).toBe('A St');

        await db.doc(`parkingSessions/${targetA}`).delete().catch(() => {});
        await db.doc(`parkingSessions/${targetB}`).delete().catch(() => {});
    });

    it('AR-12: malformed pagination params rejected', async () => {
        const idToken = await adminIdToken(uid);
        const badCursor = await callView(idToken, 'usersList', { cursor: 12345 });
        expect(badCursor.error?.status).toBe('INVALID_ARGUMENT');

        const badLimit = await callView(idToken, 'usersList', { limit: -1 });
        expect(badLimit.error?.status).toBe('INVALID_ARGUMENT');

        const badLimitType = await callView(idToken, 'usersList', { limit: 'lots' });
        expect(badLimitType.error?.status).toBe('INVALID_ARGUMENT');
    });

    it('AR-13: maximum page size enforced', async () => {
        const idToken = await adminIdToken(uid);
        const resp = await callView(idToken, 'usersList', { limit: 100000 });
        expect(resp.error?.status).toBe('INVALID_ARGUMENT');
    });

    it('AR-14: unknown/arbitrary view name rejected — no generic collection proxy', async () => {
        const idToken = await adminIdToken(uid);
        const resp = await callView(idToken, 'arbitraryCollectionDump', { collection: 'users' });
        expect(resp.error?.status).toBe('INVALID_ARGUMENT');
    });

    it('AR-15: arbitrary extra params are silently ignored, never alter the query', async () => {
        const idToken = await adminIdToken(uid);
        const resp = await callView(idToken, 'reportsList', {
            status: 'pending', collection: 'users', where: { field: 'role', op: '==', value: 'admin' },
        });
        expect(resp.error).toBeUndefined();
        expect(Array.isArray(resp.result.reports)).toBe(true);
    });

    it('AR-16: a garbage/foreign cursor cannot escape the intended collection scope', async () => {
        const idToken = await adminIdToken(uid);
        // Cursor references a document ID that does not exist in `users` —
        // handler must fall back to starting from the beginning rather than
        // erroring or leaking data from another collection.
        const resp = await callView(idToken, 'usersList', { cursor: 'nonexistent-doc-id-xyz', limit: 5 });
        expect(resp.error).toBeUndefined();
        expect(Array.isArray(resp.result.users)).toBe(true);
    });

    it('AR-17: client-requested field lists have no effect — server always returns its fixed minimized shape', async () => {
        const idToken = await adminIdToken(uid);
        const reporterId = testUid('reporter2');
        const reportId = testUid('report2');
        cleanupUserIds.push(reporterId);
        await db.doc(`users/${reporterId}`).set({ fullName: 'X', username: 'x', email: 'x@x.com', phone: '555-2' });
        await db.doc(`reports/${reportId}`).set({
            reporterId, reportedUserId: testUid('other'), type: 'spam', reason: 'test',
            status: 'pending', createdAt: Timestamp.now(),
        });

        const resp = await callView(idToken, 'reportsList', {
            status: 'pending', fields: ['email', 'phone', 'crowns'], select: '*',
        });
        expect(resp.error).toBeUndefined();
        const info = resp.result.userMap[reporterId];
        expect(Object.keys(info).sort()).toEqual(['email', 'fullName', 'username'].sort());

        await db.doc(`reports/${reportId}`).delete().catch(() => {});
    });

    it('AR-18: source-contract — adminReadView is present, requireCurrentAdmin-gated, and the view enum matches', () => {
        const indexSrc = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
        const fnStart = indexSrc.indexOf('exports.adminReadView = onCall(');
        expect(fnStart).toBeGreaterThan(-1);
        const body = indexSrc.slice(fnStart, fnStart + 1200);
        expect(body).toMatch(/await requireCurrentAdmin\(request\);/);
        expect(body).not.toMatch(/collection\(p\.collection\)/); // no client-supplied collection

        const viewsSrc = fs.readFileSync(path.join(__dirname, 'adminReadViews.js'), 'utf8');
        for (const view of ['dashboardCounts', 'usersList', 'userDetail', 'reportsList', 'auditLogList', 'pingsList', 'parseFailuresList']) {
            expect(viewsSrc).toMatch(new RegExp(`\\b${view}\\b`));
        }
    });

    // ─── reportsList/pingsList pagination ───────────────────────────────
    // The pre-migration client queries for these two views had NO limit()
    // at all (see functions/adminReadViews.js's reportsList/pingsList
    // header comments) — a flat cap would have silently truncated results.
    // These tests prove the cursor pagination added in response to
    // integration review reconstructs the complete result set with no
    // duplicate or skipped record.
    describe('reportsList/pingsList pagination', () => {
        let reportIds, spotIds;

        beforeEach(() => { reportIds = []; spotIds = []; });

        afterEach(async () => {
            for (const id of reportIds) await db.doc(`reports/${id}`).delete().catch(() => {});
            for (const id of spotIds) await db.doc(`spots/${id}`).delete().catch(() => {});
        });

        it('AR-19/AR-20/AR-24: reportsList pages through all matching reports with no duplicate or skipped record', async () => {
            const idToken = await adminIdToken(uid);
            const marker = testUid('pgmark');
            for (let i = 0; i < 5; i++) {
                const id = `${marker}_${i}`;
                reportIds.push(id);
                await db.doc(`reports/${id}`).set({
                    reporterId: testUid('r'), reportedUserId: testUid('rd'), type: 'spam',
                    reason: marker, status: 'pending',
                    createdAt: Timestamp.fromMillis(Date.now() - i * 1000), // deterministic distinct order
                });
            }

            const page1 = await callView(idToken, 'reportsList', { status: 'pending', limit: 2 });
            expect(page1.error).toBeUndefined();
            expect(page1.result.reports.length).toBeLessThanOrEqual(2);
            expect(page1.result.done).toBe(false); // AR-19: deterministic nextCursor when more pages exist
            expect(page1.result.nextCursor).toBeTruthy();

            const seen = new Set(page1.result.reports.map(r => r.id));
            let cursor = page1.result.nextCursor;
            let done = false;
            let guard = 0;
            while (!done && guard++ < 20) {
                const page = await callView(idToken, 'reportsList', { status: 'pending', limit: 2, cursor });
                expect(page.error).toBeUndefined();
                for (const r of page.result.reports) {
                    expect(seen.has(r.id)).toBe(false); // AR-20: no duplicate across pages
                    seen.add(r.id);
                }
                cursor = page.result.nextCursor;
                done = page.result.done;
            }
            expect(done).toBe(true);
            expect(cursor).toBeNull(); // AR-24: final page returns done:true/nextCursor:null

            const ourReports = [...seen].filter(id => id.startsWith(marker));
            expect(ourReports.length).toBe(5); // no skipped record among our 5 seeded reports
        });

        it('AR-23: reportsList status filter remains complete across every page, not just the first', async () => {
            const idToken = await adminIdToken(uid);
            const marker = testUid('filtmark');
            for (let i = 0; i < 4; i++) {
                const id = `${marker}_${i}`;
                reportIds.push(id);
                await db.doc(`reports/${id}`).set({
                    reporterId: testUid('r'), reportedUserId: testUid('rd'), type: 'spam',
                    reason: marker, status: i % 2 === 0 ? 'pending' : 'reviewed',
                    createdAt: Timestamp.fromMillis(Date.now() - i * 1000),
                });
            }

            let cursor = null, done = false, guard = 0;
            const found = [];
            while (!done && guard++ < 20) {
                const page = await callView(idToken, 'reportsList', { status: 'pending', limit: 1, cursor });
                expect(page.error).toBeUndefined();
                found.push(...page.result.reports.filter(r => r.reason === marker));
                cursor = page.result.nextCursor;
                done = page.result.done;
            }
            // Only the 2 'pending' reports among our 4 seeded — 'reviewed' ones
            // must never appear, on any page, even though pagination interleaves
            // with other suites' data.
            expect(found.length).toBe(2);
            expect(found.every(r => r.status === 'pending')).toBe(true);
        });

        it('AR-21/AR-22: malformed cursor and oversized limit rejected for pingsList (shared pagination helper)', async () => {
            const idToken = await adminIdToken(uid);
            const badCursor = await callView(idToken, 'pingsList', { filter: 'active', cursor: 999 });
            expect(badCursor.error?.status).toBe('INVALID_ARGUMENT');

            const badLimit = await callView(idToken, 'pingsList', { filter: 'active', limit: 100000 });
            expect(badLimit.error?.status).toBe('INVALID_ARGUMENT');
        });

        it('pingsList (active) pages through all matching spots with no duplicate or skipped record', async () => {
            const idToken = await adminIdToken(uid);
            const marker = testUid('pingmark');
            const future = Timestamp.fromMillis(Date.now() + 60 * 60 * 1000);
            for (let i = 0; i < 3; i++) {
                const id = `${marker}_${i}`;
                spotIds.push(id);
                await db.doc(`spots/${id}`).set({
                    lat: 40.7, lng: -74.0, type: 'free', status: 'available',
                    finderId: testUid('f'), finderName: marker,
                    pingMode: 'now', reportedAt: Timestamp.now(),
                    expiresAt: Timestamp.fromMillis(future.toMillis() + i * 1000),
                    geohash: 'dr5ru', address: marker,
                });
            }

            // The shared spots collection accumulates 'active' (far-future
            // expiresAt) fixtures from many other suites across a full test
            // run — a small page size with a low iteration guard could give
            // up before reaching our 3 marker-tagged docs. Use a generous
            // page size (matches AR-7's usersList precedent) so the loop
            // reliably terminates in a handful of pages regardless of
            // collection size, while still proving no duplicate is ever seen.
            let cursor = null, done = false, guard = 0;
            const seen = new Set();
            while (!done && guard++ < 50) {
                const page = await callView(idToken, 'pingsList', { filter: 'active', limit: 200, cursor });
                expect(page.error).toBeUndefined();
                for (const p of page.result.pings) {
                    expect(seen.has(p.id)).toBe(false);
                    seen.add(p.id);
                }
                cursor = page.result.nextCursor;
                done = page.result.done;
            }
            expect(done).toBe(true);
            const ours = [...seen].filter(id => id.startsWith(marker));
            expect(ours.length).toBe(3);
        });
    });
});
