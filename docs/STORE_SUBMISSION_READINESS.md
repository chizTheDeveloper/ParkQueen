# ParQueen Store Submission Readiness

Assessment date: 2026-07-24  
Evidence baseline: `origin/main` at `b761795c52056c0d940da31969a142a7cdcd46a8`  
Status: **Not ready for Apple App Store or Google Play submission**

This document distinguishes source-controlled evidence from items that require Apple Developer, App Store Connect, Google Play Console, Firebase Console, or provider-account verification. It is not legal advice.

## Executive decision

ParQueen is presently a deployable Vite web application, not a reproducible native mobile application. Although Expo and React Native packages are installed and `ios`/`android` npm scripts exist, the repository has no Expo app configuration, EAS configuration, native iOS or Android projects, bundle identifiers, entitlements, permission manifests, privacy manifest, signing setup, store metadata, or native release pipeline. The npm `main` field points to an absent `index.js`; the actual web entry is `index.tsx`.

The app therefore cannot currently produce an auditable `.ipa` or Android App Bundle from this repository. Store privacy, permission, SDK, signing, and binary-behavior claims remain unverifiable until one packaging architecture is explicitly selected and checked in.

## Packaging evidence

| Evidence | Repository result | Readiness impact |
|---|---|---|
| Vite web entry/build | `index.tsx`, `index.html`, `vite.config.ts`; production build passes | Web/Hosting only |
| Expo dependencies/scripts | Expo 50 and React Native 0.73 packages; `expo start --ios/--android` scripts | Dependencies alone do not define an app |
| Expo configuration | No `app.json`, `app.config.js`, `app.config.ts`, or `eas.json` | No bundle IDs, native permissions, build profiles, icons, or signing contract |
| Native iOS project | No `ios/`, Xcode project/workspace, `Info.plist`, entitlements, Podfile, or `PrivacyInfo.xcprivacy` | Cannot build or review iOS binary |
| Native Android project | No `android/`, manifest, Gradle files, signing config, or ProGuard/R8 config | Cannot build or review Android App Bundle |
| Capacitor wrapper | No Capacitor dependency or configuration | No alternate web-wrapper packaging path |
| Install reproducibility | `npm ci` fails on Firebase 10 / Rules test library 5 peer conflict | Blocks clean CI and reviewer setup |

### Architecture decision required

Choose one path before store implementation:

1. **Expo/React Native application:** port the Vite DOM/Mapbox GL JS experience to supported native components and establish Expo application/EAS configuration. This is not a packaging-only change because the current UI relies extensively on browser DOM, CSS, `window`, `navigator`, and Mapbox GL JS.
2. **Capacitor web wrapper:** preserve the Vite UI and add a native shell, then explicitly implement/test native location, camera/photo, notification, deep-link, keyboard, safe-area, offline, privacy-manifest, and lifecycle behavior. This is likely the smaller migration, but still requires native projects and store-specific testing.
3. **Web/PWA only:** continue Firebase Hosting and do not claim App Store/Play readiness.

Do not maintain dormant Expo dependencies/scripts as evidence of a native app. Once the architecture is selected, remove the unused stack or make it the tested release path.

## Current official Apple requirements

Primary sources reviewed on 2026-07-24:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple upcoming submission requirements](https://developer.apple.com/news/upcoming-requirements/)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)

| Requirement | Repository evidence | Status |
|---|---|---|
| Build submissions with current required toolchain | Since 2026-04-28 Apple requires Xcode 26 and an iOS 26-family SDK; no native project/build exists | **BLOCKER** |
| In-app account deletion when account creation exists | Settings exposes deletion; callable deletes Auth, `users/{uid}`, and username reservation only | **BLOCKER** — associated user data is not comprehensively deleted |
| UGC filtering, reporting, blocking, and published contact information | Message/username moderation, reporting, blocking, and contact view exist | Partial; timeliness/coverage and content-level reporting require audit |
| Alternative to denied location where possible | Search can accept a destination, but primary Ping/location flow depends on geolocation | Partial; native permission UX unimplemented |
| App Privacy responses include first- and third-party collection | Precise location, phone, profile data, messages, photos, identifiers, usage/Pings, and third-party processing exist | **BLOCKER** until inventory and console declarations are completed |
| Public privacy-policy URL | Settings links `https://parqueen.app/privacy`; reachability/content must be verified | Provider/live verification required |
| Privacy manifest and required-reason API declarations | No native target or `PrivacyInfo.xcprivacy` | **BLOCKER** |
| Updated age-rating questionnaire | No App Store Connect evidence | Console verification required |
| Reviewer access | Phone OTP is the only login; no documented durable reviewer flow | **BLOCKER** — provide review credentials/test-phone procedure that does not depend on a founder's device |
| Sign in with Apple | ParQueen uses its own phone-based account system, not third-party/social login | Not required under the guideline's stated exception, subject to App Review confirmation |

## Current official Google Play requirements

Primary sources reviewed on 2026-07-24:

- [Target API requirements](https://developer.android.com/google/play/requirements/target-sdk)
- [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Developer Program Policy / User Data](https://support.google.com/googleplay/android-developer/answer/17105854)
- [Data safety form guidance](https://support.google.com/googleplay/android-developer/answer/10787469)
- [UGC moderation requirements](https://support.google.com/googleplay/android-developer/answer/12923286)
- [Background location policy](https://support.google.com/googleplay/android-developer/answer/9799150)
- [AI-generated content policy](https://support.google.com/googleplay/android-developer/answer/14094294)

| Requirement | Repository evidence | Status |
|---|---|---|
| Target current Android API | Starting 2026-08-31, new apps/updates must target API 36; no Android manifest/Gradle target exists | **BLOCKER** |
| In-app and external web account-deletion paths | In-app action exists; no external deletion-request URL is documented; associated data deletion is incomplete | **BLOCKER** |
| Accurate Data safety form, including SDK behavior | Same data classes listed for Apple plus Firebase installation/messaging identifiers | **BLOCKER** until native binary and data inventory are finalized |
| Public, accessible, non-geofenced privacy policy | In-app link exists; live-policy content and availability require verification | Provider/live verification required |
| Prominent disclosure and declaration for background location | Current web code watches foreground location; native permissions do not exist, so background behavior is unknown | Must avoid background permission unless a separately approved core need is proven |
| UGC terms, report user/content, block user, and timely moderation | User report/block controls exist in messaging; content-level coverage and operational SLA need verification | Partial |
| AI content safety and user feedback | Gemini supports replies/sign analysis; applicability and reporting controls need detailed Phase 12 review | Partial |
| App Bundle, signing, package name, Play App Signing | No Android package/build configuration | **BLOCKER** |
| Content rating, target audience, store listing, support contacts | No Play Console/store metadata evidence | Console verification required |

## Data disclosure seed list

This is a preliminary source-derived list; `PRIVACY_DATA_INVENTORY.md` is authoritative after Phase 10.

- Contact information: phone number, optional email, optional name.
- Identifiers: Firebase Auth UID, username, Firebase installation/messaging token, app/browser storage identifiers.
- Precise location: current coordinates, saved vehicle position, Ping coordinates, geohash, searched/destination coordinates, route endpoints.
- User content: in-app messages, profile/avatar photos, parking-sign photos/text, reports, listing content where enabled.
- Usage/product data: Pings, claims/interests, scheduled times, arrival/feedback, Crowns/trust events, searches, notification preferences.
- Device/application operations: notification token, timestamps, language/theme/preferences, error and Function logs.
- Third-party processors/features: Firebase/Google Cloud, Mapbox, Gemini, SendGrid, SweepNYC, NYC Open Data/Socrata, Overpass/OpenStreetMap.

## Immediate store blockers

1. Select and implement a single native packaging architecture.
2. Repair clean dependency installation.
3. Make account deletion comprehensive, idempotent, and testable; publish an external deletion-request route for Google Play.
4. Complete privacy inventory and reconcile the public policy with actual behavior. The checked-in view currently claims predictive-model training, P2P rentals/earnings, Leaflet use, AES-256 specifics, and portability behavior that require evidence and may not match the active product.
5. Define native foreground-only location, camera/photo, and notification permissions with just-in-time bilingual disclosures.
6. Add native privacy manifests/required-reason declarations and Android Data safety inputs after the binary dependency graph is final.
7. Establish reviewer-safe phone authentication, support, moderation response, and account-deletion verification procedures.
8. Produce signed release candidates and test them on physical iOS/Android devices before completing console declarations.

## Provider-console verification checklist

- Apple Developer membership, legal entity, agreements, bundle ID, certificates/profiles, App Store Connect roles.
- App Store privacy responses, privacy/support URLs, age rating, encryption/export compliance, reviewer notes, test account.
- Google Play developer verification, package name, Play App Signing, target audience/content rating, Data safety, deletion URL, app access instructions.
- Firebase App Check enforcement, Auth quotas/abuse controls, IAM, retention/log settings, deletion extensions/jobs, APNs/FCM configuration.
- Mapbox mobile SDK/token scope and URL/application restrictions for the chosen native architecture.
- Gemini, SendGrid, and Socrata quotas, retention, data-processing terms, and operational owners.

## Avatar download-token rotation — pre-deployment smoke test

This is a controlled 6-step procedure. Run it in a staging environment, never production, before first deployment of the avatar pipeline. Requires two test accounts (A = avatar owner, B = reviewer).

**Step 1 — Record current state.**
Sign in as A. Open Firebase console → Firestore → `users/{uid_A}`. Copy `avatarUrl`. Extract the token value from the `?alt=media&token=` query parameter. Fetch the URL in a browser tab; confirm HTTP 200 and the image loads. Record as `URL_OLD / TOKEN_OLD`.

**Step 2 — Upload a replacement.**
As A, upload a new avatar image through the app UI. Confirm the client writes `pendingUploadId` to `users/{uid_A}/private/avatar` before the upload begins (verify in Firestore). Wait for `moderateAvatarUpload` to complete (check `avatarModeration/{uid_A}.status == 'approved'`).

**Step 3 — Verify new token works.**
Read `users/{uid_A}.avatarUrl` again. Confirm it differs from `URL_OLD` (the `token=` parameter must be a different UUID). Fetch `URL_NEW` in a browser; confirm HTTP 200.

**Step 4 — Verify old token is revoked.**
Fetch `URL_OLD` in a private/incognito window. Confirm HTTP 403 (PERMISSION_DENIED). The file at `avatars/{uid_A}` still exists — only the token in the metadata has changed. A different token on the same path confirms the old token is invalidated by overwrite, not file deletion.

**Step 5 — Verify rejected upload preserves old URL.**
As A, upload a second replacement image. Before Vision SafeSearch runs, the cloud function should not update `avatarUrl`. If you can inject a rejection (e.g., by using the `_hooks.visionSafeSearch` seam in a test environment), confirm `avatarModeration/{uid_A}.status == 'rejected'` and that `users/{uid_A}.avatarUrl` still equals `URL_NEW` (unchanged from Step 3). Fetch `URL_NEW`; confirm still HTTP 200.

**Step 6 — Verify deletion invalidates the URL.**
Delete the `deleteAccount` callable for A (or manually delete the Storage object at `avatars/{uid_A}` via Admin SDK in staging). Fetch `URL_NEW`; confirm HTTP 403 or 404. This confirms that account deletion (which clears `avatars/{uid}`) revokes the URL as a side effect of removing the file.
