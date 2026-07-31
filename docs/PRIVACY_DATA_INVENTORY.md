# ParQueen Privacy and Data Inventory

Assessment date: 2026-07-24  
Scope: source-controlled web client, Firestore Rules/indexes, Cloud Functions, service worker, local browser storage, and declared third-party integrations  
Status: draft grounded in repository evidence; provider-console retention and telemetry require verification

## Data minimization principles

- A phone-auth UID is the canonical account key; do not duplicate phone/email/location into public documents without a demonstrated feature need.
- Current precise location is ephemeral unless the user explicitly creates a Ping or saves My Car.
- Public Pings expose only the precision and duration required for handoff.
- Server-owned trust, moderation, role, and reward fields cannot be client-written.
- AI inputs are sent only for an explicit user action and are not used for unrelated training unless separately disclosed and consented.
- Deletion removes or irreversibly anonymizes all linked personal data, subject only to documented legal/security retention.

## Data store inventory

| Store/path | Representative personal data | Purpose | Access in baseline | Retention/deletion evidence | Risk / required action |
|---|---|---|---|---|---|
| Firebase Auth user | UID, phone, provider/session metadata, custom claims | Account authentication/admin role | Firebase Auth/IAM; callable auth context | `deleteAccount` deletes Auth user | OTP abuse controls and recent-auth/deletion behavior need verification |
| `users/{uid}` | username/name, phone/email, avatar URL, language/theme/preferences, vehicle, notification token/radius, last geohash, saved parked location, blocked users, Crowns/trust/moderation | Profile, notifications, map, trust | Any signed-in user can read full doc; owner update denylist; admin | Root doc deleted by callable | **HIGH:** split public profile and private account/device data; exact allowlists |
| `users/{uid}/private/profile` | DOB, gender, home area, driver type, age range | Optional private profile | Owner read/write; admin read | Not deleted by root-doc deletion | Delete recursively; reconsider collection/necessity and retention |
| `users/{uid}/processedTrustEvents` | event IDs | Reward idempotency | Server only | Not deleted by root-doc deletion | Delete or retain pseudonymously under documented anti-fraud schedule |
| `usernames/{name}` | username → UID | Uniqueness | Signed-in read; server write | Deleted by account callable query | Avoid enumeration if not needed; normalize and rate-limit lookups |
| `spots/{id}` | exact coordinates/address/geohash, finder UID/name/avatar/title/vehicle, claimer UID/name/vehicle/title, schedule/ETA/status/timestamps | Core Ping handoff/history | Live available/interested to signed-in; history participants/admin | Scheduled cleanup for expiry; account deletion does not cover | Define history retention and anonymize/delete linked records |
| `chats/{id}` | participants, names, last message/context/timestamps | Conversation list | Baseline any signed-in; fixed on audit branch to participants | Account deletion does not cover | Delete messages/chats or anonymize remaining participant history |
| `chats/{id}/messages/{id}` | sender UID, message text, timestamp | Handoff messaging | Baseline any signed-in; fixed to participants | No retention/deletion path | Define short operational retention; block/report preservation rules |
| `spotNotifications/{id}` | target/sender UID, Ping ID, message/type/timestamp | In-app handoff alerts | Target read/delete; baseline arbitrary auth create; fixed participant-bound | No cleanup/deletion evidence | TTL/cleanup and account deletion |
| `spotFeedback/{id}` | Ping/driver/finder IDs, outcome/reason, address, timestamp | Handoff result, history, rewards | Creator read; admin; baseline arbitrary auth create/update; fixed immutable participant-bound | No general retention/deletion | Deterministic ID prevents duplicates; define history/anonymization |
| `reports/{id}` | reporter/reported UIDs, reason/type, conversation, status/admin notes/times | Abuse response | Any signed-in create; admin read/update | No deletion/retention | Validate reporter; retain security evidence for bounded period, anonymize deleted accounts |
| `moderationLog/{id}` | moderation decision and subject identifiers | Abuse audit | Server only | No schedule | Define security retention and access logging |
| `adminAuditLog/{id}` | admin UID, target IDs, action, reason, metadata | Privileged accountability | Admin read, server write | No schedule | Append-only; bounded compliance/security retention |
| `avatarModeration/{uid}` | SafeSearch result/status | Avatar safety | Owner read, server write | Root deletion does not cover | Delete with account after Storage object cleanup |
| Storage `avatars/{uid}` | user photo | Profile avatar | Deployed Rules unknown; upload active | Account callable does not delete | **HIGH:** track/test Storage Rules and delete object with account |
| `emailVerificationCodes/{uid}` | email, OTP hash/code metadata, expiry/attempts depending implementation | Email verification | Server only | Function expiry behavior needs audit | Short TTL; never log code/email; delete after success/expiry/account deletion |
| `parkingSessions/{uid}` | precise saved coordinates/address/street, time/reminder, FCM token | My Car/reminders | Owner/admin | No deletion/TTL | Delete on stop/account deletion; minimize duplicate FCM token |
| `listings/{id}` | location, photo/content, host identity, rental data | Dormant private parking feature | Public read; any auth write | None | Disable or implement ownership/moderation/retention before activation |
| `streetSegments` + `streetRules` | public street geometry/rules, provider metadata, admin/source | Street Intelligence cache | Public read; admin write | Archive/supersession, no deletion schedule | Generally non-personal; ensure no user coordinates/UIDs leak into cache |
| `parseFailures/{id}` | sign text/location, counts/timestamps, resolution | Data-quality triage | Admin read; broad signed-in create/update | No schedule | Minimize location precision, exact mutation rules, delete after resolution window |
| `suspensions/{id}` | date/location/rule metadata (street-cleaning suspensions) | Public parking rules | Public read, admin write | Archive support | Confirm collection is civic schedule, not user suspension; rename/document to avoid ambiguity |
| `stats/{id}` | aggregate Ping counters | Product aggregate | Admin read/server write | Indefinite aggregate | Ensure no personal dimensions |
| Browser `localStorage` | onboarding/tour flags, language/theme/location choice, message-read timestamps, saved My Car state depending path | UX persistence | Same-origin script | Ad hoc; logout/deletion cleanup incomplete | Inventory exact keys and clear sensitive/account-keyed data on logout/delete |
| Service worker/browser notification state | push payload title/body, token via user doc | Notifications | Browser/Firebase messaging | Browser/provider controlled | Avoid sensitive content on lock screen; token rotation/removal |
| Function/Hosting/provider logs | request metadata, IDs, errors, possibly locations/content | Operations/security | Cloud IAM/provider | Console settings unknown | Redaction and retention policy required |

## Third-party processing

| Processor/source | Data sent or received | Purpose | Required verification |
|---|---|---|---|
| Firebase / Google Cloud | Auth identifiers, Firestore/Storage content, FCM token/payload, Function request/log metadata | Core backend | Region, retention, App Check, IAM, DPA, deletion, backup/log behavior |
| Mapbox | browser token, IP/request metadata, search terms, coordinates, route endpoints | Maps, geocoding, directions | Token restrictions, telemetry/settings, retention, mobile SDK terms after packaging |
| Google Gemini | sign image/text, chat message/context for replies, listing text where dormant feature is used | AI analysis/generation | Secret version, model, region, retention/training terms, safety, quotas, deletion |
| Google Cloud Vision | avatar object/image and moderation result | Avatar safety | Storage trigger scope, retention, result fields, failure behavior |
| SendGrid | email address, OTP email content, delivery metadata | Email verification | Secret status, suppression/log retention, DPA, rate limits |
| SweepNYC | coordinates and request metadata | Street sign data | Terms, availability, retention/logging |
| NYC Open Data / Socrata | street/borough queries, optional token, request metadata | Street cleaning fallback | Token/quota, terms, caching |
| Overpass / OpenStreetMap | coordinate-area/street queries, request metadata | Street geometry/cross streets | Usage policy, rate limits, caching |

## App-store disclosure mapping seed

### Apple App Privacy

Likely collected and linked to identity:

- Contact info: phone, email, name.
- User ID and other identifiers.
- Precise location.
- User content: messages, photos, support/report content.
- Product interaction and other usage data: Pings, claims, searches, feedback.
- Diagnostics if provider logs/crash telemetry retain account/device linkage.

Provider-console answers must reflect every shipped native SDK, not only direct application writes.

### Google Play Data safety

Likely declarations:

- Precise location.
- Name, email, phone number, user IDs.
- Other in-app messages.
- Photos.
- App interactions and other user-generated content.
- Device or other identifiers, including Firebase installation/messaging identifiers.
- Purposes: app functionality, account management, developer communications/notifications, fraud prevention/security, and possibly analytics only where evidenced.

Do not declare advertising, marketing, predictive-model training, or data sharing unless the shipped behavior and provider contracts support those answers.

## Account deletion gap analysis

Current callable deletes:

1. `users/{uid}` root document.
2. Username reservations whose `uid` matches.
3. Firebase Auth user.

It does **not** currently delete/anonymize:

- private profile and processed trust subcollections;
- avatar Storage object and avatar moderation record;
- Pings and participant identity embedded in other users' Pings;
- chats/messages;
- feedback, notifications, reports, moderation/admin logs;
- parking session;
- verification code;
- browser-local account data;
- provider logs/backups/suppressions.

Required design:

- Publish a per-store deletion policy separating immediate deletion, necessary security/legal retention, and anonymization.
- Use a server-owned idempotent deletion job with progress state, retries, and least privilege; delete Auth last or preserve a signed job identity.
- Prevent new writes during deletion.
- Delete Storage and Firestore subcollections explicitly; deleting a Firestore parent does not delete subcollections.
- Anonymize records required for the other participant's transaction history without retaining direct identifiers or precise location longer than necessary.
- Remove/revoke notification tokens and clear local account-keyed storage.
- Provide in-app status and an external web request path.
- Test partial failure, replay, large histories, and completion proof.

## Retention decisions required before release

| Data | Proposed starting point for product/legal review |
|---|---|
| Active Pings/notification docs | Operational lifetime plus short abuse/debug grace; use TTL/cleanup |
| Precise location history | Minimize to active handoff; coarsen/anonymize completed history |
| Messages | Short bounded handoff/support window unless reported |
| Reports/moderation evidence | Bounded safety/security period with restricted access |
| Email OTP | Delete immediately after verification; automatic expiry within minutes |
| FCM tokens | Until logout/token invalidation/account deletion; remove invalid tokens |
| AI inputs/outputs | Ephemeral where provider supports it; no unrelated training |
| Logs | Short operational/security window with redaction and access control |
| Admin audit | Longer bounded security/compliance period, pseudonymized after account deletion where feasible |

Final periods require counsel/product approval and must match public policy, provider configuration, and store declarations.
