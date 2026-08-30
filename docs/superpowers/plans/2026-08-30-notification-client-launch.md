# Notification Client Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ParQueen's browser client, PWA metadata, and Firebase Messaging service worker launch-ready while remaining compatible with the current Functions payloads and the future PR #94 data-only contract.

**Architecture:** A shared notification service owns capability, permission, token registration, and the single foreground listener. A small pure intent module validates only `ping`, `my_car`, and `notifications`; App adapts those intents to its existing state navigation. The service worker ignores legacy notification-bearing payloads for display, manually displays future validated data-only payloads once, and routes clicks through same-origin client messages or a one-shot URL fragment.

**Tech Stack:** React 18, TypeScript, Firebase Web SDK 10.x, Firebase Messaging compat worker, Vitest, Firebase Hosting, web app manifest, PNG assets.

**Spec:** `C:/Users/jayca/.codex/attachments/98c252c9-58c2-4571-8686-81337b349d98/pasted-text.txt`

## Global Constraints

- PR #93 is client/Hosting compatibility only; do not modify `functions/notifyFanout.js`, `functions/index.js`, Rules, IAM, or Firebase data models.
- Implement only `ping`, `my_car`, and `notifications`; reject chat/message/arrival/handoff routes.
- Preserve scalar token storage, account ownership rotation, logout cleanup, notification eligibility, expiration, and radius semantics.
- Browser permission may be requested only from an explicit user action; authenticated startup may silently refresh only an already-granted registration.
- Support legacy notification-bearing payloads without manual redisplay and future data-only payloads with exactly one manual display.
- No external URLs, coordinates, UIDs, claim IDs, message content, credentials, or tokens in routing.
- Keep English and Spanish user-facing copy in parity.
- Do not merge, deploy, send notifications, create production data, or touch Parsona.

---

### Task 1: Safe notification intent contract

**Files:**
- Create: `utils/notificationIntent.ts`
- Test: `utils/notificationIntent.test.ts`

**Interfaces:**
- Produces: `NotificationIntent`, `normalizeNotificationIntent(value)`, `readNotificationIntentFromPayload(payload)`, `encodeNotificationIntentFragment(intent)`, and `consumeNotificationIntentFragment(location, history)`.
- Consumed by: App foreground/startup navigation and the service-worker mirror contract.

- [ ] **Step 1: Write failing table tests** for versioned `ping` with a bounded Firestore-safe `spotId`, identifier-free `my_car` and `notifications`, legacy `{spotId}` normalization, and rejection of chat, unknown types, URLs, slashes, protocol-relative strings, control/query characters, missing IDs, and oversized IDs.
- [ ] **Step 2: Run `npm test -- utils/notificationIntent.test.ts`** and verify the module-not-found failure.
- [ ] **Step 3: Implement the minimal discriminated union and pure normalizer.** Use literal allowlisted type branches; never interpret arbitrary paths or URLs. Encode closed-app state as `#notification=<base64url JSON>` and consume it once with `history.replaceState(null, '', pathname + search)`.
- [ ] **Step 4: Re-run the focused test** and verify all cases pass.
- [ ] **Step 5: Commit** with `test/feat: add safe notification intent contract` together with its tests.

### Task 2: Permission and scalar registration service

**Files:**
- Create: `utils/notificationRegistration.ts`
- Test: `utils/notificationRegistration.test.ts`
- Modify: `firebaseConfig.ts`
- Modify: `utils/fcmRegistration.test.ts`

**Interfaces:**
- Produces: `NotificationRuntimeState`, `inspectNotificationRuntime()`, `enableNotifications(uid)`, `refreshGrantedRegistration(uid)`, `subscribeForegroundMessages(uid, handler)`, and `getConfiguredVapidStatus()`.
- Consumes: existing `getFCM`, Firebase `getToken`, `deleteToken`, `onMessage`, Firestore `setDoc`, and current localStorage ownership keys.

- [ ] **Step 1: Write failing behavioral tests** for default/granted/denied/unsupported/iOS-browser states; direct enable requests; denied non-reprompt; token-registration failure; already-granted silent refresh; ownership mismatch deletion before registration; merged private preference write; missing VAPID reporting without exposing a value; and one foreground unsubscribe.
- [ ] **Step 2: Run the focused registration tests** and verify failures are caused by missing service behavior.
- [ ] **Step 3: Implement the minimal injectable service.** Keep the scalar `fcmToken`, owner UID/version markers, delete-before-get ordering, and write-before-owner-marker ordering. Pass a configured public VAPID key to `getToken` only when present; never create or print one.
- [ ] **Step 4: Replace brittle App source assertions in `fcmRegistration.test.ts`** with real service behavior while retaining logout cleanup checks that exercise `database.ts` at its observable boundary.
- [ ] **Step 5: Run focused tests** and verify green.
- [ ] **Step 6: Commit** the service and tests.

### Task 3: Contextual permission UI and honest Settings

**Files:**
- Modify: `App.tsx`
- Modify: `views/NotificationsView.tsx`
- Modify: `views/NotificationsView.test.tsx`
- Modify: `views/NotificationsSettingsView.tsx`
- Create: `views/NotificationsSettingsView.test.tsx`
- Modify: `views/SettingsView.tsx`
- Modify: `utils/settingsSummary.ts`
- Modify: `utils/settingsSummary.test.ts`
- Modify: `views/street-parking/useParkingTimer.ts`
- Create: `views/street-parking/useParkingTimer.test.ts`

**Interfaces:**
- App owns one `NotificationRuntimeState` and passes it plus explicit enable/recheck/manage callbacks to Nearby Activity and Settings.
- `useParkingTimer` reads capability/permission when firing but never calls `requestPermission`.

- [ ] **Step 1: Write failing view/helper tests** proving auth restoration does not prompt, Nearby Activity exposes the explicit enable action, Settings distinguishes runtime states, ordinary iOS shows install guidance, denied exposes Recheck without prompting, registration failure exposes Retry, and the timer never requests permission.
- [ ] **Step 2: Run the focused tests** and verify expected failures.
- [ ] **Step 3: Remove FCM permission ownership from the auth callback.** After auth readiness, call only `refreshGrantedRegistration`; install one foreground listener and retain/clean its unsubscribe on account transition/unmount.
- [ ] **Step 4: Add the compact Nearby Activity action and Settings recovery presentation** using the shared state and callbacks. Update the Settings summary to show true delivery readiness rather than the preference alone.
- [ ] **Step 5: Remove the timer's raw request** without altering expiry/local-notification semantics.
- [ ] **Step 6: Run focused tests and existing notification/settings/timer regressions.**
- [ ] **Step 7: Commit** contextual permission behavior.

### Task 4: Stateful App routing and actionable foreground alert

**Files:**
- Modify: `App.tsx`
- Modify: `views/StreetParkingView.tsx`
- Create: `utils/notificationNavigation.test.ts`
- Modify: relevant existing map/Notifications tests

**Interfaces:**
- App consumes normalized `NotificationIntent` from startup fragments, worker `message` events, and foreground payloads.
- App maps `ping` to existing `pendingSpotId`, `my_car` to `AppView.MAP`, and `notifications` to `AppView.NOTIFICATIONS`.
- Map reports pending-spot resolution success/failure so App consumes every intent exactly once and shows the stale non-error message.

- [ ] **Step 1: Write failing tests** for auth-gated one-shot startup consumption, fragment clearing, worker message consumption, live Ping opening, stale Ping fallback/consumption, My Car, Notifications fallback, legacy insufficient metadata, actionable foreground Open, and chat rejection.
- [ ] **Step 2: Run focused routing tests** and verify red.
- [ ] **Step 3: Implement one App intent executor** shared by startup, worker messages, and foreground Open. Preserve the existing toast shell and add only an Open action plus dismiss/timeout behavior.
- [ ] **Step 4: Make pending spot misses terminate safely** and surface the localized stale-Ping notice instead of leaving `pendingSpotId` stuck.
- [ ] **Step 5: Re-run focused routing/foreground/map tests** and verify green.
- [ ] **Step 6: Commit** routing and foreground actionability.

### Task 5: Backward-compatible service worker

**Files:**
- Modify: `public/firebase-messaging-sw.js`
- Create: `utils/firebaseMessagingWorker.test.ts`

**Interfaces:**
- Worker accepts legacy `{notification, data?}` and future `{data:{title,body,navigationType,...}}` shapes.
- Worker click behavior mirrors the page intent contract and emits `{kind:'PARQUEEN_NOTIFICATION_OPEN', version:1, intent}` only to a same-origin client.

- [ ] **Step 1: Write a VM/mock-worker behavioral test** that executes the real worker and proves zero manual displays for legacy notification-bearing payloads, exactly one display for valid future data-only payloads, safe malformed fallback, click registration before imports, same-origin client selection/focus/postMessage, unsafe-client rejection, and internal same-origin `openWindow` fragment construction.
- [ ] **Step 2: Run the worker test** and verify it fails against the current worker.
- [ ] **Step 3: Register `notificationclick` before Firebase imports**, validate notification data, focus/postMessage an existing same-origin client, otherwise open only the internally constructed fragment route.
- [ ] **Step 4: Change `onBackgroundMessage`** so notification-bearing payloads are not manually redisplayed and validated future data-only payloads display once with a valid icon.
- [ ] **Step 5: Re-run worker tests** and verify green.
- [ ] **Step 6: Commit** the compatibility worker.

### Task 6: PWA identity, icons, cache safety, and translations

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icons/parqueen-192.png`
- Create: `public/icons/parqueen-512.png`
- Create: `public/icons/parqueen-maskable-512.png`
- Create: `public/icons/apple-touch-icon-180.png`
- Modify: `index.html`
- Modify: `firebase.json`
- Modify: `i18n/en.ts`
- Modify: `i18n/es.ts`
- Create: `utils/notificationPwa.test.ts`
- Create: `i18n/notificationCopyParity.test.ts`

**Interfaces:**
- Manifest and HTML expose the install identity consumed by iOS/Chromium.
- Hosting applies `no-cache` to `/firebase-messaging-sw.js` and `/manifest.webmanifest` only.

- [ ] **Step 1: Write failing manifest/icon/translation tests** that parse the manifest, inspect real PNG signatures and IHDR dimensions, validate maskable and Apple references, validate narrow cache headers, and compare every new English/Spanish key.
- [ ] **Step 2: Run focused tests** and verify missing artifacts fail.
- [ ] **Step 3: Deterministically render square icons from the existing official brand asset** with preserved aspect ratio and padding; do not redesign or stretch it.
- [ ] **Step 4: Add manifest and HTML metadata**, replace the broken worker icon reference, add narrow Hosting cache rules, and add paired English/Spanish copy.
- [ ] **Step 5: Align the worker's compat CDN version to the lock-resolved page Firebase 10.x version** if its required compat files are available; do not upgrade the dependency or token model.
- [ ] **Step 6: Run PWA/copy tests and a production build** and inspect `dist` MIME/signatures/references.
- [ ] **Step 7: Commit** the PWA package.

### Task 7: Full verification and protected PR

**Files:**
- Modify only files needed to fix failures directly caused by Tasks 1–6.

**Interfaces:**
- Produces one pushed branch and protected PR #93; performs no merge or deployment.

- [ ] **Step 1: Run focused permission, routing, worker, PWA, notification regression, and translation tests.**
- [ ] **Step 2: Run `npm test`, `npx tsc --noEmit`, and `npm run build` with Sentry upload variables absent.**
- [ ] **Step 3: Run gitleaks against tracked content and repository history.**
- [ ] **Step 4: Verify `git diff -- functions/notifyFanout.js functions/index.js firestore.rules` is empty and Parsona remains untouched.**
- [ ] **Step 5: Commit final fixes, push `fix/notification-client-launch`, and create one PR titled `fix: make web notification client launch-ready` with the approved problem/fix/rollout/scope description.**
- [ ] **Step 6: Inspect CI, merge state, and PR Gate integration ID/classification. Do not merge or deploy.**

