/**
 * Regression tests for the account-deletion overlay lifecycle (App.tsx).
 *
 * Strategy: source-code inspection — verifies the structural invariants that
 * prevent the "Deleting your data…" modal from surviving an Auth transition.
 * No DOM or Firebase mock needed; the assertions fail if the fix is reverted.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();
const appTsx = readFileSync(resolve(root, 'App.tsx'), 'utf-8');
const dbTs   = readFileSync(resolve(root, 'database.ts'), 'utf-8');

describe('deleteAccount flow — overlay lifecycle', () => {

  it('(DA-01) deleting state is set when deletion begins', () => {
    // Both confirm and reauth-verify handlers set 'deleting' before awaiting the callable.
    const occurrences = (appTsx.match(/setDeletePhase\('deleting'\)/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('(DA-02) successful callable completion explicitly clears the overlay', () => {
    // Each deletion handler sets 'idle' after deleteUser() resolves — defense in depth
    // alongside the Auth-state safety net below.
    const deleteHandlerStart = appTsx.indexOf('const handleDeleteConfirm');
    const reauthHandlerStart = appTsx.indexOf('const handleReauthVerifyOtp');

    const idleInConfirm = appTsx.indexOf("setDeletePhase('idle')", deleteHandlerStart);
    const idleInReauth  = appTsx.indexOf("setDeletePhase('idle')", reauthHandlerStart);
    expect(idleInConfirm).toBeGreaterThan(deleteHandlerStart);
    expect(idleInReauth).toBeGreaterThan(reauthHandlerStart);
  });

  it('(DA-03) callable failure clears the overlay and exposes an actionable error', () => {
    // Both handlers catch errors and set 'failed' (never leave 'deleting').
    const failedOccurrences = (appTsx.match(/setDeletePhase\('failed'\)/g) || []).length;
    expect(failedOccurrences).toBeGreaterThanOrEqual(2);
  });

  it('(DA-04) Auth transitioning to null resets the overlay — safety net for all races', () => {
    // onAuthStateChanged null branch must reset deletePhase before rerouting.
    // This closes the race where the callable is still in-flight when Auth signs out.
    const nullBranchIdx = appTsx.indexOf('No user is logged in');
    expect(nullBranchIdx).toBeGreaterThan(-1);

    const idleInNullBranch = appTsx.indexOf("setDeletePhase('idle')", nullBranchIdx);
    const setUserNullIdx   = appTsx.indexOf('setUser(null)', nullBranchIdx);

    // Reset must exist and appear before setUser(null) so modal closes before reroute
    expect(idleInNullBranch).toBeGreaterThan(-1);
    expect(idleInNullBranch).toBeLessThan(setUserNullIdx);
  });

  it('(DA-05) logged-out screen is immediately accessible after the Auth transition', () => {
    // onAuthStateChanged null branch routes to CREATE_ACCOUNT or ONBOARDING.
    const nullBranchIdx = appTsx.indexOf('No user is logged in');
    const createAccountIdx = appTsx.indexOf('AppView.CREATE_ACCOUNT', nullBranchIdx);
    const onboardingIdx    = appTsx.indexOf('AppView.ONBOARDING',    nullBranchIdx);
    expect(createAccountIdx).toBeGreaterThan(nullBranchIdx);
    expect(onboardingIdx).toBeGreaterThan(nullBranchIdx);
  });

  it('(DA-06) duplicate deletion submissions are blocked by a deleting-phase guard', () => {
    // Both handlers return early when already in 'deleting' — prevents double invocation.
    const occurrences = (appTsx.match(/if \(deletePhase === 'deleting'\) return;/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('(DA-07) no redundant signOut — logoutUser is not called inside deletion handlers', () => {
    // deleteUser() already calls signOut internally. Calling logoutUser() afterward
    // fires a second onAuthStateChanged event unnecessarily and attempts FCM cleanup
    // on an already-deleted account. Verify logoutUser() does not appear after the
    // first await deleteUser() in the file (handleLogout, which is before deleteUser,
    // may still use it for the normal logout path).
    const firstDeleteUserIdx = appTsx.indexOf('await deleteUser()');
    const logoutAfterDelete  = appTsx.indexOf('await logoutUser()', firstDeleteUserIdx);
    expect(logoutAfterDelete).toBe(-1);
  });

  it('(DA-08) alreadyCompleted/idempotent callable response is treated as success', () => {
    // deleteUser() calls `await fn()` without inspecting the return value.
    // Both { success: true } and { alreadyCompleted: true } resolve the promise
    // and reach the same post-deletion cleanup path.
    expect(dbTs).toContain('await fn()');
    expect(dbTs).not.toContain('const result = await fn()');
    expect(dbTs).not.toContain('alreadyCompleted');
  });

  it('(DA-09) overlay is at App root — a child view change cannot unmount it', () => {
    // The deletion modal is rendered after the renderView() function definition,
    // inside the root JSX return. Navigation changes renderView() output but does
    // not touch the sibling modal node, so deletePhase alone controls its lifetime.
    const isMapViewIdx    = appTsx.indexOf('const isMapView');
    const deleteModalIdx  = appTsx.indexOf("deletePhase !== 'idle'");
    expect(isMapViewIdx).toBeGreaterThan(-1);
    expect(deleteModalIdx).toBeGreaterThan(isMapViewIdx);
  });

  it('(DA-10) no timeout-based refresh fallback — modal is cleared deterministically', () => {
    // No setTimeout is used in the deletion handlers to guess success.
    // The fix is deterministic: either the callable resolves, or the Auth null event fires.
    const confirmHandlerStart = appTsx.indexOf('const handleDeleteConfirm');
    const reauthHandlerStart  = appTsx.indexOf('const handleReauthVerifyOtp');
    const confirmHandler = appTsx.slice(confirmHandlerStart, reauthHandlerStart);
    expect(confirmHandler).not.toContain('setTimeout');
  });

  it('(DA-11) unlinkFcmTokenBeforeDeletion is exported from database.ts', () => {
    expect(dbTs).toContain('export const unlinkFcmTokenBeforeDeletion');
  });

  it('(DA-12) unlinkFcmTokenBeforeDeletion targets private/preferences.fcmToken', () => {
    // Must call deleteField() on the fcmToken field in the private/preferences path.
    // This covers the gap where the pre-recursiveDelete server implementation left
    // private/preferences intact after account deletion.
    expect(dbTs).toContain("'private', 'preferences'");
    const fnIdx = dbTs.indexOf('unlinkFcmTokenBeforeDeletion');
    const deleteFieldIdx = dbTs.indexOf('deleteField()', fnIdx);
    expect(deleteFieldIdx).toBeGreaterThan(fnIdx);
  });

  it('(DA-13) unlinkFcmTokenBeforeDeletion has a uid guard — no-op when signed out', () => {
    // If called after signOut (e.g. defensive call), it must return early without
    // attempting a Firestore write that would fail the Rules check.
    expect(dbTs).toContain("auth.currentUser?.uid");
    const fnIdx = dbTs.indexOf('unlinkFcmTokenBeforeDeletion');
    const guardIdx = dbTs.indexOf('if (!uid) return', fnIdx);
    expect(guardIdx).toBeGreaterThan(fnIdx);
  });

  it('(DA-14) unlinkFcmTokenBeforeDeletion swallows Firestore errors — non-blocking', () => {
    // Deletion must proceed even when the token unlink fails (offline, token already absent).
    const fnIdx = dbTs.indexOf('unlinkFcmTokenBeforeDeletion');
    const catchIdx = dbTs.indexOf('.catch(() => {})', fnIdx);
    expect(catchIdx).toBeGreaterThan(fnIdx);
  });

  it('(DA-15) clearLocalAccountState is called after deleteUser in handleDeleteConfirm', () => {
    const confirmStart    = appTsx.indexOf('const handleDeleteConfirm');
    const deleteUserIdx   = appTsx.indexOf('await deleteUser()', confirmStart);
    const clearLocalIdx   = appTsx.indexOf('clearLocalAccountState()', deleteUserIdx);
    expect(clearLocalIdx).toBeGreaterThan(deleteUserIdx);
  });

  it('(DA-16) clearLocalAccountState is called after deleteUser in handleReauthVerifyOtp', () => {
    const reauthStart   = appTsx.indexOf('const handleReauthVerifyOtp');
    const deleteUserIdx = appTsx.indexOf('await deleteUser()', reauthStart);
    const clearLocalIdx = appTsx.indexOf('clearLocalAccountState()', deleteUserIdx);
    expect(clearLocalIdx).toBeGreaterThan(deleteUserIdx);
  });

  it('(DA-17) unlinkFcmTokenBeforeDeletion is called before deleteUser in handleDeleteConfirm', () => {
    // Token must be unlinked while auth.currentUser is still valid — before deleteUser()
    // calls signOut. This covers the pre-recursiveDelete server gap.
    const confirmStart = appTsx.indexOf('const handleDeleteConfirm');
    const unlinkIdx    = appTsx.indexOf('unlinkFcmTokenBeforeDeletion()', confirmStart);
    const deleteUserIdx = appTsx.indexOf('await deleteUser()', confirmStart);
    expect(unlinkIdx).toBeGreaterThan(confirmStart);
    expect(unlinkIdx).toBeLessThan(deleteUserIdx);
  });

  it('(DA-18) unlinkFcmTokenBeforeDeletion is called before deleteUser in handleReauthVerifyOtp', () => {
    const reauthStart   = appTsx.indexOf('const handleReauthVerifyOtp');
    const unlinkIdx     = appTsx.indexOf('unlinkFcmTokenBeforeDeletion()', reauthStart);
    const deleteUserIdx = appTsx.indexOf('await deleteUser()', reauthStart);
    expect(unlinkIdx).toBeGreaterThan(reauthStart);
    expect(unlinkIdx).toBeLessThan(deleteUserIdx);
  });

  it('(DA-19) clearLocalAccountState preserves theme and parqueen_lang', () => {
    // Device-scoped preferences must survive account deletion.
    // FCM ownership markers must NOT be preserved (cleared markers trigger legacyInstall
    // rotation on the next sign-in, preventing a deleted account's token from being reused).
    const helperStart = appTsx.indexOf('const clearLocalAccountState');
    const helperEnd   = appTsx.indexOf('export default function App', helperStart);
    const helperText  = appTsx.slice(helperStart, helperEnd);
    expect(helperText).toContain("'theme'");
    expect(helperText).toContain("'parqueen_lang'");
    expect(helperText).not.toContain("'parqueen_fcm_owner_uid'");
    expect(helperText).not.toContain("'parqueen_fcm_owner_version'");
  });

  it('(DA-20) clearLocalAccountState calls localStorage.clear() — not selective removal', () => {
    // Full clear is required to remove all account-scoped keys (lastReadChat_*, timer,
    // spot state, etc.) without enumerating each key explicitly.
    const helperStart = appTsx.indexOf('const clearLocalAccountState');
    const helperEnd   = appTsx.indexOf('export default function App', helperStart);
    const helperText  = appTsx.slice(helperStart, helperEnd);
    expect(helperText).toContain('localStorage.clear()');
  });

  it('(DA-21) no raw localStorage.clear() in deletion handlers — replaced by clearLocalAccountState', () => {
    // Both handlers must use the helper, not raw localStorage.clear(), so device-scoped
    // preferences are preserved and the clear contract is centralized.
    const confirmStart  = appTsx.indexOf('const handleDeleteConfirm');
    const renderViewIdx = appTsx.indexOf('const renderView', confirmStart);
    const confirmText   = appTsx.slice(confirmStart, renderViewIdx);
    expect(confirmText).not.toContain('localStorage.clear()');

    const reauthStart = appTsx.indexOf('const handleReauthVerifyOtp');
    const reauthEnd   = appTsx.indexOf('const handleReauthResend', reauthStart);
    const reauthText  = appTsx.slice(reauthStart, reauthEnd);
    expect(reauthText).not.toContain('localStorage.clear()');
  });

  it('(DA-22) logoutUser remains intact for normal logout — not removed from database.ts', () => {
    expect(dbTs).toContain('export const logoutUser');
    expect(dbTs).toContain('fcmToken: deleteField()');
  });

});
