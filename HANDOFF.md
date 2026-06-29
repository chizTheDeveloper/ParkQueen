# ParQueen Engineering Handoff

Generated: 2026-06-28

---

## 1. Project Overview

**ParQueen** is a community-driven street parking app for New York City. Users report when they're leaving a parking spot ("ping"), and nearby drivers get notified so they can claim the spot before it's taken by someone else.

**Product vision:** Replace the experience of circling the block looking for parking with a real-time, neighbor-powered notification system. ParQueen is NOT a social media platform — it's a utility. Every feature should serve the core goal: helping someone find and park in a street spot faster.

**Core user flow:**
1. Driver 1 (finder) is about to leave their parking spot
2. They open ParQueen and tap "Ping Parking"
3. They choose "Leaving Now" (blue pin) or "Leaving Later" (yellow pin with scheduled time)
4. Nearby users within their notification radius receive a push notification
5. Driver 2 sees the pin on the map, taps it, and selects "I'm heading there" with an ETA
6. The pin disappears from all other users' maps (only finder + Driver 2 see it)
7. Navigation starts automatically for Driver 2
8. When Driver 2 arrives within 200ft, they confirm arrival
9. The spot is marked occupied and removed from the map

**Current status:** Functional MVP deployed at https://parkqueen-46475363-ccf36.web.app. Real phone authentication, real push notifications, real-time Firestore sync, content moderation, username system, light/dark theme. Single developer (ParQueen founder) testing in the Bronx, NY.

---

## 2. Current Architecture

### Authentication
- **Firebase Phone Auth** via `signInWithPhoneNumber` + `RecaptchaVerifier` (invisible)
- No email/password auth — passwords have been completely removed from the app
- Phone OTP is the sole auth method
- Test phone numbers configured in Firebase Console for development
- `views/CreateAccountView.tsx` handles phone entry + OTP send
- `views/VerifyPhoneView.tsx` handles OTP verification with auto-submit on 6th digit
- After OTP, the app checks Firestore for existing user → returns them to map, or routes new users to username selection

### Firestore Collections
- `users/{uid}` — user profiles (username, phone, email, avatar, preferences, moderation fields)
- `usernames/{lowercase}` — reverse lookup for username uniqueness (doc ID = lowercase username, value = uid)
- `spots/{spotId}` — active parking pings (lat/lng, status, finder info, interest fields)
- `chats/{chatId}` — conversations (participants array, last message)
- `chats/{chatId}/messages/{msgId}` — individual messages
- `emailVerificationCodes/{uid}` — temporary OTP codes for email verification
- `avatarModeration/{uid}` — Vision SafeSearch results for avatar uploads
- `spotNotifications/{notifId}` — real-time notifications between finder/driver (cancel, delay messages)
- `spotFeedback/{feedbackId}` — post-arrival feedback
- `reports/{reportId}` — user reports (harassment, spam, etc.)
- `moderationLog/{logId}` — server-side moderation audit trail
- `stats/global` — aggregate statistics (totalSpotsPinged)

### Cloud Functions (functions/index.js)
All deployed to `us-central1`, Node.js 20, Firebase Functions v5 (v2 API):
1. `cleanupExpiredSpotsHourly` — scheduled, deletes expired spots
2. `cleanupExpiredInterests` — scheduled every 1 minute, reverts expired interest reservations to available
3. `incrementTotalSpotsPinged` — Firestore trigger on spot creation
4. `notifyNearbyUsers` — Firestore trigger on spot creation, sends FCM push notifications with distance-based filtering
5. `generateEmailOTP` — callable, sends email verification codes via SendGrid REST API
6. `verifyEmailOTP` — callable, verifies email OTP codes
7. `moderateAvatarUpload` — Storage trigger, runs Google Cloud Vision SafeSearch on avatar uploads
8. `claimUsername` — callable, validates + claims usernames atomically via Firestore transaction
9. `moderateContent` — callable, shared content moderation (banned words, contact info patterns)

### Notification System
- **Push notifications** via Firebase Cloud Messaging (FCM)
- FCM token saved to user document on auth, refreshed on app load
- `notifyNearbyUsers` Cloud Function fires on spot creation
- Uses geohash prefix (4 chars ≈ 20km) as coarse filter, then computes actual haversine distance
- Each user has a `notificationRadius` preference (0.5/1/2/5 miles, default 1)
- Only notifies if actual distance ≤ user's radius
- Excludes: the finder, users with `notificationsEnabled === false`, users without FCM tokens
- **In-app notifications** via `spotNotifications` Firestore collection with `onSnapshot` listener (for cancel/delay real-time messages between finder and driver)
- **Foreground push** handled by `onMessage` in App.tsx, rendered as a glass-panel toast banner (not a blocking alert)

### Map Architecture
- **Mapbox GL JS** with dark-v11 or light-v11 style based on theme
- Map waits for GPS fix before initializing (no Manhattan flash on load)
- Falls back to NYC_CENTER after 5 seconds if GPS unavailable
- Markers created via `createMarkerElement(scheduled)` — blue for "now", yellow for "later"
- Marker click handler reads fresh data from `itemsRef.current` to avoid stale closures
- Map style is set at initialization based on theme; does not swap dynamically mid-session
- User location shown as a pulsating blue GPS dot

### Geolocation
- `navigator.geolocation.watchPosition` with high accuracy
- `lastGeohash` (geofire-common) written to user's Firestore document for notification targeting
- `searchCenter` state drives the spot query radius (2 miles from map center)
- `userLocation` state used for distance calculations, arrival confirmation, ETA gating

### State Management
- React useState/useEffect throughout (no Redux, no context providers)
- Custom hooks: `useSpotData`, `useInterestFlow`, `useSearch`, `useUnreadMessages`, `useHoldFlow` (deprecated)
- `selectedItem` in StreetParkingView is the currently selected/viewed spot
- `user` state in App.tsx maintained via `onSnapshot` on the user's Firestore document

### Navigation
- `AppView` enum in `types.ts` with `currentView` state in App.tsx
- No router library — simple switch/case in `renderView()`
- Views: CREATE_ACCOUNT, VERIFY_PHONE, SETUP_PROFILE, MAP, PROFILE, SETTINGS, EDIT_PROFILE, COMPLETE_PROFILE, MESSAGES, NOTIFICATIONS, AI_ASSISTANT, ONBOARDING, and more

### Important Reusable Components
- `BottomSheet.tsx` — shared slide-up sheet with drag handle, drag-to-dismiss (>80px), backdrop tap dismiss. Used by SpotModal, SpotDetailsCard, ETA picker, and feedback prompt.
- `SpotDetailsCard.tsx` — state-driven card showing different UI based on user's relationship to the spot (5 states: available, my_claim, my_ping_available, my_ping_claimed, third_party)
- `SpotModal.tsx` — ping creation/editing (Leaving Now / Leaving Later with TimePicker)

---

## 3. Features Already Implemented

### Parking Flow
- **Ping Parking button** with blue-to-teal gradient, pulsing glow animation, centered text with left-aligned icon
- **Leaving Now** (blue pin) — spot available immediately
- **Leaving Later** (yellow pin) — scheduled departure time, auto-transitions to blue when time arrives
- **Bottom sheet modal** for ping creation with drag-to-dismiss
- **TimePicker** sub-view for selecting departure time (hour/minute/AM-PM)
- **Past-time validation** — cannot select a departure time in the past
- **One active ping per finder** enforced via Firestore query before creation
- **Spot address resolution** via Mapbox reverse geocoding, falls back to user's GPS when no spot selected
- **Edit/Delete** existing pings (finder only)

### Claim/Interest System
- **"I'm heading there"** button with ETA picker (2/5/8/10 min options)
- **Firestore transaction** ensures first-wins when two users race for the same spot
- **One active interest per user** enforced before allowing a new claim
- **Distance/ETA gate** — max 7 minutes estimated driving time (straight-line × 25 km/h city speed)
- **Claimed pings hidden** from all other users' maps (only finder + interested user see it)
- **Auto navigation** starts on claim (route drawn via Mapbox Directions API)
- **Arrival confirmation** — "I've arrived" button enabled within 200ft (60m) of spot
- **Post-arrival feedback** prompt ("Thank the driver", "Spot wasn't available", "Other")
- **Occupied spots** immediately removed from map
- **Cancel by claimer** — reverts spot to available, notifies finder
- **Cancel by finder** — deletes spot entirely, notifies interested user
- **Quick-reply messaging** — finder can send preset messages to interested user ("On my way out", etc.)

### User System
- **Phone authentication** (Firebase signInWithPhoneNumber)
- **Username system** with Cloud Function validation (length, characters, profanity, reserved words, l33tspeak normalization)
- **Real-time username availability check** (debounced 400ms)
- **30-day username change cooldown** (skipped for generated `user_` usernames)
- **"Set up later"** generates temporary username (`user_{timestamp}`)
- **"Complete your profile"** link on Profile screen for users with generated usernames
- **Profile photo upload** with Vision SafeSearch moderation
- **Edit Profile** — username (with full validation), name, DOB, gender

### Email Verification
- **SendGrid-powered** email OTP (Cloud Functions call SendGrid REST API directly)
- **6-digit code** with 10-minute expiry, 60-second rate limit
- **OTP entry UI** in Settings with real-time verification
- **"Verified" / "Unverified"** badge next to email in Settings

### Messaging
- **Chat system** between users (Firestore `chats` collection with `messages` subcollection)
- **Chat ID convention**: `[userId1, userId2].sort().join("_")`
- **Smart replies** via Gemini API
- **Content moderation** — profanity, hate speech, contact info (phone/email/URL/social media) blocked before sending
- **Block user** — removes from conversations, hides their spots from map
- **Report user** — in-app modal with preset reasons, stored with pending status for admin review
- **Delete chat** functionality

### Notifications
- **Push notifications** for nearby spot creation (FCM)
- **Per-user notification radius** (0.5/1/2/5 miles, configurable in Settings)
- **Precise distance filtering** (haversine calculation in Cloud Function)
- **In-app toast** for foreground push messages (glass-panel banner, auto-dismiss 5s)
- **Real-time spot notifications** (cancel, delay) via Firestore onSnapshot

### Settings
- **Dark/Light theme** toggle with CSS custom properties
- **Notifications** toggle (persisted to Firestore)
- **Notification radius** selector (0.5/1/2/5 mi)
- **Share precise location** toggle
- **Email address** management with OTP verification
- **Edit Profile** navigation
- **Log out** / **Delete account**

### Map & UI
- **Map centered on GPS** at load (no Manhattan flash)
- **Loading spinner** while waiting for GPS
- **Light/dark map styles** (Mapbox light-v11 / dark-v11)
- **Pulsating blue GPS dot** for user location
- **Stat pill** showing count of nearby spots (excludes own pings)
- **Nearest spot preview strip** with distance + time ago (excludes own pings)
- **Locate-me button** repositioned above Ping Parking button

### Onboarding
- **3-screen value proposition** slides with full-bleed images, gradient overlay, swipe/tap to advance
- **First-launch only** (localStorage flag `hasSeenOnboarding`)
- **"Get Started"** button on final screen

### Light Theme
- **CSS custom properties** for all colors (--color-bg, --color-surface, --color-text, etc.)
- **Theme toggle** in Settings, persisted to localStorage
- **All views** converted to use theme-aware variables

---

## 4. Major Product Decisions

| Decision | Reasoning |
|---|---|
| **No red pings** | Red was previously used for "claimed" status. Removed because the claim system was redesigned — claimed spots now disappear from other users' maps entirely instead of showing as red. |
| **Claimed spots hidden from others** | Showing "Someone is heading there" encouraged racing. Hiding the pin eliminates the race condition — only the finder and interested user see it. |
| **Navigation starts automatically on claim** | The Track button was redundant — if you tapped "I'm heading there", you obviously want navigation. Auto-track eliminates a pointless extra tap. |
| **No separate Login screen** | Login and signup are unified into one phone-entry flow. After OTP verification, the app auto-detects new vs returning users. No "login vs signup" choice for the user. |
| **Usernames replaced real names** | ParQueen is not a social platform. Phone numbers identify accounts; usernames are the public identity. Real names are optional and never required. |
| **Passwords completely removed** | Phone OTP is the sole auth method. No password fields anywhere. Placeholder email/password auth was fully replaced with real Firebase phone auth. |
| **Notification radius separate from map radius** | Map display radius (2 miles) is what you browse. Notification radius (user-selectable) is what interrupts you. Different intents deserve different controls. |
| **Profanity filter uses substring matching with normalization** | L33tspeak substitutions (@ → a, 0 → o, etc.) are normalized before checking. The filter is aggressive because legitimate parking messages rarely contain profanity substrings. |
| **Contact info blocked in messages** | Phone numbers, emails, URLs, social media handles are blocked to prevent scams and keep coordination on-platform. |
| **State-driven SpotDetailsCard** | The card renders different buttons based on the user's relationship to the spot (5 states), not conditional button visibility. This eliminates bugs where wrong buttons appear. |
| **Bottom sheet for all interactions** | Every parking interaction uses the same BottomSheet component for visual consistency. |
| **Finder never sees own spots in counts/notifications** | `spotCount`, `nearestSpot` preview, and push notifications all exclude spots where `finderId === user.id`. |

---

## 5. Current Database Structure

### users/{uid}
```
id: string (Firebase Auth UID)
username: string
fullName: string (optional, often blank)
phone: string (digits only)
email: string (optional)
emailVerified: boolean
avatarUrl: string (Firebase Storage URL)
createdAt: Timestamp
reputationScore: number (default 0)
currentStreak: number (default 0)
tier: string (default 'Newcomer')
lastGeohash: string (geofire geohash, updated by GPS watch)
fcmToken: string (FCM push token)
notificationsEnabled: boolean (default true)
notificationRadius: number (miles, default 1)
sharePreciseLocation: boolean (default true)
moderationStatus: 'active' | 'warned' | 'suspended' | 'banned'
reportCount: number (default 0)
blockedUsers: string[] (array of UIDs)
usernameChangedAt: Timestamp (for 30-day cooldown)
```

### usernames/{lowercase_username}
```
uid: string
claimedAt: Timestamp
```

### spots/{spotId}
```
lat: number
lng: number
type: 'free'
status: 'available' | 'interested' | 'occupied'
finderId: string (UID)
finderName: string (username at time of creation)
pingMode: 'now' | 'later'
reportedAt: Timestamp (departure time — now or scheduled future)
expiresAt: Timestamp (reportedAt + 1 hour)
geohash: string (for notification targeting)
address: string (reverse geocoded, optional)
interestedUserId: string | null
interestedUserName: string | null
etaMinutes: number | null (2/5/8/10)
interestExpiresAt: Timestamp | null (ETA + 3 min grace)
```

### chats/{chatId}
```
id: string ([uid1, uid2].sort().join("_"))
participants: string[] (two UIDs)
participantNames: { [uid]: string }
relatedSpotTitle: string
lastMessage: string
lastMessageTimestamp: Timestamp
lastSenderId: string
```

### chats/{chatId}/messages/{msgId}
```
senderId: string
text: string
timestamp: Timestamp
```

### reports/{reportId}
```
reporterId: string
reportedUserId: string
type: 'behavior' | 'username' | 'message'
reason: string
status: 'pending' | 'reviewed' | 'actioned'
conversationId: string (optional)
createdAt: Timestamp
```

### spotNotifications/{notifId}
```
targetUserId: string
type: 'cancelled' | 'delayed' | 'claimer_cancelled'
message: string
createdAt: Timestamp
```

### spotFeedback/{feedbackId}
```
spotId: string
userId: string
finderId: string
feedback: string
createdAt: Timestamp
```

---

## 6. Cloud Functions (Detail)

### cleanupExpiredSpotsHourly
- **Purpose:** Delete spots past their expiration time
- **Trigger:** Scheduled every 1 hour
- **Logic:** Query spots where `expiresAt <= now`, batch delete up to 500 at a time

### cleanupExpiredInterests
- **Purpose:** Revert expired interest reservations back to available
- **Trigger:** Scheduled every 1 minute
- **Logic:** Query spots where `status == 'interested'` AND `interestExpiresAt <= now`, batch update to clear interest fields and set status to 'available'

### incrementTotalSpotsPinged
- **Purpose:** Track total spots pinged (all-time counter)
- **Trigger:** `onDocumentCreated` on `spots/{spotId}`
- **Logic:** Increment `stats/global.totalSpotsPinged` by 1

### notifyNearbyUsers
- **Purpose:** Send push notifications to nearby users when a new spot is created
- **Trigger:** `onDocumentCreated` on `spots/{spotId}`
- **Logic:**
  1. Get spot's geohash, take 4-char prefix (~20km coarse filter)
  2. Query users by geohash range
  3. For each candidate: skip finder, skip no-FCM, skip notifications-disabled
  4. Decode user's `lastGeohash` to lat/lng via geofire
  5. Compute haversine distance in miles
  6. Compare against user's `notificationRadius` (default 1 mile)
  7. Send FCM with distance in the body text

### generateEmailOTP
- **Purpose:** Send email verification code via SendGrid
- **Trigger:** Callable (onCall)
- **Logic:** Generate 6-digit code, store in `emailVerificationCodes/{uid}` with 10-min expiry, call SendGrid REST API, rate limit 1 per 60 seconds
- **Dependencies:** SENDGRID_API_KEY environment variable

### verifyEmailOTP
- **Purpose:** Verify email OTP and mark email as verified
- **Trigger:** Callable (onCall)
- **Logic:** Check code matches + not expired, update user doc with `emailVerified: true`, delete used code

### moderateAvatarUpload
- **Purpose:** Check uploaded profile photos for inappropriate content
- **Trigger:** `onObjectFinalized` on Storage (avatars/ path)
- **Logic:** Call Google Cloud Vision SafeSearch, reject if adult/racy is LIKELY or VERY_LIKELY, write result to `avatarModeration/{uid}`
- **Dependencies:** @google-cloud/vision npm package

### claimUsername
- **Purpose:** Validate and atomically claim a username
- **Trigger:** Callable (onCall)
- **Logic:** Validate length/chars/profanity/reserved, Firestore transaction to check uniqueness + claim, enforce 30-day cooldown (skip for `user_` prefixed names)

### moderateContent
- **Purpose:** Shared content moderation check
- **Trigger:** Callable (onCall)
- **Logic:** Normalize text, check against banned word list, check contact info patterns (messages only), check reserved words (usernames only), log to `moderationLog`

---

## 7. Current Notification System

See Section 2 "Notification System" and Section 6 "notifyNearbyUsers" for full details.

Key points:
- Geohash prefix (4 chars) as coarse DB query filter
- Haversine distance calculation for precise filtering
- Per-user `notificationRadius` preference (0.5/1/2/5 miles)
- Finder always excluded
- `notificationsEnabled === false` users excluded
- Notification body includes distance ("~0.3 mi away" or "right next to you")
- In-app foreground push rendered as toast (not alert)
- Real-time spot notifications (cancel/delay) via separate `spotNotifications` collection + onSnapshot

---

## 8. Known Issues

### High Priority
- **Stale tasks in task list** — the task tracking system has accumulated old completed tasks from prior features. Clean up on next session start.
- **`useHoldFlow.ts` still exists on disk** — deprecated, no longer imported anywhere. Should be deleted.
- **`LoginView.tsx` still exists on disk** — no longer imported or referenced. Should be deleted.
- **`SplashView.tsx` still exists on disk** — unused. Should be deleted.

### Medium Priority
- **Map style doesn't swap dynamically when theme changes** — style is set at map initialization. Toggling theme while on the map screen doesn't change the Mapbox style until the next app load. Would need `map.setStyle()` + re-add custom layers.
- **Scunthorpe problem** — the profanity substring filter may false-positive on legitimate names containing profanity substrings (e.g., "Dickens", "Hancock"). No allowlist exists yet.
- **GarageRentalView has un-converted dark-mode classes** — this view is disabled/hidden but still has `bg-dark-900` etc. classes that aren't theme-aware. Not visible to users.

### Low Priority
- **`package-lock.json` has been modified but never committed** — shows up in every `git status`. Harmless but noisy.
- **`functions/.env` contains SendGrid API key** — it's in `.gitignore` but worth noting for deployment documentation.
- **Vite CJS deprecation warning** on every build — cosmetic, doesn't affect functionality.

---

## 9. Future Roadmap

### Discussed and Designed (specs exist)
- **Notification debouncing** — skip if user was notified within last 60 seconds (prevents spam from rapid nearby pings)

### Discussed but Not Designed
- **Reputation system** — track successful parking handoffs, display reputation score
- **User profiles** — public profile pages viewable by other users
- **Premium features** — potential monetization (priority notifications, extended radius, etc.)
- **Admin moderation dashboard** — review reports, warn/suspend/ban users
- **Username change UI in Settings** — currently only available via Edit Profile
- **Non-English profanity expansion** — current filter covers English + Spanish, needs broader coverage for NYC's multilingual population
- **AI-based content moderation** — Google Perspective API or similar for context-aware harassment detection beyond keyword matching

### Not Yet Discussed
- **Parking history** — log of past spots pinged/claimed
- **Favorites/saved locations** — save frequently parked areas
- **Scheduled notifications** — "notify me when a spot opens near home after 6 PM"
- **Street cleaning schedule integration**
- **Paid parking/meter integration**

---

## 10. Technical Debt

- **StreetParkingView.tsx is ~700+ lines** — the largest file, handles map init, geolocation, spot creation, marker rendering, address resolution, and UI overlays. Would benefit from extracting more into hooks (map init, address resolution).
- **Duplicate profanity/moderation lists** — the banned word list exists in both `functions/index.js` (server) and `utils/moderation.ts` (client). They should stay in sync but are maintained separately.
- **`handleSaveSpot` in StreetParkingView has 3 nearly identical `addDoc` call sites** — the new-spot creation logic is duplicated for "has userLocation", "needs getCurrentPosition", and "editing existing spot" paths.
- **`radiusFilteredItems` useMemo doesn't include `blockedUsers` in its dependency array** — blocked user filtering happens at the snapshot level, not the memo level, so it works, but the architecture is fragile.
- **The `firebase/` importmap catch-all in index.html** — was previously pointing to firebase@^12.8.0 (wrong major version). Fixed to 10.8.0 but all Firebase sub-packages should be explicitly listed to prevent future mismatches.
- **Several views still import from `../firebase` while others import from `../firebaseConfig`** — these are two different files (`firebase.ts` re-exports `db`, `firebaseConfig.ts` exports `auth`, `db`, `getFCM`). Should be consolidated.

---

## 11. Development Principles

1. **Discuss UX before implementation.** Every major feature started with a product discussion where assumptions were challenged. Don't skip this step.
2. **Fix root causes, not symptoms.** When three bugs share one root cause (e.g., the Manhattan flash / false empty state / self-notification all traced to `searchCenter` initializing from NYC_CENTER), fix the underlying problem once.
3. **State-driven UI over conditional rendering.** The SpotDetailsCard uses 5 named states (available, my_claim, my_ping_available, my_ping_claimed, third_party) rather than a web of `if/else` button visibility checks.
4. **Ponytail mode (laziest working solution).** The codebase follows the "ponytail" plugin philosophy: stdlib before libraries, one line before fifty, no premature abstractions. The shortest working diff wins.
5. **No unrequested features.** Don't add settings, toggles, or options that weren't asked for. Ship the minimal version, let the user request more.
6. **Deploy after every feature.** Every commit is deployed to Firebase Hosting immediately. The user tests on the live deployed app, not localhost.
7. **Branch per feature, merge to main, delete branch.** Clean git history with descriptive commit messages.
8. **Product decisions are documented in conversation, not just code.** The "why" behind design choices matters as much as the implementation.

---

## 12. Important Files

| File | Responsibility |
|---|---|
| `App.tsx` | Root component, auth state management, view routing, push notification toast |
| `types.ts` | AppView enum, StreetSpot interface |
| `database.ts` | `saveUserProfile`, `logoutUser`, `updateUser`, `deleteUser` |
| `firebaseConfig.ts` | Firebase app init, auth, db, FCM exports |
| `index.html` | Tailwind config, importmap (Firebase SDK versions), inline styles |
| `index.css` | CSS custom properties (light/dark theme), glass effects, ping-glow animation |
| `utils/moderation.ts` | Shared banned word list, normalization, contact info patterns, `moderateUsername()`, `moderateMessage()` |
| `functions/index.js` | All 9 Cloud Functions |
| `functions/.env` | SENDGRID_API_KEY (not in git) |
| `firestore.rules` | Security rules for all collections |
| **Views:** | |
| `views/StreetParkingView.tsx` | Main map screen — map init, GPS, markers, spot creation, overlays |
| `views/street-parking/SpotDetailsCard.tsx` | State-driven spot interaction card (inside BottomSheet) |
| `views/street-parking/SpotModal.tsx` | Ping creation/editing (inside BottomSheet) |
| `views/street-parking/BottomSheet.tsx` | Shared slide-up sheet component |
| `views/street-parking/useInterestFlow.ts` | Claim/interest flow logic (express interest, cancel, arrive, feedback) |
| `views/street-parking/useSpotData.ts` | Firestore spot listener, radius filtering, blocked user filtering |
| `views/street-parking/utils.ts` | `createMarkerElement`, `getDistance`, `drawRoute`, `clearRoute` |
| `views/street-parking/TimePicker.tsx` | Hour/minute/AM-PM picker for scheduled departure |
| `views/ProfileView.tsx` | Profile screen (avatar, stats, navigation) |
| `views/SettingsView.tsx` | Settings (toggles, email, notification radius, danger zone) |
| `views/EditProfileView.tsx` | Username + name + DOB + gender editing |
| `views/MessagesView.tsx` | Chat system with moderation, block, report |
| `views/OnboardingView.tsx` | 3-screen first-launch onboarding |
| `views/CreateAccountView.tsx` | Phone entry + RecaptchaVerifier |
| `views/VerifyPhoneView.tsx` | OTP verification with auto-submit |
| `views/NameEntryView.tsx` | Username selection during signup |

---

## 13. Next Recommended Tasks

1. **Delete dead files** — `useHoldFlow.ts`, `LoginView.tsx`, `SplashView.tsx` are unused. Clean them up.
2. **Commit `package-lock.json`** — it's been modified for the entire session and shows in every `git status`.
3. **Test two-user flow end-to-end** — use the deployed app with two browser sessions (one incognito) to test the full claim/cancel/arrive cycle with real push notifications.
4. **Notification debouncing** — implement the 60-second skip to prevent rapid notification spam.
5. **Dynamic map theme switching** — call `map.setStyle()` when theme changes so the map matches without requiring a full reload.
6. **Profanity filter allowlist** — add an explicit allowlist for false positives (legitimate names/words containing profanity substrings).
7. **Extract map initialization** into a custom hook to reduce StreetParkingView's size.
8. **Parking history view** — log completed handoffs and show them in a history/activity screen.

---

## 14. Advice for the Next Claude Code Session

### Deployment Pattern
The user expects `commit → merge to main → push → build → deploy` as one atomic operation. The Firebase project ID is `parkqueen-46475363-ccf36`. Hosting deploys from `dist/`. Functions deploy from `functions/`. Always deploy with `--project parkqueen-46475363-ccf36`.

### Firebase SDK Version
All Firebase imports must resolve to **10.8.0**. The importmap in `index.html` pins explicit paths for `firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/messaging`, `firebase/storage`, `firebase/functions`. The catch-all `firebase/` also points to 10.8.0. A version mismatch between these caused a critical auth bug (phone auth "operation-not-allowed") that took significant debugging to identify.

### The User's Working Style
- Prefers product/UX discussion before implementation ("I don't want to implement anything yet")
- Expects you to challenge assumptions and suggest alternatives
- Tests on the live deployed app (not just localhost)
- Wants features committed, merged to main, and deployed immediately after testing
- References specific line numbers and console errors when reporting bugs
- Prefers one branch per feature, deleted after merge

### Common Gotchas
- **Firestore Timestamp serialization** — `selectedItem` objects may have Timestamps that lose their `.toMillis()` method after passing through React state/refs. Always handle both `toMillis()` and `{seconds, nanoseconds}` forms.
- **Marker click closures** — markers capture `item` at creation time. Use `itemsRef.current` (a ref holding latest `radiusFilteredItems`) to read fresh data on click.
- **`onCall` Cloud Functions need public IAM** — v2 `onCall` functions require the Cloud Run service to allow unauthenticated invocations. The user has Cloud Functions Admin role but deployment may still fail on IAM if the role was revoked.
- **The `useEffect` sync for `selectedItem`** clears the selection when a spot disappears from data (occupied/expired/deleted), but skips clearing if `interestFlow.showFeedback` is true (so the feedback prompt retains the spot reference).
- **`functions/.env`** is not in git. It contains the SendGrid API key (SENDGRID_API_KEY). This file must exist in `functions/` for email OTP to work. The key can be retrieved from the SendGrid dashboard or Firebase Console secret manager.

### Active Plugins
- **Ponytail** (full mode) — enforces laziest working solution
- **Superpowers** — brainstorming, planning, verification skills
- **Claude-mem** — cross-session memory (observation system)
