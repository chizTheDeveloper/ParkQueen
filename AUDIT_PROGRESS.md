# ParQueen 2026 Application Readiness Audit Progress

Audit branch: `audit/app-store-readiness-2026`  
Baseline commit: `b761795c52056c0d940da31969a142a7cdcd46a8`  
Started: 2026-07-24  
Deployment status: prohibited; none performed

## Safety checkpoint

- The audit runs in `.audit-worktrees/parqueen-store-audit`, an isolated Git worktree created from `origin/main`.
- The original `feature/parsona-avatar-creator` checkout remains at `c2daee55b6fbe91e422ee1ce859f32333da175af`.
- Its pre-existing five modified and three untracked DEV-only Parsona files were verified unchanged after worktree creation.
- The nested audit-worktree directory is excluded through local Git metadata, not a tracked ignore rule.
- No secrets were read, printed, copied, rotated, or changed.
- No Firebase resource or application artifact has been deployed.

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| 0 — Baseline, inventory, reproducibility | Complete | Clean audit branch, inventory, toolchain, clean-install failure, and baseline gates captured |
| 1 — Store policy/platform requirements | Complete | Dated official-source matrix in `docs/STORE_SUBMISSION_READINESS.md` |
| 2 — Mobile architecture/packaging | Complete | Vite web app; no reproducible iOS/Android package, native projects, manifests, signing, or release pipeline |
| 3 — Threat model | Complete, evolves with findings | `docs/THREAT_MODEL.md` |
| 4 — Secrets/supply chain | Complete | `docs/DEPENDENCY_AND_SDK_INVENTORY.md`; peer conflict resolved; vulnerability baseline documented |
| 5 — Authentication/account security | Complete | BLK-03 (deleteAccount covers all collections + Storage) and BLK-05 (phone/email moved to private subcollection) fixed in source; migration utility added |
| 6 — App Check/Functions/IAM | In progress | App Check absent in source; console verification pending; BLK-03 callable extended with idempotent deletion job |
| 7 — Firestore/Rules/indexes/concurrency | Complete | Chat, feedback/reward, and notification vulnerabilities fixed; BLK-02 coverage added (C7, N5, N6, F10); 81 Rules tests pass |
| 8 — Client security | Complete | BLK-01 fixed (voice agent script removed from index.html); BLK-04 fixed (CSP report-only in firebase.json); securityAssertions and cspConfig test suites added |
| 9 — Bundle/performance | Complete | `docs/PERFORMANCE_AND_COST_BUDGET.md`; StreetParkingView chunk 1.8 MB, main bundle 927 kB |
| 10 — Privacy/retention/deletion | Complete | `docs/PRIVACY_DATA_INVENTORY.md`; deletion gap documented (TM-05); phone in public doc (TM-24) |
| 11 — Functions audit | Complete | App Check absent (TM-12), smart-reply no bounds (TM-25), bootstrap race (TM-14), `deleteAccount` gap (FN-06) |
| 12 — Storage audit | Complete | No `storage.rules` in repo (TM-06); avatar upload active without known rules |
| 13 — Architecture | Complete | Duplicate firebase config files, `firebase-admin` in root deps, dormant Expo/RN, Tailwind CDN |
| 14 — Release readiness | Complete | `docs/RELEASE_READINESS_AUDIT_2026.md`; 5 blocking items identified |
| 15 — QA matrix | Complete | `docs/QA_RELEASE_MATRIX.md`; 12 gates, 80+ scenarios |
| 16 — Release operations | Complete | `docs/RELEASE_OPERATIONS_RUNBOOK.md`; deploy, rollback, break-glass procedures |
| 17 — Threat model update | Complete | TM-21 through TM-26 added; 26 total items |

## Initial repository facts

- Client: React 18 + TypeScript + Vite.
- Backend: Firebase Auth, Firestore, Cloud Functions, Hosting, Storage, and Messaging.
- Mapping: Mapbox GL JS.
- Tests: Vitest plus Firebase Rules Unit Testing through the Firestore emulator.
- Native packaging evidence found in the initial tracked-file inventory: no `ios/`, `android/`, `app.json`, `app.config.*`, `eas.json`, or Capacitor configuration.
- Toolchain observed: Node `24.18.0`, npm `11.16.0`, OpenJDK `21.0.11`. The Firebase CLI version command could not read its user-level config inside the restricted environment; Rules execution succeeded with an isolated temporary config directory.

## Baseline reproducibility and quality gates

### Clean dependency installation

`npm ci` fails consistently before creating `node_modules`:

- Installed application SDK declared by the lockfile: Firebase `10.14.1`.
- Rules test library declared by the lockfile: `@firebase/rules-unit-testing` `5.0.1`.
- The test library's committed peer constraint: Firebase `^12.0.0`.
- npm 11 correctly rejects that incompatible peer graph with `ERESOLVE`.
- Git history traces the mismatch to commit `b267d69`, where Rules tests were introduced with version `5.0.1` while the application remained on Firebase 10.
- Firebase's release history associates `@firebase/rules-unit-testing` `3.0.4` with the Firebase 10.12 release line. A registry-backed compatibility update could not be completed because network package resolution was unavailable; no package file was changed.

Severity: **HIGH — release reproducibility**. A fresh CI runner or reviewer clone cannot install the project using the committed lockfile. Do not use `--force` or `--legacy-peer-deps` as a release fix; select and verify the compatible Rules-test version, regenerate the lockfile, run `npm ci`, then execute the complete Rules suite.

### Existing-tree measurement

To measure the current source independently of the install blocker, the audit worktree used a local ignored junction to the original checkout's existing `node_modules`. This is test scaffolding only and is not a reproducibility pass.

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 18 files, 672 tests |
| `npm run build` | PASS — 1,673 modules |
| `npm run test:rules` | PASS — 1 file, 58 tests |

Warnings captured:

- Vite's CJS Node API is deprecated.
- React plugin options reference deprecated esbuild/optimization settings.
- Firebase Firestore is both statically and dynamically imported, so the dynamic import does not create a separate chunk.
- Main application chunk: `927.01 kB` minified (`232.92 kB` gzip).
- Street Parking chunk: `1,867.32 kB` minified (`510.42 kB` gzip).
- Rules execution was unauthenticated and attempted an unavailable metadata lookup after the successful emulator run; no production service was contacted or changed.

## Security remediation checkpoint

Test-first changes completed locally on the audit branch:

- Chat documents and messages are now readable/writable only by participants.
- Chat participants and deterministic chat identity cannot be changed after creation.
- Message sender identity must equal the authenticated participant; text is bounded.
- Successful/failed feedback must map to the real finder/claimer of an occupied Ping.
- Feedback uses one deterministic immutable document per Ping+driver, preventing reward replay through duplicate client writes.
- In-app notifications require exact bounded data, sender attribution, a live Ping document, and a real finder↔claimer relationship.

Fresh focused verification:

- TypeScript: PASS.
- Unit tests: 19 files, 674 tests PASS.
- Firestore Rules: 70 tests PASS.

These Rules and client changes have **not** been deployed.

## Phase C — BLK remediation checkpoint

All five source-level blockers closed on `audit/app-store-readiness-2026`. No deployment performed.

### Commits

| Commit | Message |
|---|---|
| `dd4c6f7` | `security: remove unapproved third-party script from index.html` |
| `56434cb` | `privacy: isolate phone and email to private user subcollection` |
| `2d8d0cc` | `privacy: complete account deletion — all linked collections and Storage` |
| `608cbb5` | `security: add Firebase Hosting security headers with CSP report-only` |
| `dbe8754` | `test: add missing Rules coverage for BLK-02 review (C7, N5, N6, F10)` |

### Quality gates after remediation

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 21 files, 686 tests |
| `npm run build` | PASS |
| `npm run test:rules` | PASS — 81 tests |
| `grep -rl "voiceagent\|acme-corp" dist/` | PASS — no matches |

### Threat model triage after Phase C

| Open CRITICAL | 0 |
|---|---|
| Open HIGH | 4 (TM-04, 06, 12, 13) |
| Open MEDIUM | 2 (TM-16 SHA pinning, TM-17) |
| Open LOW | 0 |
| Blocked/external | 3 (TM-19 credentials, TM-20 native packaging, console-only: TM-12) |

Closed this pass (commit `93aa02b`): TM-05 defects (auth_time, requiredStep, batch pagination, moderationLog), TM-07, TM-08, TM-09, TM-10, TM-11, TM-14, TM-23, TM-25.

### Manual actions still required (after Phase C)

- BLK-02: authorized deployment of Firestore Rules (see deployment plan in `docs/RELEASE_READINESS_AUDIT_2026.md`)
- TM-06: export `storage.rules` from Firebase console and commit
- TM-12: App Check enrollment decision
- TM-16: pin `actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-java@v4` to commit SHAs
- TM-17: audit and redact sensitive Function log statements
- TM-19: credential rotation verification via provider metadata
- Production data migration: run `utils/migration/privatizeContactFields.ts` in apply mode with admin credentials post-deployment
- Legal sign-off on `adminAuditLog` and `moderationLog` retention categories

## Phase D — Security hardening checkpoint (2026-07-25)

Resumed from interrupted session. Completed all remaining 10-step hardening items for the account-deletion and emulator pass.

### Commits

| Commit | Message |
|---|---|
| `955582c` | `security: threat model update and audit progress checkpoint` |
| `c44d3b7` | `security: complete retry-safe account deletion and emulator coverage` |

### Work completed

**Integration test hardening (zero skipped tests):**
- Replaced `it.skip('FN-02')` with direct-handler tests via `deleteAccount.run()`:
  - FN-02a: stale `auth_time` (700 s) rejected
  - FN-02b: `undefined` `auth_time` rejected — closes NaN-bypass (was `NaN > 600 = false`)
  - FN-02c: `null` `auth_time` rejected
  - FN-14: monkey-patch `db.recursiveDelete` to inject step failure; asserts Auth user NOT deleted and job in `failed` state
- `callDirect()` helper added — bypasses HTTP/JWT to inject arbitrary token claims

**Bug fixes in functions/index.js:**
- `auth_time` undefined/null bypass: added `!authTime ||` guard before the `> 600` check
- Storage prefix bug: `deleteAccount` used `prefix: avatars/{uid}/` (trailing slash), silently missing the actual file at `avatars/{uid}`; fixed by removing trailing slash

**Storage rules:**
- `storage.rules` created: `match /avatars/{uid}` (direct) + `match /avatars/{uid}/{allPaths=**}` (subdirectory); `isOwner`/`isValidAvatar` helpers; catch-all deny
- `firebase.json`: storage emulator port 9199 added

**In-app phone OTP reauthentication (App.tsx):**
- State machine: `reauth_entering_phone → reauth_verifying_otp → (deleting | failed)`
- `RecaptchaVerifier` lifecycle management (clear on cancel/resend)
- 30-second resend cooldown with countdown
- Pre-populate phone from `auth.currentUser.phoneNumber`; no phone enumeration
- English and Spanish i18n keys added; old `reauth_required` static-message flow removed

**TM-16 (CI SHA pinning):**
- `actions/checkout` pinned to `11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2) in both workflows
- `setup-node` and `setup-java` retain version tags with inline `gh api` commands to complete pinning

**TM-17 (log redaction):**
- SendGrid error handler: `await res.body?.cancel()` — body not logged (may contain recipient email)
- FCM reminder: UID masked to `first4***`

### Quality gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 22 files, 695 tests |
| `npm run build` | PASS |
| `npm run test:rules` | PASS — 111 tests |
| `node --check functions/index.js` | PASS |
| `git diff --check` | PASS — no whitespace errors |

### Updated threat model triage

| Open CRITICAL | 0 |
|---|---|
| Open HIGH | 2 (TM-12 App Check, TM-13 rate limits) |
| Open MEDIUM | 1 (TM-16 — 2 of 3 actions still need SHA) |
| Open LOW | 0 |
| Partially addressed | TM-04, TM-06, TM-17 |
| Blocked/external | 3 (TM-19 credentials, TM-20 native packaging, TM-12 console) |

### Remaining manual actions

- Pin `actions/setup-node@v4` and `actions/setup-java@v4` to SHAs (commands in workflow files)
- Deploy Storage Rules (`storage.rules`) in a separately approved rollout
- TM-12: App Check enrollment decision
- TM-13: Per-function rate limits — requires Firestore-based counters or Cloud Run config
- TM-19: credential rotation verification
- Production data migration and legal sign-off (unchanged from Phase C)

## Phase E — Targeted correction and final verification (2026-07-25)

Resumed from compacted session. Closed all 8 targeted steps.

### Commits

| Commit | Message |
|---|---|
| `739320a` | `security: replace signInWithPhoneNumber with reauthenticateWithPhoneNumber` |
| `d924266` | `test: add Storage Rules emulator test suite (ST-01 through ST-15)` |
| `d786f5a` | `security: complete TM-16 SHA pinning and add TM-17 redactForLog utility` |
| `a09843c` | `fix: apply safe npm audit fixes to functions dependencies` |

### Work completed

**Step 2 — Reauthentication security fix (App.tsx):**
- Replaced `signInWithPhoneNumber(auth, phoneInput, ...)` with `reauthenticateWithPhoneNumber(currentUser, currentUser.phoneNumber, verifier)` — phone sourced from Firebase Auth, never from user input
- Editable `<input type="tel">` removed; replaced with masked non-editable display using `maskPhoneNumber()` utility
- `originalUidRef` captures UID before reauth starts; `verifyUidUnchanged()` asserts it matches after `confirm()` — aborts with `signOut()` if account was switched
- New `utils/reauthBeforeDelete.ts`: `maskPhoneNumber` (ITU-T CC lookup table, 1/2/3-digit CC detection) and `verifyUidUnchanged` (throws `auth/account-switched`)
- New `utils/reauthBeforeDelete.test.ts`: 15 tests covering phone masking (CC detection), UID unchanged invariant, account-switch detection, cancellation safety, wrong credential blocking

**Step 3 — Functions test run:**
- `npm run test:functions`: 1 file, 16 tests, 0 skips PASS

**Step 4 — Storage Rules surface audit:**
- All avatar renders in MessagesView, HeaderBar, UsersPage use stored `avatarUrl` strings (Firebase download URLs with per-file tokens that bypass rules) — no cross-user SDK reads
- ProfileView uploads to `avatars/${user.id}` (direct path); owner SDK read/write/delete is correct
- `storage.rules` verified correct; no rule changes needed
- New `storage.rules.test.ts`: 16 tests (ST-01–ST-15) covering owner write, non-owner/unauth rejection, MIME spoof, 5 MB limit, read/delete ownership, catch-all deny, direct-path coverage
- New `npm run test:storage:rules` script (starts storage emulator); excluded from default `npm test`

**Step 5 — npm audit triage:**
- Root: 67 vulns (1 critical, 42 high, 23 moderate, 1 low) — all in expo build tooling or firebase-admin (not shipped to browser); critical `tar` requires `expo@57` (breaking). No safe auto-fixes available; `npm audit fix` unchanged at 67.
- Root production-only (`--omit=dev`): 65 vulns — same packages, none browser-runtime-loaded
- Functions: critical `websocket-driver` FIXED via `npm audit fix`; 32 remaining (8 moderate, 24 high) in `@google-cloud/*` — all require `--force` (breaking)
- `functions/package-lock.json` updated

**Step 6 — TM-16 + TM-17:**
- TM-16 CLOSED: `setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020` (v4) and `setup-java@c1e323688fd81a25caa38c78aa6df2d33d3e20d9` (v4) pinned in `firestore-rules.yml`. All 3 CI actions now SHA-pinned.
- TM-17 (partial→structured): `utils/redactForLog.ts` — scrubs phone, email, token, FCM, coordinates, message bodies, AI prompts/responses, passwords, secrets, credentials, auth, OTP. Deep-walk mode. 15 unit tests. Callers should migrate `console.error(obj)` → `console.error(redactForLog(obj))`.

### Quality gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 24 files, 725 tests, 0 skips |
| `npm run build` | PASS |
| `npm run test:rules` | PASS — 1 file, 111 tests |
| `npm run test:storage:rules` | PASS — 1 file, 16 tests |
| `npm run test:functions` | PASS — 1 file, 16 tests, 0 skips |
| `node --check functions/index.js` | PASS |
| `git diff --check` | PASS (line-ending warning only, non-error) |

### Updated threat model triage

| Open CRITICAL | 0 |
|---|---|
| Open HIGH | 2 (TM-12 App Check, TM-13 rate limits) |
| Open MEDIUM | 0 |
| Open LOW | 0 |
| Partially addressed | TM-04, TM-06 |
| Addressed this pass | TM-16 CLOSED, TM-17 structured utility added |
| Blocked/external | 3 (TM-19 credentials, TM-20 native packaging, TM-12 console) |

### Remaining manual actions

- Deploy Storage Rules (`storage.rules`) in a separately approved rollout
- Migrate call sites in `functions/index.js` to use `redactForLog()` for structured log scrubbing (TM-17 completion)
- TM-12: App Check enrollment decision
- TM-13: Per-function rate limits — requires Firestore-based counters or Cloud Run config
- TM-19: credential rotation verification
- Production data migration and legal sign-off (unchanged from Phase C)

## Phase B — Dependency fix checkpoint

`@firebase/rules-unit-testing` was downgraded from `5.0.1` to `3.0.4` to resolve an `ERESOLVE` peer conflict with `firebase@10.14.1`. Version 3.0.4 declares `firebase@'^10.0.0'` as its peer, is the latest 3.x release, and passes all 70 Rules tests unchanged. The `package-lock.json` was regenerated from a clean `node_modules` directory; `npm ci` now succeeds without any override flags.

Post-fix quality gates:

| Gate | Result |
|---|---|
| `npm ci` | PASS — no ERESOLVE |
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 19 files, 674 tests |
| `npm run build` | PASS |
| `npm run test:rules` | PASS — 70 tests |
| `npm audit` (no flags) | 67 vulnerabilities (1 critical, 42 high, 23 moderate, 1 low) |

Vulnerability assessment:

- All 43 critical and high findings trace to `expo@~50.0.14` and `react-native@0.73.6` toolchain packages. These are dormant in the shipped Vite web app — not loaded at runtime, not served to users.
- The single critical (`tar`) is in `expo`'s dev CLI dependency chain; fix requires `expo@57` (breaking major).
- `vite@5` reports one high; fix requires `vite@8` (breaking major, build tool only).
- `npm audit fix` (no force) was run; the remaining count reflects packages blocked by peer constraints or requiring breaking major upgrades.
- No new directly exploitable vulnerabilities were introduced by this change.

Full dependency inventory: `docs/DEPENDENCY_AND_SDK_INVENTORY.md`.

## Phase F — CI repair checkpoint (2026-07-29)

The "Firestore Security Rules" GitHub Actions workflow was failing on every triggered push. The root cause was a cross-version npm lockfile incompatibility, not the Rules code itself.

### Root cause

npm 11 (local, Windows) generates `package-lock.json` without the platform-specific optional packages for non-Windows platforms. `vitest@4.1.9` nests `vite@8.1.3`, which declares `esbuild@^0.27.0 || ^0.28.0` as an optional peer. npm 11 satisfied that peer without recording `esbuild@0.28.1` or its 27 `@esbuild/*@0.28.1` platform variants in the lockfile. npm 10 (GitHub Actions) validates lockfile completeness before installing and fails immediately with "Missing: @esbuild/linux-x64@0.28.1 from lock file".

This caused the CI job to exit within 2 seconds at the "Install dependencies" step on every run that touched a workflow-triggering path. The failure pre-dated the `--project demo-parkqueen-rules-test` fix: that fix was never tested by CI because `package.json` was not yet in the workflow path filter.

### Commits

| Commit | Message |
|---|---|
| `f50cdb0` | `ci: trigger Rules workflow for test infrastructure changes` — expanded path filter to include `package.json`, `package-lock.json`, `firebase.json`, `.firebaserc`, `vite.rules.config.ts`, and the workflow file itself; added `workflow_dispatch` |
| `99fe904` | `ci: upgrade to Node 22 LTS (Node 20 EOL April 2026)` |
| `2ab79b7` | `ci: disable npm cache, add verbose logging to diagnose npm ci failure` — diagnostic; reverted in next commit |
| `a2c2ec9` | `fix(ci): regenerate lockfile with npm 10 to add missing esbuild@0.28.x platform packages` — root-cause fix; also restores npm cache and removes diagnostic verbose flag |

### Fix

`package-lock.json` was regenerated by running `npx -p npm@10 -- npm install`. npm 10 records all optional platform-specific packages (including Linux and non-Windows variants) regardless of the host platform, making the lockfile portable. 27 `@esbuild/*@0.28.1` entries were added.

### Verified state

| Item | Result |
|---|---|
| GitHub Actions run `30412569509` | **success** |
| Firestore Rules tests | 132 / 132 passing |
| Node version in CI | 22 LTS (Node 20 EOL 2026-04-30) |
| npm version used for lockfile | 10 (via `npx -p npm@10`) |
| Local `npm run test:rules` | 132 / 132 PASS |

### Standing instruction

Any future change to `package.json` or `package-lock.json` must be validated by running `npx -p npm@10 -- npm ci` (or equivalent) before committing. A lockfile generated exclusively by npm 11 will silently omit cross-platform optional packages and break GitHub Actions CI.

## Phase G — Final hardening pass (2026-07-28)

Eight audit sections (§2–§9) completed on `audit/app-store-readiness-2026`. No deployment performed.

### Commits

| Commit | Message |
|---|---|
| `3dd6d22` | `test(§2): extract fanout helpers and add 24 notification fanout tests` |
| `33cad87` | `test(§3): add 8 emulator-backed initUserPrivateAccount trigger tests` |
| `dcd6bab` | `test(§4): add 8 missing user schema allowlist tests` |
| `d5e01b9` | `test(§5): add 24 rate limiter tests (4 Rules + 20 Firestore emulator)` |
| `e8928db` | `test(§6): add App Check prod bundle assertion tests (TM-12)` |
| `5beb7ba` | `fix(§7): add redactForLog call site and extend log redaction tests` |
| `738065f` | `test(§8): document avatar access policy — SVG acceptance and MIME boundary tests` |
| `a23c538` | `test(rules): add two-user lifecycle workflow tests (WF-01-WF-12)` |

### Work completed

**§2 — Notification fanout hardening:**
- Extracted `haversineDistMiles`, `filterCandidates`, `buildMessages`, `collectStaleTokens`, `STALE_MS`, `MAX_CANDIDATES`, `FCM_BATCH` into `functions/notifyFanout.js`
- Fixed silent fanout abort on malformed geohash: try/catch in `filterCandidates` skips bad candidates and continues
- 24 unit tests in `utils/notifyFanout.test.ts` covering all helpers including privacy properties (no coordinates or finderId in FCM payloads — TM-17) and constants
- Vision API error logging changed from raw Error object to `redactForLog({ name, message, status })` — prevents response body leakage

**§3 — initUserPrivateAccount trigger:**
- 8 emulator-backed integration tests in `functions/initUserPrivateAccount.integration.test.js`
- Covers: OB-1 doc creation, OB-2 moderationStatus, OB-3 reportCount, OB-4 no leaked fields, OB-5 merge:true, OB-6 two-user isolation, OB-7 subcollection path, OB-8 delete-and-recreate

**§4 — User schema allowlist tests:**
- 8 tests (SC-1 through SC-8) for `users/{uid}` create/update allowlist enforcement
- Vehicle fields (vehicleBrand, vehicleColor) documented as intentionally public — finder vehicle identification; avatarUrl and avatarManifestId in update allowlist; id and createdAt confirmed immutable

**§5 — Rate limiter tests:**
- 4 Rules tests (RL-R1 through RL-R4): `rateLimits` collection client-access fully denied for both auth and anon users
- 20 Firestore emulator integration tests (RL-1 through RL-20): limit enforcement, TTL, doc ID format, isolation per user/operation/window, HMAC email hash isolation, concurrent request race (exactly LIMIT succeed)
- `vite.functions.config.ts` updated to include all 3 integration test files

**§6 — App Check bundle assertions:**
- 6 tests in `utils/appCheckBundleAssertion.test.ts`
- AC-1–4: dist/ scan confirming no debug token strings (skip when no dist/; all 4 pass after build)
- AC-5: source-level check that DEV guard precedes FIREBASE_APPCHECK_DEBUG_TOKEN in firebaseConfig.ts
- AC-6: confirms initializeAppCheck never called (TM-12 remains open — provider decision required)

**§7 — redactForLog hardening:**
- Extended `utils/redactForLog.test.ts` from 6 to 16 tests
- 8 tests for TypeScript `utils/redactForLog.ts` version (same SENSITIVE regex, no null guard since TypeScript enforces at compile time)
- 2 static call-site assertion tests: import present and at least one call site in functions/index.js
- Fixed dead import: added meaningful call site for Vision API error at `moderateAvatarUpload`

**§8 — Storage Rules MIME policy:**
- 3 new tests (ST-14 SVG intentional, ST-15 WebP accepted, ST-16 octet-stream rejected)
- EXIF gap documented: GPS coordinates in EXIF not stripped by Firebase Storage or Vision SafeSearch; server-side stripping (Sharp) deferred to future release
- SVG acceptance documented: `image/svg+xml` matches `image/.*`; SVGs via `<img>` don't execute scripts; Parsona avatars use Firestore manifests, not Storage

**§9 — Two-user lifecycle workflow tests:**
- 12 tests (WF-01 through WF-12) in a narrative describe block appended to `firestore.rules.test.ts`
- Covers: profile cross-reads (WF-01–04), private/account subcollection isolation in both directions and anon, available Ping create by OWNER (WF-05), OTHER can read available Ping (WF-06), THIRD cannot update Ping (WF-07), OTHER can claim Ping via interestedUserId (WF-08), chat participant read isolation in both directions (WF-09–11), notification read restricted to targetUserId (WF-12)

### Quality gates (post Phase G)

| Gate | Result |
|---|---|
| `npm ci` | PASS — clean install |
| `npx tsc --noEmit` | PASS — 0 errors |
| `npm test` | PASS — 28 files, 769 tests |
| `npm run test:rules` | PASS — 1 file, 156 tests |
| `npm run build` | PASS — built in 12.77 s |
| App Check bundle scan (post-build) | PASS — 6/6 (dist exists) |

### Updated threat model triage

| Open CRITICAL | 0 |
|---|---|
| Open HIGH | 2 (TM-12 App Check enrollment, TM-13 per-function rate limits) |
| Open MEDIUM | 0 |
| Open LOW | 0 |
| Partially addressed | TM-04 (public user doc), TM-06 (Storage Rules deployment) |
| Blocked/external | TM-12 (provider console decision), TM-19 (credential rotation), TM-20 (native packaging) |

### Remaining manual actions (unchanged from Phase F)

- Pin `actions/setup-node@v4` and `actions/setup-java@v4` to SHAs (commands in workflow files)
- Deploy Storage Rules (`storage.rules`) in a separately approved rollout
- TM-12: App Check enrollment decision (reCAPTCHA v3 / DeviceCheck / Play Integrity)
- TM-13: Per-function rate limits — Firestore-based counters or Cloud Run config
- TM-19: Credential rotation verification via provider metadata
- Production data migration: `utils/migration/privatizeContactFields.ts` in apply mode post-deployment
- Legal sign-off on `adminAuditLog` and `moderationLog` retention categories

## Phase H — Avatar pipeline quarantine, retry hardening, and log redaction (2026-07-29)

Complete rewrite of the avatar moderation pipeline with quarantine path design, generation-scoped idempotency, real bounded retry, Sharp 0.35.3 defensive processing, full logging audit, and 25 new moderation integration tests. No deployment performed.

### Commits

| Commit | Message |
|---|---|
| `2a31603` | `security(avatar): quarantine upload path, generation-scoped idempotency, bounded retry` |
| `6a8bb9c` | `security(avatar): upgrade Sharp to 0.35.3; defensive pixel/dimension/channel limits` |
| `f347bec` | `security(logging): harden sanitizeError allowlist; close TM-17` |
| `f50bd1e` | `test(avatar): 25 moderation integration tests; quarantine storage rules (ST-01–ST-22)` |
| `6ca7ba3` | `docs: Phase H checkpoint — quarantine design, Sharp 0.35.3, TM-17 closed` |

### Work completed

**Quarantine path architecture (`functions/index.js`, `storage.rules`, `views/ProfileView.tsx`):**
- Three-path separation prevents recursive trigger firing:
  - `avatarUploads/{uid}/{uploadId}/original` — client writes only (trigger source)
  - `avatarCandidates/{uid}/{uploadId}.webp` — server-only intermediate (no trigger)
  - `avatars/{uid}` — server-published after approval (no trigger)
- Trigger guard: `filePath.startsWith("avatarUploads/")` + `parts.length === 4 && parts[3] === "original"` — filters all non-originals before any work
- `ProfileView.tsx`: client uploads to `avatarUploads/${user.id}/${uploadId}/original` via `crypto.randomUUID()`; removed `getDownloadURL`/`updateDoc` client calls — server sets `avatarUrl` on approval
- Moderation listener in ProfileView filters stale docs with `data.uploadId !== uploadId`; recognizes `processing` and `retry_pending` as non-terminal states
- `deleteAccount` extended to cover all three prefixes: `avatarUploads/`, `avatarCandidates/`, `avatars/`

**Generation-scoped idempotency (`functions/index.js`):**
- Firestore transaction on `avatarModeration/{uid}` at the start of every invocation
- Claims processing slot atomically using both `uploadId` and `sourceGeneration` (`event.data.generation`)
- Same `uploadId` + terminal status → duplicate delivery skip (return without throw)
- Same `uploadId` + `maxRetries` exceeded → permanent failure, return without throw
- Different `uploadId` → newer upload supersedes; stale event returns immediately
- Full Firestore schema: `uid`, `uploadId`, `sourcePath`, `sourceGeneration`, `status`, `retryCount`, `processedPath`, `failureReason`, `createdAt`, `updatedAt`

**Real bounded retry (Option B: event re-delivery + Firestore state):**
- Transient errors (download, Sharp processing, Vision API, candidate upload) → `throw` — Cloud Functions v2 re-delivers the event
- Permanent errors (invalid magic bytes, dimension exceeded, pixel limit, content policy) → `return` without throw — no retry scheduled
- `retryCount` in Firestore incremented on each transient throw; `AVATAR_MAX_RETRIES = 3` enforces the ceiling
- At `maxRetries`, the function transitions to permanent failure and returns (no throw) — bounded, not unbounded
- Staleness check at approval: second Firestore transaction before writing `users/{uid}.avatarUrl`; if `mod.uploadId !== uploadId`, a newer upload took the slot during Vision check — candidate deleted, "approval skipped (superseded)" logged

**Sharp 0.35.3 / libvips 8.18.3 (`functions/package.json`):**
- Upgraded from `^0.33.0` to `^0.35.0`; installed at `0.35.3` with libvips `8.18.3`
- Defensive construction: `sharp(rawBytes, { failOn: "warning", limitInputPixels: 16_777_216, limitInputChannels: 4, sequentialRead: true })`
- Constants: `AVATAR_MAX_PIXELS = 16_777_216` (4096×4096), `AVATAR_MAX_DIMENSION = 4096`
- Rejections before Sharp: zero/excess dimensions, pixel count, unsupported channel count, animated/multipage
- EXIF stripped via re-encoding to WebP without `.withMetadata()` — verified by MOD-09 (orientation EXIF fixture); GPS coordinates are stripped by EXIF absence but no GPS lat/lng fixture is verified separately
- Permanent errors set `_perm: true` flag so the catch block returns instead of throws
- No libvips CVEs in 0.35.3 — the 4 CVEs from 0.33.5 (CVE-2026-33327/33328/35590/35591) are resolved

**sanitizeError allowlist hardening (`functions/redactForLog.js`):**
- `SAFE_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/` — unknown names fall back to `'Error'`
- `SAFE_CODE_RE = /^[A-Za-z0-9_\-/]{0,64}$/` — unknown codes fall back to `''`
- Returns bounded string `name/code` or `name`; never `.message`, `.stack`, or arbitrary properties

**Logging audit — TM-17 CLOSED (full surface scanned `functions/index.js`):**
- All 72 `console.log/warn/error` calls audited in this pass
- Previously unscanned: `[NYCOpenData]` section had 3 raw `err && err.message` calls
  - Line 2381 (cross-street fetch): `err && err.message` → `sanitizeError(err)`
  - Line 2395 (Nominatim reverse geocode): `err && err.message` → `sanitizeError(err)` — CRITICAL: Nominatim URL contains `lat=`/`lon=` query params; fetch failure exposes exact coordinates in `err.message`
  - Line 2433 (NYC Open Data paged fetch): `err && err.message` → `sanitizeError(err)`
- Non-log `err.message` at line 1511 (`deleteAccount` step recorder): Firestore write, not log; regex-redacted for email/phone + truncated to 200 chars; acceptable
- All other log calls: use `sanitizeError`, mask UIDs (`slice(0,4)+'***'`), log public API field names/counts/street names, or log HTTP status codes — no user PII
- TM-17 CLOSED: full logging surface verified; no raw error messages, paths, coordinates, UIDs, or sensitive data in any log path

**Storage Rules — quarantine architecture (`storage.rules`, `storage.rules.test.ts`):**
- Rewritten for three-path quarantine:
  - `avatarUploads/{uid}/{uploadId}/{fileName}`: owner write (`isOwner(uid) && isValidAvatarUpload()`); `read, delete: if false`
  - `avatarCandidates/{allPaths=**}`: `read, write: if false` (server-only)
  - `avatars/{uid}` + `avatars/{uid}/{allPaths=**}`: `read: if isOwner(uid)`; `write, delete: if false`
  - Catch-all: `/{allPaths=**} read, write: if false`
- `isValidAvatarUpload()`: `size < 5 MB && contentType in ['image/jpeg', 'image/png', 'image/webp']`
- ST-01–ST-22: 22 storage tests covering all three path families, MIME allowlist, size limit, read/delete denial, and catch-all

**Moderation integration tests (`functions/moderateAvatarUpload.integration.test.js`):**
- 25 tests (MOD-01–MOD-25) using Sharp-generated 4×4 pixel images (JPEG/PNG/WebP)
- `_hooks.visionSafeSearch` test seam for deterministic Vision injection
- Covers: approved (JPEG/PNG/WebP), SVG/HTML/corrupt rejection, dimension/pixel limits, EXIF stripping, adult/racy content, null annotation, Vision throw, max retries, retry-then-approve, duplicate delivery, newer upload supersedes, staleness mid-flight, no recursion on candidate/avatars paths, avatarUrl absent before/set after approval, non-original filename ignored, terminal rejection, full schema check
- Total functions integration tests: **69** (44 existing + 25 new moderation)

### npm audit assessment

**Root package (67 vulnerabilities: 1 critical, 42 high, 23 moderate, 1 low):**
All vulnerabilities are in the Expo / React Native build toolchain (`expo`, `react-native`, `xcode`, `node-tar`). None loaded at browser runtime or shipped to the web hosting bundle. Single critical (`node-tar` via `xcode`) requires `expo@57` (breaking); unexploitable in web context.

**Functions package (32 vulnerabilities: 8 moderate, 24 high):**
- Upgraded `sharp` from `0.33.5` to `0.35.3` — 4 libvips CVEs resolved; no sharp/libvips CVEs remain
- Remaining 32 are in `@google-cloud/*` packages — require breaking upgrades (`--force`). No safe auto-fix path.
- Attack surface: Cloud Function processes only files that passed Firebase Auth + Storage Rules (authenticated, size-capped at 5 MB, MIME-allowlisted, magic-byte-validated). Sharp processes only after those guards. Worst case for any `@google-cloud` CVE is a sandboxed Function crash — no persistent state or credential exposure.

**Secret scan (dist/):**
- Firebase web API key (TM-18: accepted, public by design) present in bundle — no new findings.
- No FCM server keys, OpenAI keys, GitHub PATs, or App Check debug tokens found.

### Quality gates (post Phase H)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS — 0 errors |
| `npm test` | PASS — 771 tests (28 files) |
| `npm run test:rules` | PASS — 156 Firestore tests |
| `npm run test:storage:rules` | PASS — 22 Storage tests |
| `npm run test:functions` | PASS — 69 integration tests (44 + 25 moderation), 0 skips |
| `npm run build` | PASS |
| `node --check functions/index.js` | PASS |
| `git diff --check` | PASS (LF→CRLF line-ending warnings only, non-error) |
| `npm ls sharp` (functions/) | `sharp@0.35.3` |
| Secret scan (dist/) | PASS — Firebase web key TM-18 accepted; no other secrets |

### Updated threat model triage

| Open CRITICAL | 0 |
|---|---|
| Open HIGH | 2 (TM-12 App Check enrollment, TM-13 per-function rate limits) |
| Open MEDIUM | 0 |
| Open LOW | 0 |
| Closed this pass | TM-17 CLOSED (full logging surface audited; all raw err.message replaced with sanitizeError; Nominatim lat/lng coordinate leak patched) |
| Partially addressed | TM-04 (public user doc — vehicle privacy UNRESOLVED) |
| Partially addressed | TM-06 (Storage Rules exist in repo; deployment pending) |
| Blocked/external | TM-12 (provider console decision), TM-19 (credential rotation), TM-20 (native packaging) |

### Remaining manual actions

- Deploy Storage Rules (`storage.rules`) in a separately approved rollout
- TM-12: App Check enrollment decision (reCAPTCHA v3 / DeviceCheck / Play Integrity)
- TM-13: Per-function rate limits — Firestore-based counters or Cloud Run config
- TM-04 / vehicle privacy: Product decision on Option A vs Option B before GA
- TM-19: Credential rotation verification via provider metadata
- Production data migration: `utils/migration/privatizeContactFields.ts` in apply mode post-deployment
- Legal sign-off on `adminAuditLog` and `moderationLog` retention categories
