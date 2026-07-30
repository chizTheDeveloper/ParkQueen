# Architecture Decision Record — Native Packaging (TM-20)

Date: 2026-07-30  
Status: **DECISION REQUIRED**  
Owner: Product / Engineering Lead

## Context

ParQueen currently ships as a Vite-built PWA deployed to Firebase Hosting. There is no iOS or Android native project (`ios/`, `android/`, `capacitor.config.*` are all absent). The App Store and Google Play require a native shell for listing, and native packaging opens new platform-controlled security boundaries that must be audited before submission.

## Options

### Option A — Capacitor (Recommended)

Wrap the existing Vite React PWA in a Capacitor shell. The web layer is unchanged; Capacitor provides thin native bridges for permissions and system APIs.

**Pros**
- Zero web-layer rewrite. All existing React/Firebase code ships as-is.
- Capacitor handles permission manifests, deep links, and secure storage plugins.
- iOS and Android projects generated from a single CLI command; Capacitor updates are incremental.
- Fast path to store submission (~2–4 weeks engineering + review cycles).

**Cons**
- WebView-based performance. Not an issue for a location/social app; not a game.
- Native code reviews unfamiliar to pure-web engineers.
- Some Capacitor plugins add supply-chain surface; audit each before installation.

**Required audit items before submission (Capacitor path)**
- `Info.plist`: `NSLocationWhenInUseUsageDescription` and (if background-ping arrives) `NSLocationAlwaysAndWhenInUseUsageDescription`; no unused permission strings.
- `AndroidManifest.xml`: `ACCESS_FINE_LOCATION`, `INTERNET`; no `READ_CONTACTS`, `CAMERA` unless used.
- Universal Links (iOS) / App Links (Android): `.well-known/apple-app-site-association` and `assetlinks.json` deployed to Firebase Hosting before store submission.
- Secure storage: replace `localStorage` for auth tokens with `@capacitor-community/secure-storage-plugin` or equivalent. `localStorage` is accessible to any JS executing in the WebView.
- Background fetch / push: confirm `BGTaskScheduler` (iOS) is not registered unless used; configure FCM via `capacitor-community/fcm` or native APNs.
- ATS (iOS App Transport Security): all API hosts reachable via HTTPS; no `NSAllowsArbitraryLoads`.
- Privacy manifest (`PrivacyInfo.xcprivacy`): required for any app using `UserDefaults`, file timestamps, or disk space APIs (all Capacitor-accessed APIs must be declared).
- Backup policy (`android:allowBackup="false"` if Firestore is the source of truth).

### Option B — React Native / Expo

Rewrite all views in React Native components. Expo managed workflow provides OTA updates.

**Pros**
- Native rendering performance and native navigation gestures.
- Expo ecosystem (OTA, EAS Build, analytics).

**Cons**
- Full UI rewrite required. All Tailwind CSS, Mapbox GL JS, and current component tree replaced.
- Firebase SDK swap: `firebase/firestore` → `@react-native-firebase/firestore` (different API surface, requires CocoaPods/Gradle setup).
- Mapbox GL JS → `@rnmapbox/maps` (maintained but different API).
- Estimated effort: 8–16 engineer-weeks minimum.
- Doubles the surface of security audit items (native + web SDK).

**Recommendation against** unless native performance becomes a measurable user-facing blocker.

### Option C — Separate Native Clients

Build independent iOS (Swift) and Android (Kotlin) apps consuming Firebase directly via native SDKs.

**Cons**
- Three codebases to maintain (web, iOS, Android).
- Highest engineering and security-audit cost.
- No shared business logic.

**Not recommended** for a three-person team at this stage.

### Option D — PWA-Only (No Store Listing)

Continue as a hosted PWA with a "Add to Home Screen" prompt. No App Store or Google Play listing.

**Cons**
- No push notification support on iOS (requires installed PWA from Safari; limited to iOS 16.4+).
- No store discoverability.
- Some markets heavily prefer in-store installs.

**Acceptable if** store launch is deferred indefinitely. Closes TM-20 as accepted risk.

## Recommendation

**Option A (Capacitor)** — lowest rewrite cost, fastest store path, existing web security audit largely carries over.

Minimum required before App Store submission:
1. `npx cap init && npx cap add ios && npx cap add android`
2. Configure permission manifests (location, notifications only)
3. Add `@capacitor/app`, `@capacitor/geolocation`, `@capacitor-community/fcm`
4. Audit each Capacitor plugin dependency before installation
5. Replace `localStorage` auth with `@capacitor-community/secure-storage-plugin`
6. Deploy universal link / app link verification files to Firebase Hosting
7. Create `PrivacyInfo.xcprivacy` (iOS 17+ requirement)
8. Run `npx cap sync && npx cap open ios` → Xcode archive → TestFlight
9. Conduct a dedicated native security review of generated Xcode and Gradle projects before release

## Open Blockers

- [ ] Product decision: which option?
- [ ] Engineering: native team capacity and timeline
- [ ] Legal: privacy manifest content review (data types declared, data uses accurate)
- [ ] Legal: app store agreements and developer account enrollment
- [ ] Security: pre-submission native binary review (separate from this source audit)

## Relation to Other Findings

- TM-12 (App Check): Capacitor requires the `firebase/app-check` provider for iOS (`AppAttestProvider`) and Android (`PlayIntegrityProvider`), not `ReCaptchaEnterpriseProvider`. The App Check rollout plan must be updated after the packaging decision is made.
- TM-18 (public Firebase config): The `googleServices.json` / `GoogleService-Info.plist` files contain the same configuration values as `firebaseConfig.ts`; their presence in the native project is expected and not a security issue, provided Firebase Security Rules, App Check, and API restrictions are in place.
- TM-19 (credential history): The native build system must not embed secret credentials. Firebase Admin credentials must never appear in `Info.plist`, `res/values/`, or any committed build file.
