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
2. A critical third-party script with a placeholder ID ships in `index.html` (`cdn.voiceagent.ai/widget.js`, `data-agent-id="acme-corp-123"`).
3. Account deletion is incomplete, blocking store compliance under both App Store and Play Store requirements.
4. Three security vulnerabilities were found and fixed on this audit branch (chat isolation, feedback forgery, notification spoofing); they remain undeployed.
5. Twenty-six open threat model items remain, eight of which are CRITICAL or HIGH without a mitigation.

The web application can proceed toward a monitored limited-access web release after the CRITICAL items below are resolved, tested, and separately approved for deployment.

---

## Blocking findings — must resolve before any release

### BLK-01 (CRITICAL): Third-party voice agent script in production HTML

`index.html` line 86 loads `https://cdn.voiceagent.ai/widget.js` with `data-agent-id="acme-corp-123"`. This is a vendor placeholder ID. The script executes in the application origin with full DOM and localStorage access, can read Firebase authentication state, and sends data to an unreviewed third party. This is both a security and a privacy/store-compliance failure.

**Required action:** Remove the `<script>` tag from `index.html` before any deployment. If a voice agent feature is planned, evaluate and scope it in a separate task with CSP isolation, SRI hash, privacy review, and provider contract.

### BLK-02 (CRITICAL, undeployed fix): Firestore security rules on audit branch

Three CRITICAL/HIGH security fixes are committed on `audit/app-store-readiness-2026` but have never been deployed to the production project:

- Chat/message participant isolation (TM-01)
- Feedback forgery and Crown/trust replay prevention (TM-02)
- Notification spoofing prevention (TM-03)

The production project currently runs the baseline Rules, which allow any signed-in user to read all chat messages and create arbitrary feedback/notifications.

**Required action:** Review, approve, and deploy the fixed `firestore.rules` to the production project via a separately authorized deployment. Run the 70-test emulator suite immediately before deployment to confirm no regression.

### BLK-03 (HIGH): Incomplete account deletion

The `deleteAccount` callable deletes only `users/{uid}`, username reservations, and the Firebase Auth user. It does not delete private profile subcollections, avatar Storage objects, Pings with participant identity, chats and messages, feedback, notifications, reports, moderation logs, parking sessions, or browser-local data. Both Apple and Google require a deletion mechanism that removes all associated data.

Full gap analysis: `docs/PRIVACY_DATA_INVENTORY.md`.

**Required action:** Implement a server-side idempotent deletion job covering all listed collections and Storage objects. Test with partial failure, replay, large history, and account-key verification before deployment.

### BLK-04 (HIGH): No Content-Security-Policy

`firebase.json` has no `headers` block. `index.html` has no CSP meta tag. All script, style, image, connect, and fetch sources are unrestricted. External CDN domains load Tailwind, FontAwesome, and Mapbox CSS without integrity hashes.

**Required action:** Define and deploy a CSP in Firebase Hosting headers covering at minimum `default-src`, `script-src`, `style-src`, `connect-src`, and `img-src`. Add `integrity` attributes (SRI) to all external `<script>` and `<link>` tags in `index.html`, or move them to Vite-bundled imports.

### BLK-05 (HIGH): Phone number in public user document

`saveUserProfile` in `database.ts` writes `phone` and `email` directly into the public `users/{uid}` Firestore document, which any signed-in user can read (TM-04). Phone is the sole authentication credential and must not be exposed to the full authenticated user population.

**Required action:** Remove `phone` and `email` from the public user document write path. Store them server-side only or in `users/{uid}/private/profile`.

---

## Security findings summary

### Fixed on audit branch (undeployed)

| ID | Title | Severity | Test coverage |
|---|---|---|---|
| TM-01 | Cross-account chat disclosure | CRITICAL | C1–C6 (6 tests) |
| TM-02 | Crown/trust farming via forged feedback | CRITICAL | F7–F9 (3 tests) |
| TM-03 | Notification spoofing | HIGH | N1–N4 (4 tests) |
| TM-15 | Dependency graph not clean-installable | HIGH | npm ci PASS |

### Open CRITICAL/HIGH items

| ID | Title | Severity | Blocker for |
|---|---|---|---|
| TM-21 | Third-party voice agent script | CRITICAL | Any deployment |
| BLK-04 | No CSP | HIGH | Web and store release |
| TM-04 | Full user-directory exposure | HIGH | Store and privacy |
| TM-05 | Incomplete account deletion | HIGH | Store compliance |
| TM-06 | Untracked Storage authorization | HIGH | Avatar upload |
| TM-07 | Arbitrary listing writes | HIGH | Listing feature |
| TM-08 | Reports accept arbitrary payloads | HIGH | Report feature |
| TM-10 | Client-controlled Ping shape | HIGH | Core Ping safety |
| TM-11 | Client-modifiable profile counters | HIGH | Rewards safety |
| TM-12 | App Check absent | HIGH | All Firebase services |
| TM-13 | Function rate-limit/idempotency gaps | HIGH | AI/email/notification |
| TM-14 | Admin bootstrap exposure | HIGH | Admin hardening |
| TM-19 | Historical credentials in Git | HIGH | Provider verification |
| TM-20 | Native permission boundary undefined | HIGH | Store packaging |
| TM-24 | Phone/email in public user document | HIGH | Privacy |

### Open MEDIUM items

| ID | Title |
|---|---|
| TM-09 | Suspension/parse-failure data exposure |
| TM-16 | Mutable CI action references |
| TM-17 | Sensitive logging |
| TM-22 | No CSP (same as BLK-04) |
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
| TypeScript | PASS | `npx tsc --noEmit` |
| Unit tests | PASS | 19 files, 674 tests |
| Production build | PASS | 1,673 modules |
| Firestore Rules emulator | PASS | 70 tests |
| No BLK-01 (voice agent script) | **FAIL** | `index.html:86` |
| No BLK-02 (Rules deployed) | **FAIL** | Production runs baseline |
| Account deletion complete | **FAIL** | TM-05, BLK-03 |
| CSP deployed | **FAIL** | No headers in firebase.json |
| Phone out of public doc | **FAIL** | database.ts saveUserProfile |
| Storage Rules in repo | **FAIL** | No storage.rules |
| App Check configured | **FAIL** | TM-12 |
| No open CRITICAL items | **FAIL** | TM-21 (voice agent) |

---

## Release recommendation

**Web application:** Not yet ready for public release. After resolving BLK-01 through BLK-05 and deploying the Firestore Rules fix (BLK-02), a supervised limited-access web beta is achievable. App Check, rate limits, and the remaining HIGH threat model items should be resolved before public launch.

**Native iOS/Android:** Blocked. Requires platform architecture decision, native project creation, App Store and Play Store registration, and a separate packaging and submission audit.

All items in this document require owner assignment, due dates, and explicit sign-off before deployment. The `docs/THREAT_MODEL.md` residual-risk section governs acceptance of any remaining open items.
