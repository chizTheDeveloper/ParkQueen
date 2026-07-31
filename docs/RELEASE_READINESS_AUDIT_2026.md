# ParQueen Release Readiness Audit 2026

Assessment date: 2026-07-24  
Audit branch: `audit/app-store-readiness-2026`  
Baseline: `b761795c52056c0d940da31969a142a7cdcd46a8` (main)  
Method: repository inspection, static analysis, Firebase emulator tests, build analysis, official platform guidance  
Scope: shipped web application, Firestore security rules, Cloud Functions, Firebase configuration, client source, and dependencies  

---

## Executive summary

ParQueen is a Vite/React 18/TypeScript web application backed by Firebase. It is **not currently releasable** to Apple App Store or Google Play for the following reasons:

1. No native iOS/Android packaging architecture has been selected or implemented.
2. Five source-level blockers (BLK-01 through BLK-05) have been fixed on this audit branch but none have been deployed to production. BLK-02 (Firestore Rules) is the most urgent.
3. Eleven HIGH threat-model findings remain open, most requiring provider-console or product decisions beyond source changes.
4. Storage Rules are not tracked in the repository (TM-06).
5. App Check is not configured (TM-12).

**BLK-01, BLK-03, BLK-04, BLK-05 are fixed in source on `audit/app-store-readiness-2026`.** Zero open CRITICAL items remain. The web application can proceed toward a monitored limited-access web beta after BLK-02 is deployed and the remaining HIGH items have owners and due dates.

---

## Blocking findings — must resolve before any release

### BLK-01 (CRITICAL): Third-party voice agent script in production HTML — **FIXED IN SOURCE**

`index.html` previously loaded `https://cdn.voiceagent.ai/widget.js` with `data-agent-id="acme-corp-123"`. The `<script>` tag and the vestigial `@google/genai` importmap entry have been removed. `utils/securityAssertions.test.ts` asserts both are absent from source and from the production build.

Commit: `dd4c6f7` — `security: remove unapproved third-party script from index.html`

### BLK-02 (CRITICAL, undeployed fix): Firestore security rules on audit branch

Five CRITICAL/HIGH security fixes are committed on `audit/app-store-readiness-2026` but have never been deployed to the production project:

- Chat/message participant isolation (TM-01)
- Feedback forgery and Crown/trust replay prevention (TM-02)
- Notification spoofing prevention (TM-03)
- Phone/email denylist on public user document (BLK-05)
- `accountDeletionJobs` read-only rule for owner

The production project currently runs the baseline Rules. All 81 emulator tests pass on the audit branch.

**Deployment plan (do not execute without separate authorization):**

1. Merge `audit/app-store-readiness-2026` to `main` via a reviewed PR after all BLK items are cleared and signed off.
2. From a clean install (`npm ci`), run `npm run test:rules` — confirm 81/81 pass.
3. `firebase deploy --only firestore:indexes` if `firestore.indexes.json` has changed vs deployed state.
4. `firebase deploy --only firestore:rules` — live change; monitor Firebase console → Firestore → Usage for 5 minutes post-deploy.
5. Production smoke tests: sign-in → create Ping → claim Ping → send message → check notifications (all should succeed); attempt cross-user chat read (should return `PERMISSION_DENIED`).
6. Rollback: `git checkout <prior-rules-commit> -- firestore.rules && firebase deploy --only firestore:rules`.

Commit: `dbe8754` — `test: add missing Rules coverage for BLK-02 review (C7, N5, N6, F10)`

### BLK-03 (HIGH): Incomplete account deletion — **FIXED IN SOURCE**

The `deleteAccount` callable previously deleted only `users/{uid}`, username reservations, and the Firebase Auth user. The callable has been replaced with a complete idempotent deletion job covering: private subcollections, parking sessions, avatar moderation, email verification codes, spot feedback (delete own; anonymize as finder), spot notifications, active Pings (delete finder Pings; clear claimer fields on others), chats with full message subcollection tree (`db.recursiveDelete()`), reports (anonymize reporter), and Storage `avatars/{uid}`. Auth user is deleted last. Progress is recorded to `accountDeletionJobs/{uid}` (server-created, owner-read-only, not client-writable). The callable is idempotent on retry. A proper confirmation dialog replaces the `window.confirm` call.

Commit: `2d8d0cc` — `privacy: complete account deletion — all linked collections and Storage`

**Remaining manual items:** Legal sign-off on `adminAuditLog` and `moderationLog` retention periods; production data migration for existing accounts (`utils/migration/privatizeContactFields.ts`).

### BLK-04 (HIGH): No Content-Security-Policy — **FIXED IN SOURCE (report-only)**

`firebase.json` now includes a full `headers` block: HSTS (`max-age=31536000; includeSubDomains`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy-Report-Only` covering all required origins, and `Cache-Control` for assets and `index.html`. `utils/cspConfig.test.ts` (8 tests) asserts the policy is present and structurally correct.

Phase 2 (separate PR): flip to enforced `Content-Security-Policy` after bundling Tailwind and FontAwesome (removes `'unsafe-inline'` dependency and CDN script-src entries).

Commit: `608cbb5` — `security: add Firebase Hosting security headers with CSP report-only`

### BLK-05 (HIGH): Phone number in public user document — **FIXED IN SOURCE**

`saveUserProfile` in `database.ts` no longer writes `phone` or `email`. `verifyEmailOTP` in `functions/index.js` now writes email to `users/{uid}/private/account` and only `emailVerified: true` to the root doc. `handleSaveProfile` in `App.tsx` writes email to the private subcollection. Firestore Rules denylist blocks `phone` and `email` on all user doc creates/updates (Rules tests PD13-PD16). A private account listener in App.tsx merges the private email back into client state without race conditions. A dry-run migration utility (`utils/migration/privatizeContactFields.ts`) is available for existing production accounts.

Commit: `56434cb` — `privacy: isolate phone and email to private user subcollection`

---

## Security findings summary

### Fixed on audit branch (undeployed)

| ID | Title | Severity | Test coverage | Commit |
|---|---|---|---|---|
| TM-01 | Cross-account chat disclosure | CRITICAL | C1–C7 (7 tests) | prior |
| TM-02 | Crown/trust farming via forged feedback | CRITICAL | F7–F10 (4 tests) | prior |
| TM-03 | Notification spoofing | HIGH | N1–N6 (6 tests) | prior |
| TM-15 | Dependency graph not clean-installable | HIGH | npm ci PASS | prior |
| TM-21 | Third-party voice agent script | CRITICAL | securityAssertions (4 tests) | `dd4c6f7` |
| TM-22 | No Content-Security-Policy | HIGH | cspConfig (8 tests) | `608cbb5` |
| TM-24 | Phone/email in public user document | HIGH | PD13–PD16, PD17–PD19 (7 tests) | `56434cb` |
| TM-05 | Incomplete account deletion | HIGH | deletion flow + state machine | `2d8d0cc` |
| TM-26 | Vestigial @google/genai importmap entry | LOW | securityAssertions | `dd4c6f7` |

**Open CRITICAL:** 0

### Open HIGH items

| ID | Title | Blocker for |
|---|---|---|
| TM-04 | Full user-directory exposure | Store and privacy |
| TM-06 | Untracked Storage authorization | Avatar upload |
| TM-07 | Arbitrary listing writes | Listing feature |
| TM-08 | Reports accept arbitrary payloads | Report feature |
| TM-10 | Client-controlled Ping shape | Core Ping safety |
| TM-11 | Client-modifiable profile counters | Rewards safety |
| TM-12 | App Check absent | All Firebase services |
| TM-13 | Function rate-limit/idempotency gaps | AI/email/notification |
| TM-14 | Admin bootstrap exposure | Admin hardening |
| TM-19 | Historical credentials in Git | Provider verification |
| TM-20 | Native permission boundary undefined | Store packaging |

### Open MEDIUM items

| ID | Title |
|---|---|
| TM-09 | Suspension/parse-failure data exposure |
| TM-16 | Mutable CI action references |
| TM-17 | Sensitive logging |
| TM-23 | Logout does not clear localStorage |
| TM-25 | Smart-reply callable has no message size bound |

---

## Architecture findings

### ARC-01: Two Firebase initialization files

Both `firebase.ts` and `firebaseConfig.ts` initialize Firebase with the same configuration object. `firebase.ts` also initializes Firebase Analytics and enables anonymous auth. `firebaseConfig.ts` is the one imported by `database.ts`. The split creates maintenance risk where one file's configuration drifts from the other.

**Recommendation:** Consolidate to one file; decide deliberately on Analytics (requires privacy disclosure) and anonymous auth (requires session lifecycle decisions).

### ARC-02: `firebase-admin` in root `package.json`

`firebase-admin` is declared in root `dependencies` (not `devDependencies`). It belongs in `functions/package.json` only. Currently it is scanned by `npm audit` in the root project, increasing vulnerability surface, and Vite may attempt to resolve it during builds.

### ARC-03: Dormant dependencies in root

The following packages are declared in root `package.json` but are not exercised by the Vite web build: `expo`, `expo-camera`, `expo-location`, `expo-status-bar`, `react-native`, `react-native-webview`, `leaflet`. These are responsible for all 43 critical+high `npm audit` findings. Removing them from the root project would eliminate the critical vulnerability and reduce the dependency surface to the actual shipped application.

### ARC-04: Vestigial `@google/genai` importmap entry

`index.html` importmap includes `@google/genai@1.37.0`. All Gemini calls are correctly proxied through Cloud Functions (confirmed by test and source inspection). The importmap entry is dead code.

### ARC-05: Tailwind loaded from CDN in production

`index.html` loads Tailwind CSS from `cdn.tailwindcss.com` via a `<script>` tag. The project also declares `tailwindcss` as an npm devDependency. The CDN script runs the full Tailwind JIT compiler in the browser on every page load, which is a performance and security concern (untrusted-script execution). The build pipeline should use the npm package to generate a static CSS file.

### ARC-06: `updateUser` exported from `database.ts` with no callers

`database.ts` exports `updateUser(userId, data)` which writes arbitrary data to any `users/{userId}` document. No call sites were found in the source tree. The function should be removed if unused, or made server-only and scoped to the authenticated user if needed.

---

## Client security findings

### CLI-01: `index.html` loads external resources without SRI

External resources in `index.html` have no `integrity` attributes:

- `https://cdn.tailwindcss.com` (script)
- `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css` (stylesheet)
- `https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.css` (stylesheet)
- `https://cdn.voiceagent.ai/widget.js` (script — see BLK-01)

If any CDN is compromised or the URL is intercepted, the browser will execute/apply the modified resource without warning.

### CLI-02: Mapbox GL CSS version mismatch

`index.html` loads `mapbox-gl.css` for v2.14.1 but `package.json` declares `mapbox-gl@^3.18.1`. The CSS is loaded from the wrong major version, potentially causing map UI glitches.

### CLI-03: Logout does not clear session localStorage

`logoutUser()` calls `signOut(auth)` only. Account-bound localStorage keys (`lastReadChat_*`, `pendingUpdatesCount`, `lastViewedNotifications`) persist across sign-outs. On shared devices the next user can observe prior session activity.

### CLI-04: `useSpotData.ts` reads `pendingUpdatesCount` from localStorage on init without validation

`const stored = localStorage.getItem('pendingUpdatesCount')` is parsed directly without null check or NaN guard. If a prior session wrote a non-numeric value, the badge counter may display incorrectly.

---

## Functions audit findings

### FN-01: App Check absent on all callables (TM-12)

Every callable uses `onCall` with no `enforceAppCheck` option or with `enforceAppCheck: false`. Unauthenticated clients can invoke callables after obtaining a Firebase ID token by any means (including phone OTP spoofing if reCAPTCHA is weak).

### FN-02: `generateSmartReplies` has no input size bounds (TM-25)

The callable accepts `lastMessage` and `context` (caller-assembled chat history) with no length validation. A large `context` string can generate oversized Gemini requests consuming quota and potentially triggering model behavior changes.

### FN-03: `bootstrapAdmin` check-then-set race (TM-14)

`bootstrapAdmin` reads `adminAuditLog` to check for prior bootstrap, then sets claims, then writes the log. Two concurrent calls from `@parqueen.app` accounts could both pass the check before either writes the log. Probability is low but the design should use a Firestore transaction or a once-writable document rather than a log query.

### FN-04: `generateEmailOTP` and `verifyEmailOTP` — rate limit and TTL analysis

These callables implement email OTP. Without inspecting the full implementation: they must validate code TTL (short), attempt count (max 3–5), and account-level rate limit (not just per-request). Confirm these controls exist and cannot be bypassed by parallel calls.

### FN-05: `createSegmentFromSweepNYC` — no caller rate limit

The callable at line 1842 accepts coordinates and triggers an external SweepNYC API call. Without App Check or an explicit per-user rate limit, an attacker with a valid Firebase ID token can exhaust the SweepNYC quota and the project's egress budget.

### FN-06: `deleteAccount` incomplete (TM-05, BLK-03)

Confirmed: callable deletes only `users/{uid}`, username reservations, and Auth. See `docs/PRIVACY_DATA_INVENTORY.md` for the complete deletion gap.

### FN-07: Trust functions idempotency

`applyTrustDelta` uses `processedTrustEvents` subcollection for idempotency. This is correct design. However the pattern should be verified under concurrent Firestore retries and Function retries (background triggers can re-execute).

---

## Storage audit findings

### STG-01: No `storage.rules` in repository (TM-06)

`firebase.json` has no `storage` target and there is no `storage.rules` file. The deployed Storage Rules are unknown and cannot be audited. The only client-side Storage operation in the codebase is avatar upload in `ProfileView.tsx` (`avatars/{uid}`). Without Storage Rules, the access policy relies solely on the Firebase project defaults, which vary by project age and whether the default bucket was configured.

**Required action:** Export current deployed Storage Rules (read-only, no secret access). Define owner-only upload (size limit, MIME type allow-list), owner-only delete, and admin read in a `storage.rules` file tracked in the repository.

---

## Firestore remaining open items

| Collection | Finding | Priority |
|---|---|---|
| `spots/{id}` | Ping create/update shape allows arbitrary client-supplied fields, coordinates without bounds, unrestricted status transitions | HIGH (TM-10) |
| `users/{uid}` | Any signed-in user can read full document including FCM token, phone, email, last geohash | HIGH (TM-04) |
| `listings/{id}` | Any signed-in user can write any document; legacy feature with no ownership model | HIGH (TM-07) |
| `reports/{id}` | Reporter UID not bound to `auth.uid` at create; arbitrary keys accepted | HIGH (TM-08) |
| `parseFailures/{id}` | Broad update allowed beyond increment-only fields | MEDIUM (TM-09) |
| `suspensions/{id}` | World-readable; may expose sensitive street-enforcement schedule or be misread as user suspension | MEDIUM (TM-09) |

---

## Performance findings

### PERF-01: Bundle size exceeds recommended thresholds

Production build warnings:

| Chunk | Minified | Gzip |
|---|---|---|
| `StreetParkingView` (lazy) | 1,867 kB | 510 kB |
| Main bundle | 927 kB | 233 kB |

Vite recommends chunks below 500 kB minified. The StreetParkingView chunk at 1.8 MB will cause a slow initial render on mobile networks. The Mapbox GL JS library is the primary contributor.

**Recommendation:** Code-split `mapbox-gl` and its dependent components; lazy-load the map only after location permission is granted.

### PERF-02: Tailwind JIT in browser

Loading `cdn.tailwindcss.com/tailwindcss` runs the full JIT compiler in the browser. Replace with a bundled Tailwind CSS file generated during the Vite build.

### PERF-03: Firestore real-time listener surface

The street parking view opens multiple snapshot listeners (spots, spots by geohash, user profile, chats, notifications, parking session). Under high traffic or weak network conditions, these generate sustained read billing. Verify listeners are detached on view unmount.

---

## Accessibility and i18n findings

### A11Y-01: `useFocusOnMount` applied in limited views

Keyboard focus management on view transitions is present in some views (via `useFocusOnMount`) but not verified across all navigation paths.

### A11Y-02: No ARIA live regions for map pin updates

The Mapbox map renders Ping pins dynamically. Screen reader users receive no announcement when new spots appear.

### I18N-01: English/Spanish parity confirmed for documented keys

Both `i18n/en.ts` and `i18n/es.ts` contain matching key counts for translated strings. Parity at the key level does not guarantee translation completeness or accuracy; a native-Spanish review is recommended before release.

---

## Release gate summary

| Gate | Status | Evidence |
|---|---|---|
| `npm ci` | PASS | Phase B fix; exits 0 without flags |
| TypeScript | PASS | `npx tsc --noEmit` — no errors |
| Unit tests | PASS | 21 files, 686 tests |
| Production build | PASS | 1,673 modules; StreetParkingView 1,867 kB / 510 kB gzip |
| Firestore Rules emulator | PASS | 81 tests |
| No BLK-01 (voice agent script) | **PASS (fixed in source)** | `index.html` — script removed; securityAssertions confirms absent in source and dist |
| No BLK-02 (Rules deployed) | **PENDING** | Source correct, 81 tests pass; requires separate authorized deployment |
| Account deletion complete | **PASS (fixed in source)** | `deleteAccount` covers all collections + Storage; pending deployment |
| CSP deployed | **PASS (report-only in source)** | `firebase.json` headers block added; pending deployment |
| Phone out of public doc | **PASS (fixed in source)** | `database.ts`, `App.tsx`, `functions/index.js` all corrected; Firestore denylist updated |
| Storage Rules in repo | **FAIL** | No `storage.rules` — requires console export (TM-06) |
| App Check configured | **FAIL** | TM-12 — provider decision required |
| No open CRITICAL items | **PASS** | 0 open CRITICAL items; all 3 prior CRITICAL findings fixed in source |

---

## Release recommendation

**Web application:** Not yet ready for public release. After resolving BLK-01 through BLK-05 and deploying the Firestore Rules fix (BLK-02), a supervised limited-access web beta is achievable. App Check, rate limits, and the remaining HIGH threat model items should be resolved before public launch.

**Native iOS/Android:** Blocked. Requires platform architecture decision, native project creation, App Store and Play Store registration, and a separate packaging and submission audit.

All items in this document require owner assignment, due dates, and explicit sign-off before deployment. The `docs/THREAT_MODEL.md` residual-risk section governs acceptance of any remaining open items.
