# Phone Auth reCAPTCHA Lifecycle Design

## Problem

Phone authentication can fail with `auth/invalid-app-credential` immediately after account deletion. The client leaks flow-owned `RecaptchaVerifier` instances: Create Account nulls its ref during cleanup without clearing the verifier, which leaks a widget during React Strict Mode's development mount cycle, and successful deletion hides the reauthentication modal without clearing the App-level verifier or confirmation state.

## Design

Add a small ref-based lifecycle utility that accepts a verifier ref, container ID, Auth instance, and optional verifier factory. It will:

- clear harmlessly and set the ref to `null`;
- clear before every replacement;
- reject creation when the flow's unique container is absent;
- create and return one verifier owned exclusively by the caller;
- provide no module-level or global verifier state.

Create Account, Verify Phone resend, and deletion reauthentication retain separate refs and unique container IDs. Each flow clears on unmount, after a failed request, after a successful OTP send once its `ConfirmationResult` is stored, and after successful confirmation. Synchronous refs block duplicate send/verify actions before React state updates render.

Deletion success and cancellation call the existing `clearReauthState()` path so the verifier, confirmation, OTP, and cooldown are disposed without altering backend deletion, FCM unlinking, local account cleanup, theme, or language behavior.

## Error handling

`auth/invalid-app-credential`, expired app credentials, and missing/invalid verifier failures receive localized English and Spanish retryable copy: “Verification expired. Please try sending the code again.” Existing invalid-number and throttling messages remain unchanged. Internal Firebase configuration details are not shown to users.

## Testing

Behavioral tests exercise the utility with fake verifier objects and an injected factory, proving clear-before-replace, null-after-clear, missing-container rejection, stale-cleared-ref replacement, independent ownership, and Strict Mode-style cleanup/remount. Flow-level tests verify failure/success cleanup ordering, synchronous duplicate guards, deletion-state cleanup, unique IDs, and localized copy. Existing deletion, FCM, theme, and language regression tests remain in the full suite.

No Firebase backend target or provider configuration changes are in scope.
