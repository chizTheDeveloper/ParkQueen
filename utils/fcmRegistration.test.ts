import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();
const appTsx = readFileSync(resolve(root, 'App.tsx'), 'utf-8');

// ── Upsert instead of update-only ──────────────────────────────────────────

describe('FCM token registration — upsert semantics', () => {
  it('uses setDoc with merge:true to register the FCM token', () => {
    // setDoc + merge:true creates private/preferences when missing, updates when present.
    // The old updateDoc-only path failed with "No document to update" for new users.
    expect(appTsx).toContain("setDoc(doc(db, 'users', firebaseUser.uid, 'private', 'preferences'), { fcmToken: currentToken }, { merge: true })");
  });

  it('does not use updateDoc for the FCM registration write', () => {
    // Confirm the previous failing pattern was removed.
    // updateDoc for other unrelated fields is permitted; only the FCM-specific call is checked.
    expect(appTsx).not.toContain("updateDoc(doc(db, 'users', firebaseUser.uid, 'private', 'preferences'), { fcmToken:");
  });

  it('a missing private/preferences document can be created via setDoc merge', () => {
    // setDoc with merge:true is equivalent to create-or-update — safe for first-time users.
    // The Rules allow write for owner on private/preferences covering both create and update.
    expect(appTsx).toContain("{ merge: true }");
  });

  it('existing preference fields are preserved — only fcmToken is specified in the write', () => {
    // merge:true means only the listed keys are touched; notificationRadius, lang, etc. remain.
    expect(appTsx).toContain("{ fcmToken: currentToken }, { merge: true }");
  });

  it('FCM token is never written to the public root user document', () => {
    // Token must only go to users/{uid}/private/preferences — never to users/{uid}.
    // Check that no updateDoc/setDoc call targets the root doc with fcmToken.
    expect(appTsx).not.toMatch(/updateDoc\(doc\(db,\s*['"]users['"]\s*,\s*\w+\s*\)\s*,\s*\{[^}]*fcmToken/);
    expect(appTsx).not.toMatch(/setDoc\(doc\(db,\s*['"]users['"]\s*,\s*\w+\s*\)\s*,\s*\{[^}]*fcmToken/);
  });

  it('FCM token value is never logged', () => {
    // Tokens must not appear in console.log/warn/error calls alongside currentToken.
    // The error handler only logs 'FCM save error', not the token value.
    expect(appTsx).not.toContain('console.log(currentToken');
    expect(appTsx).not.toContain('console.warn(currentToken');
    expect(appTsx).not.toContain('console.error(currentToken');
  });

  it('errors are handled without an uncaught rejection', () => {
    // .catch() must be chained directly on the setDoc promise.
    expect(appTsx).toContain("}, { merge: true }).catch(e => console.warn('FCM save error', e))");
  });
});

// ── Logout behavior ─────────────────────────────────────────────────────────

describe('FCM token — logout behavior', () => {
  it('logout clears account-scoped browser state and signs out', () => {
    // logoutUser clears localStorage and calls signOut; it does not delete
    // the device FCM registration (intentional: preserves notification capability
    // across the session gap; stale tokens are cleaned up server-side by notifyFanout).
    const dbTs = readFileSync(resolve(root, 'database.ts'), 'utf-8');
    expect(dbTs).toContain('localStorage.clear()');
    expect(dbTs).toContain('signOut(auth)');
  });

  it('FCM token is scoped to private/preferences — account switching is safe', () => {
    // Each user writes their own token to their own private/preferences document.
    // The new user's setDoc targets their own UID, not the previous user's document.
    expect(appTsx).toContain("'users', firebaseUser.uid, 'private', 'preferences'");
  });
});
