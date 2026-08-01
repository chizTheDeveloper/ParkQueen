import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();
const appTsx = readFileSync(resolve(root, 'App.tsx'), 'utf-8');
const dbTs   = readFileSync(resolve(root, 'database.ts'), 'utf-8');

// ── Upsert on sign-in ──────────────────────────────────────────────────────

describe('FCM token registration — upsert semantics', () => {
  it('uses setDoc with merge:true to register the FCM token', () => {
    // setDoc + merge:true creates private/preferences when missing, updates when present.
    // The old updateDoc-only path failed with "No document to update" for new users.
    expect(appTsx).toContain("setDoc(doc(db, 'users', firebaseUser.uid, 'private', 'preferences'), { fcmToken: currentToken }, { merge: true })");
  });

  it('does not use updateDoc for the FCM registration write', () => {
    expect(appTsx).not.toContain("updateDoc(doc(db, 'users', firebaseUser.uid, 'private', 'preferences'), { fcmToken:");
  });

  it('existing preference fields are preserved — only fcmToken is specified in the write', () => {
    // merge:true means only the listed keys are touched; notificationRadius, lang, etc. remain.
    expect(appTsx).toContain("{ fcmToken: currentToken }, { merge: true }");
  });

  it('FCM token is never written to the public root user document', () => {
    // Token must only go to users/{uid}/private/preferences — never to users/{uid}.
    expect(appTsx).not.toMatch(/updateDoc\(doc\(db,\s*['"]users['"]\s*,\s*\w+\s*\)\s*,\s*\{[^}]*fcmToken/);
    expect(appTsx).not.toMatch(/setDoc\(doc\(db,\s*['"]users['"]\s*,\s*\w+\s*\)\s*,\s*\{[^}]*fcmToken/);
  });

  it('FCM token value is never logged', () => {
    expect(appTsx).not.toContain('console.log(currentToken');
    expect(appTsx).not.toContain('console.warn(currentToken');
    expect(appTsx).not.toContain('console.error(currentToken');
    expect(dbTs).not.toContain('console.log(uid');
  });

  it('registration errors are handled without an uncaught rejection', () => {
    // FCM setup now uses async/await inside a try/catch; errors are caught and warned.
    expect(appTsx).toContain("console.warn('FCM setup error', e)");
  });
});

// ── Logout token cleanup ────────────────────────────────────────────────────

describe('FCM token — logout removes token before signOut', () => {
  it('logoutUser removes fcmToken via deleteField before calling signOut', () => {
    // Cross-account fix: without this cleanup, the same browser token could be
    // stored under both the previous user and the new user if they sign in on
    // the same device, causing notifications for user A to reach user B's browser.
    expect(dbTs).toContain('deleteField()');
    expect(dbTs).toContain("{ fcmToken: deleteField() }");
  });

  it('deleteField targets private/preferences, not the root user document', () => {
    expect(dbTs).toContain("'users', uid, 'private', 'preferences'");
    // Confirm no deleteField touches the root doc
    expect(dbTs).not.toMatch(/updateDoc\(doc\(db,\s*['"]users['"]\s*,\s*uid\s*\)\s*,\s*\{[^}]*deleteField/);
  });

  it('token removal is attempted before signOut — ordering is correct', () => {
    // deleteField call must appear before signOut(auth) in the source.
    const deleteIdx = dbTs.indexOf('deleteField()');
    const signOutIdx = dbTs.indexOf('signOut(auth)');
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(signOutIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeLessThan(signOutIdx);
  });

  it('offline cleanup failure never blocks logout — error is caught', () => {
    // .then(true).catch(false) pattern ensures updateDoc failure returns false
    // rather than throwing, so signOut always runs regardless of network state.
    expect(dbTs).toContain('.then(() => true).catch(() => false)');
    expect(dbTs).toContain('await signOut(auth)');
  });

  it('logout clears account-scoped browser state', () => {
    expect(dbTs).toContain('localStorage.clear()');
    expect(dbTs).toContain('signOut(auth)');
  });
});

// ── Account-switch privacy ──────────────────────────────────────────────────

describe('FCM token — account switching cannot create cross-user association', () => {
  it('sign-in stores token under the authenticated UID, not a shared path', () => {
    // Each user writes their own token to their own private/preferences document.
    expect(appTsx).toContain("'users', firebaseUser.uid, 'private', 'preferences'");
  });

  it('logout removes token from previous UID before signOut completes', () => {
    // After signOut, the token is absent from the previous user's Firestore doc.
    // When the next user signs in and calls getToken(), the same browser token is
    // stored only under the new UID — no cross-user association.
    expect(dbTs).toContain("{ fcmToken: deleteField() }");
    expect(dbTs).toContain('.then(() => true).catch(() => false)');
  });

  it('notifyFanout stale-token cleanup does not protect against cross-user association', () => {
    // collectStaleTokens only removes FCM-rejected tokens (invalid/unregistered).
    // A valid token shared between two users would NOT be caught by this mechanism.
    // The logout cleanup above is the correct fix; this test documents the gap.
    const fanout = readFileSync(resolve(root, 'functions/notifyFanout.js'), 'utf-8');
    expect(fanout).toContain('messaging/registration-token-not-registered');
    expect(fanout).toContain('messaging/invalid-registration-token');
    // Confirm there is no cross-user ownership resolution in fanout
    expect(fanout).not.toContain('cross-user');
    expect(fanout).not.toContain('account-switch');
  });
});

// ── Browser-side ownership marker ───────────────────────────────────────────

describe('FCM token — browser-side ownership marker and rotation', () => {
  it('deleteToken is imported from firebase/messaging', () => {
    expect(appTsx).toContain("deleteToken");
    expect(appTsx).toMatch(/import\s*\{[^}]*deleteToken[^}]*\}\s*from\s*['"]firebase\/messaging['"]/);
  });

  it('ownership marker key is parqueen_fcm_owner_uid', () => {
    expect(appTsx).toContain('parqueen_fcm_owner_uid');
    expect(dbTs).toContain('parqueen_fcm_owner_uid');
  });

  it('owner marker is set only after Firestore write succeeds', () => {
    // setItem must appear after setDoc in the source — verifies ordering
    const setDocIdx = appTsx.indexOf("setDoc(doc(db, 'users', firebaseUser.uid, 'private', 'preferences')");
    const setOwnerIdx = appTsx.indexOf("localStorage.setItem('parqueen_fcm_owner_uid'");
    expect(setDocIdx).toBeGreaterThan(-1);
    expect(setOwnerIdx).toBeGreaterThan(-1);
    expect(setOwnerIdx).toBeGreaterThan(setDocIdx);
  });

  it('owner marker never contains the registration token', () => {
    // Only the UID is stored — the token value is never written to localStorage
    expect(appTsx).not.toContain("localStorage.setItem('parqueen_fcm_owner_uid', currentToken");
    expect(appTsx).not.toContain("localStorage.setItem('parqueen_fcm_owner_uid', freshToken");
  });

  it('owner marker value is never logged', () => {
    expect(appTsx).not.toContain("console.log(localStorage.getItem('parqueen_fcm_owner_uid')");
    expect(dbTs).not.toContain("console.log(fcmOwnerUid");
  });

  it('different UID on same browser triggers deleteToken before getToken', () => {
    // ownerMismatch detected → deleteToken called → then getToken for fresh registration
    expect(appTsx).toContain('ownerMismatch');
    expect(appTsx).toContain('deleteToken(messaging)');
    const deleteIdx = appTsx.indexOf('deleteToken(messaging)');
    const getIdx = appTsx.indexOf('getToken(messaging)');
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(getIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeLessThan(getIdx);
  });

  it('legacy installs without owner marker rotate once to establish clean ownership', () => {
    expect(appTsx).toContain('legacyInstall');
    expect(appTsx).toContain('parqueen_fcm_owner_version');
    expect(appTsx).toContain("FCM_OWNER_VERSION = '1'");
  });

  it('same-user sessions do not rotate — ownerMismatch is false when UIDs match', () => {
    // ownerMismatch is only true when storedOwnerUid !== null AND !== firebaseUser.uid
    expect(appTsx).toContain("storedOwnerUid !== null && storedOwnerUid !== firebaseUser.uid");
  });

  it('rotation failure does not associate old token with new UID — entire block is try/catch', () => {
    // If deleteToken or getToken throws, the outer catch skips setDoc and setItem
    const tryIdx = appTsx.indexOf("try {");
    const deleteIdx = appTsx.indexOf('deleteToken(messaging)');
    const setOwnerIdx = appTsx.indexOf("localStorage.setItem('parqueen_fcm_owner_uid'");
    const catchIdx = appTsx.indexOf('FCM setup error');
    expect(tryIdx).toBeLessThan(deleteIdx);
    expect(deleteIdx).toBeLessThan(setOwnerIdx);
    expect(setOwnerIdx).toBeLessThan(catchIdx);
  });

  it('failed logout Firestore cleanup retains owner marker for next account-switch detection', () => {
    // If updateDoc().catch returns false, the marker is restored before signOut
    expect(dbTs).toContain('.then(() => true).catch(() => false)');
    expect(dbTs).toContain('if (!cleaned && fcmOwnerUid !== null)');
    expect(dbTs).toContain("localStorage.setItem('parqueen_fcm_owner_uid', fcmOwnerUid)");
  });

  it('successful logout cleanup does not re-set the owner marker', () => {
    // When cleaned === true the marker stays absent — cleared by localStorage.clear() above
    expect(dbTs).toContain('if (!cleaned && fcmOwnerUid !== null)');
    // Confirm there is no unconditional setItem for parqueen_fcm_owner_uid in database.ts
    expect(dbTs).not.toContain("localStorage.setItem('parqueen_fcm_owner_uid', firebaseUser");
  });

  it('owner marker is captured before localStorage.clear() in logoutUser', () => {
    const captureIdx = dbTs.indexOf("localStorage.getItem('parqueen_fcm_owner_uid')");
    const clearIdx = dbTs.indexOf('localStorage.clear()');
    expect(captureIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeGreaterThan(-1);
    expect(captureIdx).toBeLessThan(clearIdx);
  });

  it('single-device beta limitation: fcmToken is a scalar, second device overwrites first', () => {
    // merge:true writes only the fcmToken key — no array or subcollection of tokens.
    // This is a documented private-beta limitation: one active notification registration per account.
    expect(appTsx).toContain("{ fcmToken: currentToken }, { merge: true }");
    expect(appTsx).not.toContain('fcmTokens'); // no array/collection design
  });
});
