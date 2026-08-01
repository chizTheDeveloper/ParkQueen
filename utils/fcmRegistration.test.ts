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
    expect(appTsx).toContain("}, { merge: true }).catch(e => console.warn('FCM save error', e))");
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
    // .catch(() => {}) on the updateDoc call ensures signOut proceeds even if
    // the write fails (offline, missing preferences doc, network error).
    expect(dbTs).toContain('.catch(() => {})');
    // signOut still runs after the catch
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
    expect(dbTs).toContain('.catch(() => {})');
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
