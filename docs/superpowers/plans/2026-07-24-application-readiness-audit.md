# ParQueen Application Readiness Audit Implementation Plan

> **For agentic workers:** Execute inline in this session. Each task is an evidence checkpoint; do not deploy, merge, rotate credentials, rewrite history, or modify `main` or `feature/parsona-avatar-creator`.

**Goal:** Produce an evidence-backed application hardening and store-readiness assessment, remediate verified repository-level critical/high risks, and leave a reproducible release gate on `audit/app-store-readiness-2026`.

**Architecture:** Work from an isolated worktree based on the latest `origin/main`. Record evidence before changing behavior, keep policy and risk findings in focused documents, write regression tests before fixes, and checkpoint coherent phases with ordinary commits pushed only to the audit branch.

**Tech Stack:** React 18, TypeScript, Vite, Firebase Auth/Firestore/Functions/Hosting/Storage/Messaging, Mapbox GL JS, Vitest, Firebase Emulator Suite, Expo dependencies without an established native package.

## Global Constraints

- Never deploy Firebase or app-store artifacts.
- Never print, inspect, copy, rotate, or commit credential values.
- Never modify or merge `main` or `feature/parsona-avatar-creator`.
- Preserve the existing dirty Parsona working tree in the original checkout.
- Use current official primary sources for Apple, Google Play, Firebase, Mapbox, and OWASP claims.
- Classify findings as CRITICAL, HIGH, MEDIUM, LOW, or INFORMATIONAL with evidence, impact, remediation, and verification.
- Fix only verified repository-level CRITICAL/HIGH issues that can be safely tested without production access.
- Keep English and Spanish user-facing behavior in parity.
- Run `npx tsc --noEmit`, `npm test`, `npm run build`, and `npm run test:rules` before completion.

---

### Task 1: Reproducible baseline and inventory

**Files:**
- Create: `AUDIT_PROGRESS.md`
- Modify: `package-lock.json` only if a clean `npm ci` proves lockfile repair is required

**Produces:** Exact branch/commit state, toolchain versions, dependency install result, baseline gate totals, repository inventory, and detected packaging targets.

- [ ] Record branch, HEAD, remotes, worktrees, tracked/untracked state, and the untouched Parsona state.
- [ ] Record Node, npm, Firebase CLI, Java, and browser-test tooling versions without reading environment values.
- [ ] Install dependencies using the lockfile and run all four baseline gates.
- [ ] Inventory client, Functions, Rules, indexes, Storage, messaging worker, environment templates, workflows, tests, and native packaging files.
- [ ] Commit and push the reproducibility checkpoint.

### Task 2: Current policy and packaging requirements

**Files:**
- Create: `docs/STORE_SUBMISSION_READINESS.md`
- Update: `AUDIT_PROGRESS.md`

**Produces:** Dated, cited Apple App Store and Google Play requirement matrix plus a factual web/PWA/native packaging decision.

- [ ] Research official Apple review, privacy nutrition labels, account deletion, location, UGC, sign-in, and SDK requirements.
- [ ] Research official Google Play data safety, account deletion, location, UGC, target API, and SDK requirements.
- [ ] Map each requirement to repository evidence and mark pass, gap, not applicable, or provider-console verification required.
- [ ] Document whether the current repository can create reviewable iOS/Android binaries and list the exact missing packaging/signing assets.
- [ ] Commit and push the policy/packaging checkpoint.

### Task 3: Threat model and repository security

**Files:**
- Create: `docs/THREAT_MODEL.md`
- Create or update: `.github/workflows/secret-scan.yml`, `.gitleaks.toml`, dependency workflow/config only if evidence requires it
- Update: `AUDIT_PROGRESS.md`

**Produces:** Trust boundaries, protected assets, attackers, abuse cases, supply-chain posture, and tested prevention controls.

- [ ] Map browser, Firebase services, Functions, third parties, admins, and external data providers.
- [ ] Audit tracked/ignored environment files, bundle-time variables, logs, workflows, dependency scripts, and reachable history without exposing values.
- [ ] Run dependency vulnerability and license checks, classify reachable runtime risk, and test immutable CI permissions.
- [ ] Add the smallest safe secret/dependency controls required by verified gaps.
- [ ] Commit and push the security checkpoint.

### Task 4: Authentication, Firebase, Rules, and backend hardening

**Files:**
- Modify only verified vulnerable files among `firebaseConfig.ts`, `database.ts`, `firestore.rules`, `firestore.indexes.json`, `functions/index.js`, `public/firebase-messaging-sw.js`
- Add focused colocated tests
- Update: `AUDIT_PROGRESS.md`

**Produces:** Evidence for authentication lifecycle, App Check, IAM assumptions, callable authorization, owner/participant isolation, validation, concurrency, indexes, and notification access.

- [ ] Trace phone auth, reauthentication, logout, account deletion, session persistence, and abuse/rate-limit paths.
- [ ] Enumerate every Firestore collection and Storage path with read/write/delete principals and allowed shape.
- [ ] Test cross-user denial, participant isolation, server-owned fields, status transitions, timestamp bounds, and query compatibility.
- [ ] Audit every Function trigger/callable for authentication, authorization, validation, idempotency, retries, secrets, quotas, and log redaction.
- [ ] Implement test-first fixes for verified CRITICAL/HIGH repository defects.
- [ ] Commit and push the Firebase/backend checkpoint.

### Task 5: Core product, moderation, privacy, and AI

**Files:**
- Create: `docs/PRIVACY_DATA_INVENTORY.md`
- Modify product files only for verified CRITICAL/HIGH defects with focused tests
- Update: `AUDIT_PROGRESS.md`

**Produces:** End-to-end Ping, claim, navigation, messaging, reporting, blocking, account deletion, location, AI, and retention evidence.

- [ ] Trace immediate/scheduled Pings, contention, expiry, interest, cancellation, arrival, feedback, Crowns, and history.
- [ ] Verify abuse controls for messaging, reports, blocks, usernames, avatars, listings, and notification spam.
- [ ] Inventory every personal/sensitive field, purpose, storage, processor, retention, deletion, export, and user control.
- [ ] Trace precise/background location and distracted-driving risks with permission-denial behavior.
- [ ] Audit Gemini inputs, outputs, moderation, prompt injection, rate limits, quotas, logging, and user disclosure.
- [ ] Implement test-first fixes for verified CRITICAL/HIGH repository defects.
- [ ] Commit and push the product/privacy checkpoint.

### Task 6: Client quality, performance, reliability, accessibility, and localization

**Files:**
- Create: `docs/PERFORMANCE_AND_COST_BUDGET.md`
- Create: `docs/QA_RELEASE_MATRIX.md`
- Modify client files only for verified CRITICAL/HIGH defects with tests
- Update: `AUDIT_PROGRESS.md`

**Produces:** Measured bundle/runtime budgets, offline/recovery matrix, WCAG review, English/Spanish parity, and cross-device QA coverage.

- [ ] Measure bundle chunks, duplicate dependencies, source maps, asset weight, listener/query fan-out, and avoidable render work.
- [ ] Test offline, reconnect, stale state, denied permissions, Functions failure, Mapbox failure, and global error recovery.
- [ ] Audit keyboard, screen reader semantics, focus, contrast, zoom, reduced motion, touch targets, and error announcements.
- [ ] Compare every English and Spanish key, interpolation, date/time/number unit, truncation, and fallback.
- [ ] Review primary journeys for consistency, destructive confirmations, loading/empty/error states, and safe driving use.
- [ ] Implement test-first fixes for verified CRITICAL/HIGH repository defects.
- [ ] Commit and push the client-quality checkpoint.

### Task 7: Operations, notifications, store materials, cost, and scale

**Files:**
- Create: `docs/RELEASE_OPERATIONS_RUNBOOK.md`
- Update: `docs/STORE_SUBMISSION_READINESS.md`
- Update: `docs/PERFORMANCE_AND_COST_BUDGET.md`
- Update: `AUDIT_PROGRESS.md`

**Produces:** Monitoring and incident plan, notification/deep-link audit, reviewer workflow, monetization compliance status, and launch-load estimates.

- [ ] Inventory logs, alerts, crash/error monitoring, support channels, rollback, feature flags, and ownership.
- [ ] Trace FCM permission, token lifecycle, payload privacy, foreground/background behavior, and deep links.
- [ ] Document required store listing copy, screenshots, reviewer account/OTP access, privacy disclosures, and support URLs.
- [ ] Confirm current monetization/payment scope and document rules that apply before future paid features.
- [ ] Estimate Firestore, Functions, Storage, Messaging, Mapbox, Gemini, SendGrid, and external API cost drivers and abuse ceilings.
- [ ] Commit and push the operations checkpoint.

### Task 8: Read-only Parsona comparison

**Files:**
- Update: `docs/RELEASE_READINESS_AUDIT_2026.md`
- Update: `AUDIT_PROGRESS.md`

**Produces:** A read-only comparison of Parsona branch security/privacy/store effects without checking it out in the audit worktree or modifying it.

- [ ] Compare `origin/main...feature/parsona-avatar-creator` using Git object reads only.
- [ ] Identify release-relevant avatar data, asset, Rules, bundle, accessibility, and privacy changes.
- [ ] Record what must be revalidated if Parsona is later merged.
- [ ] Commit and push the comparison checkpoint.

### Task 9: Final verification and release decision

**Files:**
- Create: `docs/RELEASE_READINESS_AUDIT_2026.md`
- Finalize all required documents and `AUDIT_PROGRESS.md`

**Produces:** Prioritized findings, fixed-vs-open ledger, reproducible gate output, store blockers, launch recommendation, and rollback-ready handoff.

- [ ] Re-run secret scans, dependency checks, unit tests, Rules tests, type-check, production build, and targeted static searches.
- [ ] Verify no credential values, production writes, deployments, main changes, or Parsona changes occurred.
- [ ] Verify each of the 28 requested phases has evidence and each required document is complete.
- [ ] Commit and push the final audit checkpoint.
- [ ] Report exact HEAD, tests, warnings, residual blockers, and next milestone.
