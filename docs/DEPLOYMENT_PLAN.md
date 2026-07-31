# ParQueen — Production Deployment Plan

Assessment date: 2026-07-31  
Main branch: `20d8d9e`  
Last production Hosting deployment: 2026-07-24 00:15:33 (pre-audit)  
Status: **PENDING APPROVAL — do not execute without explicit authorization**

---

## Phase 3 — Deployment reconciliation matrix

Read-only comparison of `main` source vs current Firebase production environment.

### 3.1 Firebase Hosting

| Item | Deployed state | Source state | Delta |
|---|---|---|---|
| Build artifacts | Pre-audit build (2026-07-24) | Audit-hardened source; `dist/` from clean `npm run build` | Full redeployment required |
| Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) | **None** | All present in `firebase.json` `hosting.headers` | Not yet live |
| `Content-Security-Policy-Report-Only` | **None** | Full directive set in `firebase.json` (TM-22 partial fix) | Not yet live |
| Cache-Control (`immutable` for `*.js/css/woff2`; `no-cache` for `/index.html`) | Unknown | Present in `firebase.json` | Not yet live |
| SPA rewrite (`**` → `/index.html`) | Present | Present | Verify on redeployment |
| `functions` source target | `functions/` | `functions/` | Unchanged |

**Blocker**: None. Hosting deployment blocked only by sequencing (deploy after Firestore Rules — see Phase 4).

### 3.2 Firestore Rules

| Item | Deployed state | Source state | Delta |
|---|---|---|---|
| `firestore.rules` | Pre-audit rules (deployed before 2026-07-24 audit merge) | 499-line audit-hardened rules; 165 emulator tests passing | Full redeployment required |
| Chat participant isolation (TM-01) | Not deployed | `chats/{chatId}`: participant-only read/update/delete; exact field schema on create/update; immutable participants | Pending |
| Feedback replay prevention (TM-02) | Not deployed | `spotFeedback`: occupied Ping required, deterministic one-time ID, immutable document | Pending |
| Notification spoofing prevention (TM-03) | Not deployed | `spotNotifications`: exact shape/type, bounded content/time, sender attribution, Ping existence check | Pending |
| Public user-directory restriction (TM-04 partial) | Not deployed | `users/{uid}` denylist includes `phone` and `email`; `private/account` subcollection owner-only | Pending |
| Listings client-write disable (TM-07) | Not deployed | `listings`: `allow write: if false` | Pending |
| Reports identity binding (TM-08) | Not deployed | `reports`: `reporterId` bound to `request.auth.uid`, exact schema | Pending |
| `accountDeletionJobs/{uid}` (server-write only) | Not deployed | `allow read: if request.auth.uid == uid; allow write: if false` | Pending |
| `rateLimits` (deny all client access) | Not deployed | `allow read, write: if false` | Pending |

**Blocker**: None. Must deploy before Hosting (new client reads `users/{uid}/private/account` which requires audit Rules to permit owner read).

### 3.3 Firestore Indexes

| Item | Deployed state | Source state | Delta |
|---|---|---|---|
| `firestore.indexes.json` | Likely deployed — last source commit `b267d69` predates audit; no audit changes to this file | 10 composite indexes, 3 field override exemptions | Likely in sync; console verification recommended |

**Blocker**: None. Deploy is additive; safe to run as verification step even if already deployed.

### 3.4 Storage Rules

| Item | Deployed state | Source state | Delta |
|---|---|---|---|
| `storage.rules` | **None** (no storage rules in repository before audit) | 54-line owner-only rules: `avatars/{uid}`, `avatarUploads/{uid}/{uploadId}/original`, `avatarCandidates/`, catch-all deny; 5 MB cap; `image/*` content-type | Not yet deployed |

**Blocker: AV-02 staging overwrite test must complete before Storage Rules are deployed.** The AV-02 test verifies that a new upload correctly overwrites the candidate path and that the old download token is revoked. This test requires a staging Firebase project or emulator that mirrors the production Storage bucket layout.

### 3.5 Cloud Functions

All functions: nodejs20, us-central1, v2. Baseline: audit-hardened `functions/index.js` in `main`.

| Function | Deployed state | Delta | Risk if left at pre-audit code |
|---|---|---|---|
| `generateEmailOTP` | **Audit code ✓** (redeployed 2026-07-31, `SENDGRID_API_KEY` v2 bound) | In sync | — |
| `verifyEmailOTP` | Pre-audit | Outdated — writes email to `users/{uid}` root instead of `private/account` | Email written to public user doc (TM-24) |
| `deleteAccount` | Pre-audit | Outdated — deletes only Auth, root user doc, username reservation | Linked Pings, chats, feedback, avatars, private subcollections NOT deleted (TM-05) |
| `bootstrapAdmin` | Pre-audit | Outdated — no transaction; concurrent race possible | TM-14 race condition (low probability) |
| `moderateAvatarUpload` | Pre-audit | Outdated — no pendingUploadId guard, no step tracking | TM-28 race condition |
| `analyzeSign` | Pre-audit | Outdated — no `sanitizeError` | TM-17 residual (now closed in source) |
| `generateSmartReplies` | Pre-audit | Outdated — no `lastMessage`/`context` size bounds | TM-25 open |
| `moderateContent` | Pre-audit | Outdated — no rate limit (60/hr per UID added in Phase J) | TM-13 gap |
| `createSegmentFromSweepNYC` | Pre-audit | Outdated — no rate limit (30/hr per UID added in Phase J) | TM-13 gap |
| `generateListingDescription` | Pre-audit | Outdated — no rate limit (20/hr per UID added in Phase J) | TM-13 gap |
| `claimUsername` | Pre-audit | Outdated — missing Phase J rate-limit additions | TM-13 gap |
| `sendPingNotification` | Pre-audit | Outdated — no `sanitizeError` at error paths | TM-17 residual |
| `sendChatMessage` | Pre-audit | Outdated | TM-17 residual |
| `reportUser` | Pre-audit | Outdated | TM-17 residual |
| `updateFCMToken` | Pre-audit | Outdated | TM-17 residual |
| `setStaffRole` | Pre-audit | Outdated | TM-17 residual |
| `adminSuspendUser` | Pre-audit | Outdated | TM-17 residual |
| `adminUnsuspendUser` | Pre-audit | Outdated | TM-17 residual |
| `adminUpdateReport` | Pre-audit | Outdated | TM-17 residual |
| `adminUpdateSegmentStatus` | Pre-audit | Outdated | TM-17 residual |
| `adminArchiveSuspension` | Pre-audit | Outdated | TM-17 residual |
| `cleanAvatarOrphans` | **NOT DEPLOYED** | First deployment required (scheduled, every 24 h) | TM-29 orphaned Storage objects accumulate |
| `initUserPrivateAccount` | **NOT DEPLOYED** | First deployment required | New-user private subcollection not initialized |
| Remaining Firestore/background triggers (~12) | Pre-audit | Outdated | TM-17 residual at error paths |

**Summary**: 1 function in sync (`generateEmailOTP`), 2 need first deployment (`initUserPrivateAccount`, `cleanAvatarOrphans`), ~33 need redeployment to pick up audit changes. Deploy all functions together to minimize version skew.

**Blocker**: None for functions. `firebase deploy --only functions` deploys all exports in `functions/index.js` atomically.

### 3.6 App Check

| Item | Current state | Source state | Blocker |
|---|---|---|---|
| Provider registration | Not registered | N/A | **BLOCKED — register app in Firebase Console → App Check → Apps** |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | Not created | `initializeAppCheck` gated on this env var; debug-token path DEV-only | **BLOCKED — requires site key from provider registration** |
| Client-side App Check init | Not active in production | `firebaseConfig.ts` has `initializeAppCheck` with `ReCaptchaEnterpriseProvider` | Active only once env var is present in production build |
| Enforcement | Not enabled | `enforceAppCheck: false` on all callables | **BLOCKED — do not enable until metrics show <5% invalid token rate; see `docs/APP_CHECK_ROLLOUT.md`** |

### 3.7 Secret Manager

| Secret | Current state | Action required |
|---|---|---|
| `SENDGRID_API_KEY` | Version 2 deployed; `generateEmailOTP` bound; old version revoked | None — complete ✓ |
| `EMAIL_RATE_LIMIT_PEPPER` | Deployed; `generateEmailOTP` bound | None — no change |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | Does not exist | Create after App Check provider registration; add to `.env.production` |

### 3.8 Data migration

| Migration | State | Trigger condition | Blocker |
|---|---|---|---|
| `privatizeContactFields.ts` — move `phone`/`email` from `users/{uid}` to `users/{uid}/private/account` | Dry-run only; apply mode NOT run | Run AFTER Firestore Rules deployment confirms `private/account` subcollection rules are live | **BLOCKED — explicit production migration approval required** |

Run command (after approval):
```
npx ts-node utils/migration/privatizeContactFields.ts --apply
```

Dry-run first (always safe):
```
npx ts-node utils/migration/privatizeContactFields.ts
```

### 3.9 Security headers summary

Security headers are delivered via Hosting. All headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP-Report-Only) will go live automatically when Hosting is redeployed (Section 3.1). No separate deployment step is needed.

---

## Phase 4 — Staged rollout plan

**STOP: Do not execute any deployment. This plan requires explicit authorization before proceeding.**

### 4.1 Sequencing rationale

1. **Firestore indexes first** — additive-only; no impact on clients or Rules; safe to verify at any time.
2. **Functions second** — new function code must be live before new Firestore Rules take effect to avoid a gap where Admin SDK writes (e.g., `accountDeletionJobs/{uid}`) are being made by old code against new paths, and before new callable behavior is available to the new client.
3. **Firestore Rules third** — deploy after Functions so the new Rules are checked against a codebase that already handles the stricter paths. Old client code between Functions and Hosting will briefly encounter new Rules — the only writes old clients make that new Rules deny are `phone`/`email` writes to `users/{uid}` root doc (TM-24 fix). During this window, profile saves that include email may silently fail the email-field write. This is acceptable for private beta; minimize the window by deploying Hosting immediately after.
4. **Hosting fourth** — new client code complies with new Rules; `private/account` subcollection reads work; security headers go live.
5. **Storage Rules** — **BLOCKED on AV-02**; deploy in a separate session after AV-02 passes.
6. **App Check** — **BLOCKED on provider enrollment and metrics monitoring**.
7. **Data migration** — **BLOCKED on explicit approval**; run after Firestore Rules are confirmed live.

### 4.2 Pre-deployment checklist (run from `main-merge` worktree)

```powershell
# 1. Confirm main is at expected SHA
git log --oneline -1
# Expected: 20d8d9e docs: Phase L — credential security events and TM-19 update

# 2. Clean dependency install
Remove-Item -Recurse -Force node_modules, functions/node_modules -ErrorAction SilentlyContinue
npm ci
npm ci --prefix functions

# 3. Quality gates
npx tsc --noEmit                    # expect: 0 errors
npm test                            # expect: ≥797 tests, all pass
npm run test:rules                  # expect: 165 tests, all pass
node --check functions/index.js     # expect: parse OK

# 4. Build
npm run build                       # expect: no errors; dist/ produced

# 5. Firebase project confirmation
firebase use --add                  # confirm project: parkqueen-46475363-ccf36
```

### 4.3 Batch 1 — Firestore indexes (verification)

```bash
firebase deploy --only firestore:indexes --project parkqueen-46475363-ccf36
```

**Expected outcome**: "10 indexes deployed" or "indexes already up to date."  
**Post-check**: Firebase Console → Firestore → Indexes — confirm all 10 composite indexes and 3 field overrides show status READY.  
**Rollback**: N/A — index deployment is additive.  
**Stop condition**: If Firebase reports index creation errors, investigate before proceeding.

### 4.4 Batch 2 — Functions (all)

```bash
firebase deploy --only functions --project parkqueen-46475363-ccf36
```

**Expected outcome**: All 35 functions deployed, including `initUserPrivateAccount` and `cleanAvatarOrphans` for the first time.  
**Post-checks**:
```bash
firebase functions:list --project parkqueen-46475363-ccf36
# Verify: initUserPrivateAccount present, cleanAvatarOrphans present
# Verify: generateEmailOTP still shows us-central1, nodejs20

# Smoke test OTP flow (already verified working post-SendGrid rotation):
# Generate OTP → verify OTP → confirm email appears in private subcollection
```

**Rollback**:
```bash
git checkout <previous-functions-sha> -- functions/index.js
firebase deploy --only functions --project parkqueen-46475363-ccf36
```

**Stop conditions**:
- Any function fails to deploy (parse error or IAM issue) — investigate before Firestore Rules
- `generateEmailOTP` stops working after redeployment — verify `SENDGRID_API_KEY` secret binding intact
- `cleanAvatarOrphans` or `initUserPrivateAccount` deployment errors — investigate; these are new functions

### 4.5 Batch 3 — Firestore Rules

```bash
# Final pre-deploy test
npm run test:rules

firebase deploy --only firestore:rules --project parkqueen-46475363-ccf36
```

**Expected outcome**: "Cloud Firestore rules updated."  
**Post-checks** (run within 10 minutes of deployment):
```
# In Firebase Console → Firestore → Rules — verify new rules are live
# Smoke test cross-user isolation:
# 1. Sign in as user A → attempt to read another user's chat → expect PERMISSION_DENIED
# 2. Sign in as user B → create a Ping → confirm shape validation passes
# 3. Verify OTP flow still works (reads private/account subcollection)
```

**Rollback**:
```bash
git show <previous-rules-sha>:firestore.rules > firestore.rules
firebase deploy --only firestore:rules --project parkqueen-46475363-ccf36
```

**Stop conditions**:
- PERMISSION_DENIED errors for legitimate user operations (sign-in, Ping create, OTP flow)
- Any critical function in Firebase Console → Functions logs shows unexpected rules-rejection errors
- Firestore Console → Usage shows error spike

### 4.6 Batch 4 — Hosting

Deploy immediately after Batch 3 (minimize window where old client + new Rules coexist).

```bash
npm run build
firebase deploy --only hosting --project parkqueen-46475363-ccf36
```

**Expected outcome**: "Hosting URL: https://parkqueen-46475363-ccf36.web.app"  
**Post-checks**:
```
1. Visit https://parkqueen-46475363-ccf36.web.app — confirm app loads
2. Sign in via phone OTP — confirm auth flow works
3. Open browser DevTools → Console — confirm no CSP-Report-Only violations for normal flows
4. Open browser DevTools → Network — confirm response headers include:
   Strict-Transport-Security: max-age=31536000; includeSubDomains
   X-Content-Type-Options: nosniff
   X-Frame-Options: DENY
5. Generate email OTP — confirm email OTP works end-to-end
6. Create a test Ping — confirm Firestore write succeeds under new Rules
```

**Rollback**:
```bash
# Option A: redeploy from prior build artifact via Firebase Console → Hosting → Release history → Roll back
# Option B: git checkout <pre-audit-hosting-commit> && npm run build && firebase deploy --only hosting
```

**Stop conditions**:
- App fails to load (white screen, 404, SPA rewrite failure)
- Auth flow broken (phone OTP, email OTP)
- Major feature broken (Ping create/claim, chat, profile)

### 4.7 Batch 5 — Storage Rules (BLOCKED)

**Do not deploy until AV-02 staging overwrite test passes.**

When AV-02 is complete:
```bash
firebase deploy --only storage --project parkqueen-46475363-ccf36
```

**AV-02 test requirements**: Follow the 6-step Avatar download-token rotation procedure in `docs/STORE_SUBMISSION_READINESS.md §Avatar download-token rotation`. Both upload and deletion token-revocation steps must pass in staging before production deployment.

### 4.8 App Check activation (BLOCKED)

**Do not activate until Batches 1–4 are stable and metrics are monitored.**

When provider enrollment is complete:
1. Register app in Firebase Console → App Check → Apps (reCAPTCHA Enterprise)
2. Add `VITE_FIREBASE_APPCHECK_SITE_KEY=<site-key>` to `.env.production` (do not commit)
3. Rebuild and redeploy Hosting
4. Monitor Firebase Console → App Check → Metrics for ≥48 hours
5. Only if invalid-token rate is <5% across all callables: follow `docs/APP_CHECK_ROLLOUT.md` to enable `enforceAppCheck: true` per callable

### 4.9 Data migration (BLOCKED)

**Do not run until explicit production migration approval is granted.**

After approval and after Firestore Rules (Batch 3) are confirmed live:
```bash
# Dry-run first (always safe, reads only):
npx ts-node utils/migration/privatizeContactFields.ts

# Apply (requires explicit operator authorization):
npx ts-node utils/migration/privatizeContactFields.ts --apply
```

**Rollback**: Re-add `email` to `users/{uid}` root doc from `private/account` subcollection. Re-add `phone` from `auth.currentUser.phoneNumber`. A reverse migration script would be needed; plan before running apply mode.

---

## Deployment summary

| Target | CLI command | Batch | Blocker |
|---|---|---|---|
| Firestore indexes | `firebase deploy --only firestore:indexes` | 1 | None |
| Functions (all 35) | `firebase deploy --only functions` | 2 | None |
| Firestore Rules | `firebase deploy --only firestore:rules` | 3 | None |
| Hosting | `firebase deploy --only hosting` | 4 | None |
| Storage Rules | `firebase deploy --only storage` | 5 | AV-02 staging test |
| App Check (enforce) | Console + env + redeploy | 6 | Provider enrollment + metrics |
| Data migration | `ts-node privatizeContactFields.ts --apply` | 7 | Explicit approval |

**All-targets-unblocked command** (do not run until all pre-deployment checks pass and this plan is approved):
```bash
firebase deploy --only firestore:indexes,functions,firestore:rules,hosting \
  --project parkqueen-46475363-ccf36
```

---

**STOP. Await explicit deployment authorization before executing any Firebase CLI deploy command.**
