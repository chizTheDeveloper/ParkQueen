# Phone Auth reCAPTCHA Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every phone-auth flow owns and deterministically disposes its own reCAPTCHA verifier so OTP sending works immediately after account deletion without a refresh.

**Architecture:** A stateless shared utility operates on caller-owned refs and never stores a verifier globally. Create Account, Verify Phone resend, and App deletion reauthentication use separate refs and unique DOM containers, with synchronous submission guards and cleanup at every terminal lifecycle boundary.

**Tech Stack:** React 18, TypeScript, Firebase Auth 10.8, Vitest 4, Vite 5.

## Global Constraints

- Do not modify backend account deletion, FCM cleanup, theme/language preservation, Firebase configuration, or any non-Hosting Firebase resource.
- Use English and Spanish retryable expired-verification copy.
- Keep `recaptcha-container`, `recaptcha-resend`, and `reauth-recaptcha-anchor` unique.
- Commit and push only `codex/fix-phone-auth-recaptcha-lifecycle`; do not modify or deploy `main`.

---

### Task 1: Lifecycle utility

**Files:**
- Create: `utils/recaptchaLifecycle.ts`
- Create: `utils/recaptchaLifecycle.test.ts`

**Interfaces:**
- Produces: `clearRecaptchaVerifier(ref): void`
- Produces: `replaceRecaptchaVerifier(ref, auth, containerId, factory?): RecaptchaVerifier`

- [ ] Write behavioral tests for clear/null, clear-before-replace, missing containers, stale refs, independent owners, and Strict Mode cleanup/remount.
- [ ] Run the focused test and confirm it fails because the utility does not exist.
- [ ] Implement the minimal stateless utility with an injectable test factory.
- [ ] Run the focused test and confirm it passes.

### Task 2: Flow ownership and cleanup

**Files:**
- Modify: `views/CreateAccountView.tsx`
- Modify: `views/VerifyPhoneView.tsx`
- Modify: `App.tsx`
- Modify: `i18n.ts`
- Test: `utils/phoneAuthLifecycle.test.ts`

**Interfaces:**
- Consumes: `clearRecaptchaVerifier` and `replaceRecaptchaVerifier` from Task 1.
- Produces: deterministic flow-local verifier lifecycle and synchronous submission guards.

- [ ] Write failing flow tests for cleanup ordering, invalid-app-credential retry, success cleanup, duplicate guards, deletion cleanup, unique IDs, and localization.
- [ ] Run the focused test and confirm the current source fails the lifecycle assertions.
- [ ] Integrate the utility into all three flows with separate refs and containers.
- [ ] Ensure deletion success and cancel call `clearReauthState()` while preserving existing deletion ordering.
- [ ] Add English and Spanish expired-verification copy.
- [ ] Run focused tests and confirm they pass.

### Task 3: Rendered and repository verification

**Files:**
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: completed client fix and tests.
- Produces: evidence-backed integration-ready feature branch.

- [ ] Run a rendered Strict Mode harness or local browser test proving mount/cleanup/remount leaves one verifier owner and failure permits a fresh retry.
- [ ] Run all three Gitleaks scans.
- [ ] Run TypeScript, unit, Rules, Functions integration, Functions syntax, and production build gates.
- [ ] Inspect the production bundle for lifecycle behavior, canonical public configuration, production Mapbox token, CSP, and absence of test bypasses/private credentials.
- [ ] Update `HANDOFF.md` with exact evidence and limitations.
- [ ] Verify the diff, commit only milestone files, push the feature branch, and confirm a clean worktree.
