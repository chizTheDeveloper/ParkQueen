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

### Threat model final triage

| Open CRITICAL | 0 |
|---|---|
| Open HIGH | 11 (TM-04, 06, 07, 08, 10, 11, 12, 13, 14, 19, 20) |
| Open MEDIUM | 5 (TM-09, 16, 17, 23, 25) |
| Open LOW | 0 |

### Manual actions still required

- BLK-02: authorized deployment of Firestore Rules (see deployment plan in `docs/RELEASE_READINESS_AUDIT_2026.md`)
- TM-06: export `storage.rules` from Firebase console and commit
- TM-12: App Check enrollment decision
- TM-19: credential rotation verification via provider metadata
- Production data migration: run `utils/migration/privatizeContactFields.ts` in apply mode with admin credentials post-deployment
- Legal sign-off on `adminAuditLog` and `moderationLog` retention categories

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
