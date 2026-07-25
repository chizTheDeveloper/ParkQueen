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
| TM-04 | Full authenticated user-directory exposure | HIGH | `users/{uid}` read permits every signed-in user; documents include phone/email, FCM token, last geohash/location-related data, vehicle and preference fields | Open. Split public profile projection from private account/device state; migrate client lookups; deny broad full-doc reads |
| TM-05 | Incomplete account deletion | HIGH | Callable deletes Auth, root user doc, and username reservation only; linked Pings, feedback, chats/messages, notifications, reports, sessions, avatars, moderation, and trust-event data remain | Open store/privacy blocker. Implement server-side deletion/anonymization plan with retries, idempotency, audit, Storage cleanup, and emulator/integration tests |
| TM-06 | Untracked Storage authorization | HIGH | Avatar upload is active, but repository has no `storage.rules` and `firebase.json` has no Storage Rules target | Open. Export current deployed policy without secrets, define owner/content/size/type rules, add emulator tests, then coordinate a separately approved deployment |
| TM-07 | Arbitrary public listing writes | HIGH | `listings` is publicly readable and any signed-in user can write any document; legacy UI is hidden, not removed | Open. Disable client writes until first-party listing ownership/schema/moderation is designed, or implement owner-only exact validation |
| TM-08 | Reports accept arbitrary identity/status payloads | HIGH | Any signed-in user may create any report shape, including forged reporter identity and oversized content | Open. Bind reporter to auth UID; validate exact keys, target, reason/type enum, timestamps, and immutable status |
| TM-09 | Public suspensions and street data leakage/poisoning | MEDIUM/HIGH | Suspensions are world-readable; parse-failure updates allow broad field changes except four protected fields | Open. Restrict suspension data to necessary public projection; bind parse-failure mutations to server/callable or exact increment-only fields |
| TM-10 | Client-controlled Ping shape and state metadata | HIGH | Create checks only `finderId`; many fields/types/timestamps/coordinate bounds are unvalidated | Open. Add exact create schema, enum/range/time bounds, server-owned field denial, and adversarial tests |
| TM-11 | Client can modify reward-adjacent profile counters | HIGH | Users cannot modify Crowns/title/trust fields, but other counters and nested objects need a complete allowlist rather than a denylist | Open. Replace public user create/update denylists with versioned exact-field validators |
| TM-12 | App Check absent from source | HIGH | No App Check initialization or enforcement evidence; public clients can directly exercise Auth, Firestore, Storage, and callable quotas | Open. Implement web/native providers after packaging decision, monitor metrics, then enforce per service in a separately approved rollout |
| TM-13 | Function rate-limit/idempotency gaps | HIGH | Email OTP, AI, external-data, notification, and several admin/user callables require detailed per-function quotas and replay analysis | Open pending Functions audit; provider-console limits also required |
| TM-14 | Admin bootstrap exposure | HIGH | `bootstrapAdmin` is remotely callable; exact one-time safeguards and deployed IAM/custom-claim state require dedicated verification | Open pending line-by-line audit and negative tests |
| TM-15 | Dependency graph is not clean-installable | HIGH | Firebase 10 conflicts with Rules test library requiring Firebase 12; CI hides it with `--legacy-peer-deps` | Open. Select compatible line, regenerate lockfile, require plain `npm ci` |
| TM-16 | Mutable CI action references | MEDIUM | Checkout/setup actions use version tags; Gitleaks action is SHA-pinned | Open. Pin all third-party Actions by commit SHA and declare job timeouts/least permissions |
| TM-17 | Sensitive logging | MEDIUM/HIGH | Functions log street candidate keys/cross streets and some IDs; browser logs may expose operational errors | Open. Create structured redaction policy and test that precise coordinates, tokens, phone/email, message bodies, and AI images are excluded |
| TM-18 | Public browser Firebase configuration | INFORMATIONAL | Firebase web configuration is bundled by design and is not a secret | Accept only with Rules, App Check, API restrictions, quotas, and no privileged server credentials in client |
| TM-19 | Historical credentials reachable in Git | HIGH historically | Prior audit identified committed provider credentials; status/rotation must be verified through provider metadata without payload access | Current exposed-value activity not revalidated in this source-only pass; history decision remains coordinated and separate |
| TM-20 | Native permission/deep-link boundary undefined | HIGH store readiness | No native project exists, so manifest permissions, universal/app links, secure token storage, and background behavior cannot be audited | Open packaging blocker |

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

## Verification plan

- Rules emulator: cross-user direct reads, constrained queries, creates, mutations, deletes, extra fields, malformed types, boundary timestamps, replay attempts.
- Functions: Auth/App Check absence, role tests, malformed payloads, duplicate event IDs, transient provider failure, retry, quota, and log redaction.
- Storage emulator: owner/non-owner, unauthenticated, path traversal, MIME spoof, oversize upload, moderation state, delete.
- Browser: CSP, bundle secret scan, local storage, service worker, auth teardown, blocked-user behavior.
- Provider consoles: App Check enforcement, API restrictions, IAM, quotas, secret versions/status, alerts, retention.
- Native release candidate: permission manifests, deep links, background lifecycle, secure storage, privacy manifests, exported Android components, backup policy.

## Residual-risk acceptance

No CRITICAL/HIGH item should be accepted implicitly. Each open item requires an owner, due date, compensating controls, evidence, and explicit release decision in `docs/RELEASE_READINESS_AUDIT_2026.md`.
