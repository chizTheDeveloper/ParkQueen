'use strict';

// Centralized fresh-admin authorization for privileged callables.
//
// Prior pattern (still used only by bootstrapAdmin's own distinct bootstrap
// contract, and left as-is on reconcileLegacyAdminSingleton — see the
// migration notes in functions/index.js) was:
//
//   if (request.auth?.token?.role !== 'admin') throw new HttpsError('permission-denied', ...);
//
// This trusts only the PRESENTED ID TOKEN's embedded claims. Firebase ID
// tokens are bearer credentials that remain cryptographically valid for
// their full lifetime (normally ~1 hour) regardless of what happens to the
// account afterward. A token-only check does not notice:
//   - the caller was demoted (admin -> staff/null) after the token was minted
//   - the caller's Auth account was deleted after the token was minted
//   - the caller's Auth account was disabled after the token was minted
// setStaffRole's and deleteAccount's own target-side hardening (the shared
// adminRoleLock, the last-admin scan) protects the ACCOUNT BEING ACTED ON —
// it does nothing to stop a demoted/deleted/disabled CALLER from using their
// own still-valid old token to invoke admin-gated callables in the first
// place. requireCurrentAdmin closes that gap by re-deriving authorization
// from current server-side Auth state on every call, not the token alone.
//
// NOT implemented here: true revoked-token enforcement via
// getAuth().verifyIdToken(token, /* checkRevoked= */ true). That primitive
// is real, documented, and correct against the production Firebase Auth
// backend — but it was verified by direct diagnostic against the Firebase
// Auth EMULATOR that a revoked token is still accepted by
// verifyIdToken(token, true) locally (tokensValidAfterTime is not enforced
// by the emulator's implementation). Since this security property cannot be
// exercised or proven within this repository's test environment, and per
// this task's own instruction not to ship or claim revocation enforcement
// that can't be verified, it is intentionally NOT implemented in this
// branch. The fresh getUser()-based check below already fully closes the
// confirmed vulnerability (stale role/deleted/disabled caller) — it is
// EQUALLY effective against a demotion/deletion/disablement regardless of
// whether revokeRefreshTokens was ever called. What true checkRevoked would
// ADD on top is protection for the narrower case of an operator explicitly
// killing a session with role/disabled/existence otherwise unchanged — a
// real but separate scenario, tracked as its own follow-up (see PR
// description / final report) rather than merged into this fix unverified.
//
// Lazy-require Firebase modules so this file is importable from test envs
// without requiring Firebase Admin to be initialized (matches rateLimiter.js).
async function requireCurrentAdmin(request) {
    const { getAuth } = require('firebase-admin/auth');
    const { HttpsError } = require('firebase-functions/v2/https');

    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Sign in first.');
    }

    // Cheap, no-Auth-SDK-call fail-fast: rejects the common case (an
    // ordinary user who was never admin) before spending any Admin SDK
    // round-trip. This also preserves existing, intended behavior for a
    // NEWLY promoted admin whose current Auth state is already correct but
    // whose held ID token predates the promotion — they must still refresh
    // their token before admin functionality activates, exactly as before
    // this change; requireCurrentAdmin does not weaken that requirement.
    if (request.auth.token.role !== 'admin') {
        console.warn('[admin-auth] rejected: admin_stale_claim');
        throw new HttpsError('permission-denied', 'Admin only.');
    }

    // Fresh server-side state: closes demotion/deletion/disablement, the
    // confirmed vulnerability, regardless of whether anything ever called
    // revokeRefreshTokens for this account.
    let currentUser;
    try {
        currentUser = await getAuth().getUser(request.auth.uid);
    } catch (err) {
        const reason = err.code === 'auth/user-not-found' ? 'admin_deleted' : 'admin_lookup_failed';
        console.warn(`[admin-auth] rejected: ${reason}`);
        throw new HttpsError('permission-denied', 'Admin only.');
    }
    if (currentUser.disabled) {
        console.warn('[admin-auth] rejected: admin_disabled');
        throw new HttpsError('permission-denied', 'Admin only.');
    }
    if (currentUser.customClaims?.role !== 'admin') {
        console.warn('[admin-auth] rejected: admin_stale_claim');
        throw new HttpsError('permission-denied', 'Admin only.');
    }

    return currentUser;
}

module.exports = { requireCurrentAdmin };
