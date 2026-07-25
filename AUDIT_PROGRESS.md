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
| 0 — Baseline, inventory, reproducibility | Complete with blocker | Clean audit branch, inventory, toolchain, clean-install failure, and baseline gates captured |
| 1 — Store policy/platform requirements | Complete | Dated official-source matrix in `docs/STORE_SUBMISSION_READINESS.md` |
| 2 — Mobile architecture/packaging | Complete | Vite web app; no reproducible iOS/Android package, native projects, manifests, signing, or release pipeline |
| 3 — Threat model | Complete, evolves with findings | `docs/THREAT_MODEL.md` |
| 4 — Secrets/supply chain | In progress | CI/ignore/static scan reviewed; dependency blocker confirmed |
| 5 — Authentication/account security | In progress | Phone auth and incomplete deletion traced |
| 6 — App Check/Functions/IAM | In progress | App Check absent in source; console verification pending |
| 7 — Firestore/Rules/indexes/concurrency | In progress | Chat, feedback/reward, and notification vulnerabilities fixed test-first |
| 8–9 | Pending | |
| 10 — Privacy/retention/deletion | In progress | `docs/PRIVACY_DATA_INVENTORY.md`; deletion gap documented |
| 11–28 | Pending | See implementation plan |

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
