# ParQueen Threat Model

Assessment date: 2026-07-24  
Method: repository inspection, Firebase Rules emulator tests, build inspection, and official platform guidance  
System baseline: `origin/main` at `b761795c52056c0d940da31969a142a7cdcd46a8`

## Security objectives

1. A user can disclose only the minimum location needed to exchange a Ping.
2. Only legitimate Ping participants can change claim/handoff state, message each other, or generate notifications and rewards.
3. Private profile, vehicle, location, message, report, and history data cannot be enumerated cross-account.
4. Admin actions require durable server-verified privilege and produce an immutable audit trail.
5. Client-controlled data cannot create server-side Crowns, trust, notifications, email, AI, or external-API cost without authorization, validation, idempotency, and abuse bounds.
6. Account deletion removes or irreversibly anonymizes all data linked to the account according to a published retention schedule.
7. A compromised browser credential or public Firebase configuration cannot bypass Firebase Rules, IAM, provider restrictions, or quotas.
8. Release inputs are reproducible, reviewed, scanned, and attributable.

## Assets

### Critical

- Firebase Auth identities, phone numbers, sessions, and custom claims.
- Precise current/saved location, Pings, routes, parking sessions, and geohashes.
- Private messages and participant relationships.
- Firestore and Storage authorization policies.
- Admin privileges, moderation actions, and audit logs.
- Server secrets for SendGrid, Gemini, and optional external APIs.

### High-value

- User profiles, usernames, vehicle details, avatar media, notification tokens.
- Reports, blocks, moderation state, trust statistics, Crowns, and titles.
- Parking history, claim/arrival/feedback state, and scheduled Pings.
- Provider quotas and billing for Firebase, Mapbox, Gemini, SendGrid, Socrata, Overpass, and Vision.
- Release workflow, dependency lockfiles, GitHub Actions permissions, signing identities, and future store credentials.

## Actors

- Unauthenticated internet client.
- Ordinary authenticated user.
- Abusive authenticated user controlling the browser and direct Firebase SDK/REST requests.
- Two or more colluding users farming rewards or harassment signals.
- Suspended or blocked user with a still-valid session.
- Malicious content sender or AI prompt author.
- Compromised dependency, CI action, developer workstation, or provider token.
- Firebase project administrator / Cloud IAM principal.
- ParQueen moderation or support operator.
- External provider and public-data source.

## Trust boundaries

1. **Browser ↔ Firebase Auth:** OTP, reCAPTCHA, session persistence, custom claims.
2. **Browser ↔ Firestore/Storage:** all browser requests are attacker-controlled; Rules are the authorization boundary.
3. **Browser ↔ callable Functions:** callable auth context is authoritative; payloads are untrusted.
4. **Firestore/Storage events ↔ Functions:** event documents may originate from malicious but Rules-permitted clients.
5. **Functions ↔ Google/third parties:** secret-bearing calls, quotas, retention, and untrusted responses.
6. **Browser ↔ Mapbox/public data:** public restricted browser token, precise coordinates, untrusted result data.
7. **Admin web surface ↔ Firebase:** hostname/UI gating is not authorization; custom claim + server enforcement is required.
8. **Repository/CI ↔ release artifacts:** lockfiles, Actions, npm lifecycle scripts, and future signing.
9. **Web application ↔ future native shell:** permissions, background execution, deep links, secure storage, and privacy manifests do not yet exist.

## Entry points

- Phone number and OTP flows.
- Profile, username, vehicle, avatar upload, email OTP.
- Ping create/edit/delete, claim, scheduled claim, ETA, cancellation, arrival, feedback.
- Chat text, quick replies, block, report.
- Location search, geocoding, reverse geocoding, directions.
- Parking-sign image/text analysis and AI smart replies.
- Street Intelligence public-data inputs and cached records.
- FCM token registration and push/in-app notification documents.
- Admin hostname, bootstrap callable, dashboard reads, and privileged callables.
- Legacy listings/host/garage UI and dormant code paths.
- Service worker and browser/local storage.

## Findings and abuse cases

| ID | Risk | Severity | Evidence / attack | Status |
|---|---|---:|---|---|
| TM-01 | Cross-account chat disclosure and tampering | CRITICAL | Baseline Rules allowed any signed-in user to read/write every chat and message | **Fixed on audit branch** with participant-only reads/writes, immutable participants, attributed bounded messages, and emulator tests |
| TM-02 | Crown/trust farming through forged feedback | CRITICAL | Any signed-in user could create/update arbitrary successful `spotFeedback`; two Functions award Crowns/trust from those events | **Fixed on audit branch**: feedback is bound to an occupied Ping, actual finder/claimer, deterministic one-time ID, immutable document |
| TM-03 | Notification spoofing/harassment | HIGH | Any signed-in user could create arbitrary notification documents targeting any UID | **Fixed on audit branch**: exact shape/type, bounded content/time, sender attribution, existing Ping, finder↔claimer relationship |
| TM-04 | Full authenticated user-directory exposure | HIGH | `users/{uid}` read permits every signed-in user; documents include phone/email, FCM token, last geohash/location-related data, vehicle and preference fields | **Partially addressed**: `phone` removed from root doc (TM-24 fix); `email` moved to `users/{uid}/private/account` subcollection. Remaining vehicle fields are intentionally copied into Ping documents for finder identification — see vehicle field inventory and options below. **PRODUCT DECISION REQUIRED** — see vehicle privacy options after this table. |
| TM-05 | Incomplete account deletion | HIGH | Callable deletes Auth, root user doc, and username reservation only; linked Pings, feedback, chats/messages, notifications, reports, sessions, avatars, moderation, and trust-event data remain | **Fixed in source** (commits `2d8d0cc`, `93aa02b`): `deleteAccount` callable now covers all user-linked collections, Storage, private subcollections, and Auth user; uses `db.recursiveDelete()` for subcollection trees; idempotent via `accountDeletionJobs/{uid}` with step tracking; `auth_time` freshness enforced (10-minute window); `requiredStep` helper ensures Auth not deleted if userDoc fails; paginated batch helpers handle >500-doc collections; `moderationLog` anonymized; pending production deployment and legal sign-off on audit-log retention |
| TM-06 | Untracked Storage authorization | HIGH | Avatar upload is active, but repository has no `storage.rules` and `firebase.json` has no Storage Rules target | **Partially fixed in source**: `storage.rules` created with owner-only avatar access; explicit `match /avatars/{uid}` and `match /avatars/{uid}/{allPaths=**}` cover both direct and subdirectory paths; 5 MB size cap and `image/*` content-type enforcement; catch-all deny; `firebase.json` updated with Storage Rules target and emulator port 9199. Also fixed: `deleteAccount` Storage step used `prefix: avatars/{uid}/` (trailing slash) which missed the actual file at `avatars/{uid}` — corrected. Deployed rules not yet verified against production state; production deployment requires a separately approved rollout |
| TM-07 | Arbitrary public listing writes | HIGH | `listings` is publicly readable and any signed-in user can write any document; legacy UI is hidden, not removed | **Fixed in source** (commit `93aa02b`): `allow write: if false` — client writes disabled; reads remain public; emulator test TM07-A/B/C added |
| TM-08 | Reports accept arbitrary identity/status payloads | HIGH | Any signed-in user may create any report shape, including forged reporter identity and oversized content | **Fixed in source** (commit `93aa02b`): `reporterId` bound to `request.auth.uid`; required fields validated; `type` enum; `reason` 1–1000 chars; `status == 'pending'`; self-report denied; 7 emulator tests added |
| TM-09 | Public suspensions and street data leakage/poisoning | MEDIUM/HIGH | Suspensions are world-readable; parse-failure updates allow broad field changes except four protected fields | **Partially fixed** (commit `93aa02b`): `parseFailures` update now `hasOnly(['count','lastSeenAt','location'])`; suspensions read-exposure not yet addressed |
| TM-10 | Client-controlled Ping shape and state metadata | HIGH | Create checks only `finderId`; many fields/types/timestamps/coordinate bounds are unvalidated | **Fixed in source** (commit `93aa02b`): exact `hasAll`/`hasOnly` schema; `status == 'available'`, `type == 'free'`; coordinate bounds; `pingMode` enum; `expiresAt > request.time`; 8 emulator tests added |
| TM-11 | Client can modify reward-adjacent profile counters | HIGH | Users cannot modify Crowns/title/trust fields, but other counters and nested objects need a complete allowlist rather than a denylist | **Fixed in source** (commit `93aa02b`): update rule replaced with explicit `hasOnly` allowlist of 14 client-writable fields; all server-owned fields blocked by exclusion; 6 emulator tests added |
| TM-12 | App Check absent from source | HIGH | No App Check initialization or enforcement evidence; public clients can directly exercise Auth, Firestore, Storage, and callable quotas | Open. Implement web/native providers after packaging decision, monitor metrics, then enforce per service in a separately approved rollout |
| TM-13 | Function rate-limit/idempotency gaps | HIGH | Email OTP, AI, external-data, notification, and several admin/user callables require detailed per-function quotas and replay analysis | **Partially addressed** (Phase J): `moderateContent` 60/hr, `createSegmentFromSweepNYC` 30/hr, `generateListingDescription` 20/hr added. All 23 callables inventoried — see rate-limit table below. Admin callables (`setStaffRole`, `adminSuspendUser`, `adminUnsuspendUser`, `adminUpdateReport`, `adminUpdateSegmentStatus`, `adminArchiveSuspension`) not rate-limited at the function layer (role guard is the primary control; function-layer limits deferred). Provider-console per-key quotas still required. |
| TM-14 | Admin bootstrap exposure | HIGH | `bootstrapAdmin` is remotely callable; check-then-set race allowed two concurrent calls to both bootstrap admin | **Fixed in source** (commit `93aa02b`): Firestore transaction on `adminBootstrap/singleton` sentinel replaces query-based check; second concurrent call fails inside the transaction; `adminBootstrap` collection is write-blocked in Rules; 3 emulator tests added |
| TM-15 | Dependency graph is not clean-installable | HIGH | Firebase 10 conflicts with Rules test library requiring Firebase 12; CI hides it with `--legacy-peer-deps` | Open. Select compatible line, regenerate lockfile, require plain `npm ci` |
| TM-16 | Mutable CI action references | MEDIUM | Checkout/setup actions use version tags; Gitleaks action is SHA-pinned | **Fixed**: `permissions: contents: read` and `timeout-minutes` on both workflows; all three actions SHA-pinned — `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2), `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020` (v4), `actions/setup-java@c1e323688fd81a25caa38c78aa6df2d33d3e20d9` (v4) |
| TM-17 | Sensitive logging | MEDIUM/HIGH | Functions log street candidate keys/cross streets and some IDs; browser logs may expose operational errors | **Partially fixed**: (1) SendGrid error handler no longer logs response body (`await res.body?.cancel()`) — body may include recipient email; (2) FCM reminder error masks UID to first-4+`***`; (3) `deleteAccount` already uses `maskedUid`. Remaining: no automated log-scrubbing test; precise coordinates appear in SweepNYC debug logs; AI image data paths not verified redacted. A structured `redactForLog(obj, fields)` utility and CI check are deferred |
| TM-18 | Public browser Firebase configuration | INFORMATIONAL | Firebase web configuration is bundled by design and is not a secret | Accept only with Rules, App Check, API restrictions, quotas, and no privileged server credentials in client |
| TM-19 | Historical credentials reachable in Git | HIGH historically | Prior audit identified committed provider credentials; status/rotation must be verified through provider metadata without payload access | **REPOSITORY SCAN COMPLETE — PROVIDER VERIFICATION PENDING**. Two credentials found in commit `0dd395f`: (1) `VITE_GEMINI_API_KEY` — Gemini API key; no browser restriction; key class: server-side API key usable from any origin; **HIGH — ROTATION OR DISABLEMENT REQUIRED BEFORE PUBLIC LAUNCH**; current use: Cloud Functions use Gemini via Secret Manager (not this key); provider activity status: UNKNOWN (console evidence required); responsible operator: engineering lead. (2) `VITE_GOOGLE_MAPS_API_KEY` — Maps JavaScript API key; had browser referrer restriction at time of commit; **current source analysis: Google Maps is NOT referenced anywhere in HEAD source** — Mapbox GL JS is the sole mapping library; the Maps key can be **DISABLED** rather than rotated; disablement is lower risk than rotation (no key material to re-expose); provider activity status: UNKNOWN; responsible operator: engineering lead. History rewrite deferred (commit `ca8dd88`). Required completion: before public launch. |
| TM-20 | Native permission/deep-link boundary undefined | HIGH store readiness | No native project exists, so manifest permissions, universal/app links, secure token storage, and background behavior cannot be audited | **ADR written** (`docs/NATIVE_PACKAGING_ADR.md`): Capacitor recommended; four options compared; audit checklist for each native artifact documented. **DECISION REQUIRED**: product/engineering must choose packaging approach and initiate native project creation before store submission. |
| TM-21 | Third-party voice agent script with placeholder ID in production | CRITICAL | `index.html` loads `https://cdn.voiceagent.ai/widget.js` with `data-agent-id="acme-corp-123"`. This external script runs in the same origin as the application, has full DOM access, can read localStorage (including Firebase auth state), make authenticated Firebase calls, and intercept inputs. The `acme-corp-123` ID is a vendor placeholder — either the script is unintentionally shipped or it points to a third-party operator's infrastructure | **Fixed in source** (commit `dd4c6f7`): script tag and importmap entry removed; `utils/securityAssertions.test.ts` asserts absence in source and dist |
| TM-22 | No Content-Security-Policy | HIGH | `firebase.json` hosting configuration has no `headers` section. `index.html` has no CSP meta tag. All script, style, connect, and media sources are unconstrained. Multiple external CDN domains (cdn.tailwindcss.com, cdnjs.cloudflare.com, esm.sh, api.mapbox.com) are loaded without integrity hashes | **Fixed in source (report-only phase)** (commit `608cbb5`): HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, and CSP-Report-Only added to `firebase.json`; `utils/cspConfig.test.ts` asserts directives; enforce phase 2 requires bundling Tailwind/FontAwesome and flipping to `Content-Security-Policy` |
| TM-23 | Logout does not clear session-bound localStorage | MEDIUM | `logoutUser()` calls `signOut(auth)` only. Keys including `lastReadChat_*`, `pendingUpdatesCount`, `lastViewedNotifications`, `savedSpot`, `parkingTimer`, `streetCleaningReminder`, and `hasSeenOnboarding` persist after sign-out. On shared or family devices, subsequent users can observe prior session activity | **Fixed in source** (commit `93aa02b`): `logoutUser()` now calls `localStorage.clear()` before `signOut`, preserving only the `theme` device preference |
| TM-24 | Phone and email written to public user document | HIGH | `saveUserProfile` in `database.ts` copies `phone` and `email` into the public `users/{uid}` Firestore document, which any signed-in user can read (TM-04). Phone is the sole auth credential and its public exposure enables contact by any user and data harvesting at scale | **Fixed in source** (commit `56434cb`): `phone`/`email` removed from `saveUserProfile` and `UserProfile` interface; `verifyEmailOTP` writes email to `users/{uid}/private/account` only; `handleSaveProfile` writes email to private subcollection; Firestore denylist updated (PD13-PD16); private account listener in App.tsx merges email back into local state; migration utility added |
| TM-25 | Smart-reply callable has no message size bound | MEDIUM | `generateSmartReplies` accepts `context` (caller-assembled chat history) with no length validation before forwarding to Gemini. An attacker can craft large or adversarial context strings targeting the AI system prompt or exhausting quota | **Fixed in source** (commit `93aa02b`): `lastMessage` validated ≤ 500 chars (`invalid-argument` on violation); `context` validated ≤ 2000 chars; both sliced to bounds before forwarding to Gemini |
| TM-26 | Vestigial client-side Gemini importmap entry | LOW | `index.html` importmap references `@google/genai@1.37.0` from esm.sh. `geminiService.ts` is confirmed to use Cloud Functions only (tested). The importmap entry is dead code and increases the attack surface description without benefit | **Fixed in source** (commit `dd4c6f7`): importmap entry removed alongside BLK-01 voice agent script |
| TM-27 | Avatar quarantine bypass via path crafting | HIGH | Client controls `{uploadId}` path segment and could attempt to write to candidate or published paths; non-`original` filename at the quarantine path could inject a second object outside the moderation flow | **Fixed in source**: `storage.rules` exact match on `/avatarUploads/{uid}/{uploadId}/original` (only the literal `original` filename allowed); secondary catch-all `/{fileName}` match denies any other filename; `avatarCandidates/` and `avatars/` have unconditional client-write denials; AV-01–AV-06 + AV-07 emulator/static tests; TM-13 note: cross-service pendingUploadId check not available in Rules — enforced by Step 0 transaction in `moderateAvatarUpload` |
| TM-28 | Avatar upload race condition — two parallel uploads compete for approval | HIGH | If a user initiates upload A then upload B before A's moderation event fires, both events could race to set `users/{uid}.avatarUrl`; older approval could overwrite the newer intent | **Fixed in source**: `pendingUploadId` guard written by client before upload (`users/{uid}/private/avatar`); Step 0 transaction checks and claims the slot; Step 6 approval transaction re-reads `pendingUploadId` and aborts if a newer upload claimed the slot; superseded source objects deleted immediately; tested MOD-27–MOD-33 |
| TM-29 | Orphaned avatar storage objects after failed moderation | MEDIUM | After `moderateAvatarUpload` crashes or exhausts retries, `avatarUploads/` and `avatarCandidates/` objects may persist indefinitely; Storage costs accumulate; no auto-expiry on Firebase Storage objects | **Partially fixed in source**: `_cleanOrphanedAvatarObjects` helper with bounded pagination (`maxResults=500`, `ORPHAN_MAX_OBJECTS_PER_RUN=1000`), 24-hour default cutoff, `sanitizeError` logged delete failures; `cleanAvatarOrphans` scheduled CF (every 24 h) enabled in source but not yet deployed; skips `processing`/`retry_pending` objects; never touches `avatars/` path; 7 emulator tests MOD-39–MOD-45 |
| TM-30 | Avatar download token URL not session-scoped | LOW | Published `avatarUrl` uses a permanent Firebase download token (not a time-limited signed URL); anyone who obtains the URL can access the file until the file is deleted; token is not revoked by sign-out | **Accepted design**: token is revoked when `avatars/{uid}` object is deleted (account deletion covers this via Storage cleanup step in `deleteAccount`); token rotation on re-approval generates a new URL and the old token becomes invalid when the old file is overwritten (verified MOD-37); signed URLs would require Admin SDK calls that fail in the Storage emulator; owner-read-only Storage Rules prevent direct URL-less access |

## Vehicle privacy options (TM-04, Phase J)

### Field inventory

| Field | Location | Readable by | Written by | Retention |
|---|---|---|---|---|
| `vehicleType` | `users/{uid}` root doc | Any signed-in user | Owner via Rules allowlist | Until account deletion |
| `vehicleBrand` | `users/{uid}` root doc | Any signed-in user | Owner via Rules allowlist | Until account deletion |
| `vehicleColor` | `users/{uid}` root doc | Any signed-in user | Owner via Rules allowlist | Until account deletion |
| `finderVehicleType` | `spots/{spotId}` Ping doc (create allowlist) | Any signed-in user | Finder at Ping create | Until Ping deletion |
| `finderVehicleBrand` | `spots/{spotId}` Ping doc (create allowlist) | Any signed-in user | Finder at Ping create | Until Ping deletion |
| `finderVehicleColor` | `spots/{spotId}` Ping doc (create allowlist) | Any signed-in user | Finder at Ping create | Until Ping deletion |
| `interestedUserVehicleType` | `spots/{spotId}` Ping doc (claim arm) | Any signed-in user | Claimer at claim | Until Ping deletion |
| `interestedUserVehicleBrand` | `spots/{spotId}` Ping doc (claim arm) | Any signed-in user | Claimer at claim | Until Ping deletion |
| `interestedUserVehicleColor` | `spots/{spotId}` Ping doc (claim arm) | Any signed-in user | Claimer at claim | Until Ping deletion |

Note: `interedUserVehicleBrand` in `firestore.rules` is a typo for `interestedUserVehicleBrand` — does not affect Rules enforcement but should be corrected before GA.

### OPTION A — retain public vehicle fields (current state)

No change to current architecture. Vehicle fields remain in `users/{uid}` and are embedded in Ping documents.

**Rationale:** The claimer needs to identify the finder's car when they arrive at the spot. Full vehicle details (type + brand + color) are required for real-world handoff.

**Risk:** Any signed-in user can enumerate all users' vehicle descriptions by reading `users/{uid}` documents. Vehicle description is low-sensitivity personally identifying information (does not enable tracking without location correlation).

**If chosen:** Document in `docs/PRIVACY_DATA_INVENTORY.md` that vehicle fields are intentionally public; notify users in the privacy policy.

### OPTION B — private saved vehicle profile with temporary minimal Ping/handoff disclosure (recommended)

Vehicle fields move from `users/{uid}` root doc to `users/{uid}/private/vehicle`. Only the active Ping document contains temporary vehicle details for the duration of the active handoff.

**Changes required:**
- Move `vehicleType`, `vehicleBrand`, `vehicleColor` to `users/{uid}/private/vehicle` (owner-only read/write per existing private subcollection Rules)
- Remove from `users/{uid}` Rules update allowlist; add to private subcollection Rules
- Client reads vehicle from `users/{uid}/private/vehicle` at profile load (owner-only listener)
- Finder Ping create: read vehicle from private subcollection server-side (Cloud Function) OR include vehicle fields from the authenticated create (client still controls); OR remove from Ping entirely and add a server-lookup step at claim time
- At Ping expiry or completion: clear `finderVehicle*` and `interestedUserVehicle*` from Ping document (server-side cleanup step)
- Migration: write existing `users/{uid}.vehicleType/Brand/Color` to private subcollection and remove from root doc

**Risk reduction:** Eliminates cross-user vehicle enumeration from the public user directory. Vehicle data is still briefly visible during active Pings (necessary for handoff), but not permanently queryable.

**If chosen:** Requires client refactor (~2 engineer-days) plus a production migration utility.

### Decision

**Status: PRODUCT DECISION REQUIRED**
**Recommendation: Option B**
**Owner: Product / Legal**

## Rate-limit inventory (TM-13, Phase J)

All 23 callable exports audited 2026-07-30.

| Callable | Auth required | Rate limit | Notes |
|---|---|---|---|
| `generateEmailOTP` | ✓ signed-in | 10/hr per UID + 10/hr per emailHash | HMAC-peppered inbox key |
| `verifyEmailOTP` | ✓ signed-in | 10/15 min per UID | |
| `claimUsername` | ✓ signed-in | 5/hr per UID | |
| `deleteAccount` | ✓ signed-in | 3/day per UID | auth_time freshness ≤10 min |
| `analyzeSign` | ✓ signed-in | 30/hr per UID | Gemini Vision; `enforceAppCheck: false` |
| `generateSmartReplies` | ✓ signed-in | 20/hr per UID | Gemini; `enforceAppCheck: false` |
| `moderateContent` | ✓ signed-in | **60/hr per UID** | Added Phase J |
| `createSegmentFromSweepNYC` | ✓ signed-in | **30/hr per UID** | Added Phase J; external API calls |
| `generateListingDescription` | ✓ signed-in | **20/hr per UID** | Added Phase J; Gemini; `enforceAppCheck: false` |
| `bootstrapAdmin` | ✓ `@parqueen.app` email | None (one-time; singleton transaction blocks replay) | Bootstrap disabled after first use |
| `setStaffRole` | ✓ `role === 'admin'` | None (role guard is primary control) | Admin-only; audit-logged |
| `adminSuspendUser` | ✓ `role === 'admin'` | None | Admin-only; audit-logged |
| `adminUnsuspendUser` | ✓ `role === 'admin'` | None | Admin-only; audit-logged |
| `adminUpdateReport` | ✓ `role === 'admin'` | None | Admin-only; audit-logged |
| `adminUpdateSegmentStatus` | ✓ `role === 'admin'` | None | Admin-only; audit-logged |
| `adminArchiveSuspension` | ✓ `role === 'admin'` | None | Admin-only; audit-logged |
| `sendPingNotification` | ✓ signed-in | None | Firestore Rules verify finder↔claimer relationship |
| `sendChatMessage` | ✓ signed-in | None | Bounded text; participant check in Rules |
| `reportUser` | ✓ signed-in | None | Rules-enforced reporter binding |
| `updateFCMToken` | ✓ signed-in | None | No external cost; token ownership check |
| `cleanAvatarOrphans` | Scheduled (no auth) | N/A | Distributed lease; not user-callable |
| `moderateAvatarUpload` | Storage trigger (no auth) | N/A | Not user-callable |
| Any remaining Firestore/scheduled triggers | Internal | N/A | Not user-callable |

**Remaining gaps:** Admin callables have no function-layer rate limit; a compromised admin credential could still exhaust Firestore write quota. Compensating controls: role guard, audit log, provider-console per-UID quotas. Function-layer admin rate limits deferred until a concrete abuse scenario is observed.

**Provider-console actions still required:** per-project Gemini quota limits, Maps billing alerts, SendGrid daily cap.

## Required security invariants

### Ping

- Create: `finderId == auth.uid`, exact versioned keys, bounded coordinates/geohash/times, approved initial status, no claim/reward/admin fields.
- Claim: only unclaimed live Pings; transaction; claimer identity from auth; one active claim; bounded ETA/expiry.
- Transition: finite state machine; only finder or active claimer; immutable ownership/location/history fields.
- Expiry/cleanup: server-owned and idempotent; clients cannot backdate/extend outside explicit bounds.

### Messaging

- Chat reads and list queries require participant membership.
- Participants and chat ID are immutable and deterministic.
- Message sender equals auth UID; text is bounded and moderated server-side for enforceable policy.
- Block relationship must prevent new sends/reads according to product policy, not only hide UI.
- Report content is accessible only to reporter where appropriate and moderators; status is server/admin-owned.

### Rewards/trust

- Only one feedback record per Ping+driver.
- Feedback must correspond to an occupied Ping and its actual participants.
- Reward event processing is idempotent even under retries.
- Clients cannot write Crowns/title/trust or processed-event markers.

### Admin

- Every callable checks `request.auth` and current custom claim server-side.
- Bootstrap is disabled after a single controlled setup or requires an out-of-band allowlist.
- Admin UI hostname checks are presentation only.
- Every mutation writes a server timestamped audit record; audit records are append-only and non-client-readable.

## Avatar access policy decision (2026-07-28)

**Decision: avatars are intentionally public via Firebase Storage download URLs.**

### Rationale

Firebase Storage download URLs are long opaque bearer tokens (256-bit entropy). They are accessible to any HTTP client that possesses the URL — security rules do not apply to download URL access. This is the standard model used by social apps (Twitter, Instagram, etc.) for profile photos.

ParQueen avatars are Parsona-generated SVG composites. They are not photographs and contain no biometric or location data.

### Controls in place

| Control | Mechanism |
|---|---|
| Upload authorization | Storage Rules: only the owning UID may write to `avatars/{uid}` |
| Content moderation | `moderateAvatarUpload` Cloud Function (Google Vision Safe Search) deletes non-compliant uploads within seconds |
| Account deletion | `deleteAccount` function step `storage` deletes `avatars/{uid}` via Admin SDK |
| URL obfuscation | Download URL tokens are not guessable; enumeration requires a leaked `avatarUrl` value |

### Accepted risk

A user who knows another user's `avatarUrl` can access the image without authentication. This is acceptable because:
1. `avatarUrl` is stored in the public `users/{uid}` document (readable by any signed-in user — intended for profile display).
2. The image contains no identifying information beyond visual style choices.
3. Revoking access requires deleting the Storage object and re-uploading (operationally feasible via Admin SDK).

### Remaining gap

If a user's account is deleted but their `avatarUrl` was previously copied by another party, the token becomes a dead link (the object is deleted). No further action is needed.

**Owner:** Product/Legal  
**Status:** ACCEPTED — no code changes required.

## Verification plan

- Rules emulator: cross-user direct reads, constrained queries, creates, mutations, deletes, extra fields, malformed types, boundary timestamps, replay attempts.
- Functions: Auth/App Check absence, role tests, malformed payloads, duplicate event IDs, transient provider failure, retry, quota, and log redaction.
- Storage emulator: owner/non-owner, unauthenticated, path traversal, MIME spoof, oversize upload, moderation state, delete.
- Browser: CSP, bundle secret scan, local storage, service worker, auth teardown, blocked-user behavior.
- Provider consoles: App Check enforcement, API restrictions, IAM, quotas, secret versions/status, alerts, retention.
- Native release candidate: permission manifests, deep links, background lifecycle, secure storage, privacy manifests, exported Android components, backup policy.

## Residual-risk acceptance

No CRITICAL/HIGH item should be accepted implicitly. Each open item requires an owner, due date, compensating controls, evidence, and explicit release decision in `docs/RELEASE_READINESS_AUDIT_2026.md`.
