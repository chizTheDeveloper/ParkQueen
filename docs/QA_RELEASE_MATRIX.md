# ParQueen QA Release Matrix 2026

Assessment date: 2026-07-24  
Scope: web application pre-release verification matrix  
Status: template — populate pass/fail as each area is tested

---

## How to use this matrix

Each row is a test scenario. Run it in the environment indicated, record the result (PASS/FAIL/SKIP + notes + tester + date). A release gate requires every REQUIRED row in that gate to be PASS. SKIP is only permitted for scenarios blocked by a documented dependency (e.g., native packaging not yet built).

---

## Gate 1: Automated quality gates

Run on every commit to `audit/app-store-readiness-2026` and `main`.

| # | Scenario | Command | Required | Result |
|---|---|---|---|---|
| Q-01 | TypeScript compilation | `npx tsc --noEmit` | YES | |
| Q-02 | Unit test suite | `npm test` | YES | Expected: 19 files, 674 tests |
| Q-03 | Production build | `npm run build` | YES | No build errors |
| Q-04 | Firestore Rules emulator | `npm run test:rules` | YES | Expected: 70 tests |
| Q-05 | Clean dependency install | `npm ci` | YES | No ERESOLVE, no --force flags |
| Q-06 | Dependency audit | `npm audit` | YES | No new critical beyond documented baseline |

---

## Gate 2: Security pre-deployment checks

Manual or CI-assisted. All REQUIRED before any deployment.

| # | Scenario | How to verify | Required | Result |
|---|---|---|---|---|
| S-01 | Voice agent script removed | Search `index.html` for `voiceagent.ai` — must not exist | YES | |
| S-02 | No secrets in bundle | `grep -r 'AIzaSy\|sk-\|sendgrid\|mapbox.*sk' dist/` — zero matches | YES | |
| S-03 | Firebase config in bundle is web-public config only | Confirm bundle contains only `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` — no server key | YES | |
| S-04 | CSP header deployed | `curl -I https://parkqueen-46475363-ccf36.web.app/` — `Content-Security-Policy` header present | YES (before public release) | |
| S-05 | Firestore Rules deployed | Firebase console → Firestore → Rules — confirm chat, spotFeedback, spotNotifications rules match audit branch | YES | |
| S-06 | Storage Rules present | Firebase console → Storage → Rules — owner-only upload verified | YES | |
| S-07 | App Check status | Firebase console → App Check — verify enforcement state per service | YES (before public release) | |
| S-08 | Phone not in public user doc | Firestore console → pick any `users/{uid}` — confirm no `phone` field | YES | |
| S-09 | Historical credential rotation confirmed | Provider dashboards — confirm previously exposed key is revoked | YES | |
| S-10 | Admin bootstrap disabled | Attempt `bootstrapAdmin` callable with `@parqueen.app` account after bootstrap — should return `already-exists` | YES | |

---

## Gate 3: Authentication and account lifecycle

| # | Scenario | Expected | Result |
|---|---|---|---|
| A-01 | OTP sign-in — valid phone | SMS received; user signed in; `users/{uid}` created or updated | |
| A-02 | OTP sign-in — invalid code | Error displayed; user not signed in | |
| A-03 | OTP sign-in — expired code | Error displayed; retry prompt | |
| A-04 | OTP sign-in — rate limit (5+ attempts) | Rate limit error or CAPTCHA challenge before 5th attempt | |
| A-05 | Account creation completes profile setup flow | Username, vehicle, language selected; `users/{uid}` has correct fields without phone/email in root | |
| A-06 | Logout clears session state | Sign out → sign in as different user → no prior user's chat timestamps or saved-spot data visible | |
| A-07 | Account deletion — golden path | Trigger `deleteAccount` → Auth user deleted → `users/{uid}` deleted → username removed → all linked collections cleaned | |
| A-08 | Account deletion — partial retry | Simulate Function failure mid-deletion → re-trigger → no duplicate deletions; job completes | |
| A-09 | Deleted user cannot re-use username | Register with deleted account's username → blocked | |
| A-10 | Suspended user sees suspension UI | Sign in as suspended account → suspension message; cannot access core features | |
| A-11 | Blocked user cannot message blocker | User A blocks user B → B attempts to message A → blocked | |

---

## Gate 4: Core Ping / handoff flow

| # | Scenario | Expected | Result |
|---|---|---|---|
| P-01 | Create Ping — valid spot | Ping appears on map for nearby signed-in users | |
| P-02 | Create Ping — unauthenticated | Not allowed; sign-in prompt | |
| P-03 | Claim Ping — valid flow | Finder receives notification; claimer's ETA visible | |
| P-04 | Claim Ping — already claimed | Claim rejected; UI shows unavailable | |
| P-05 | Handoff completion — feedback written | `spotFeedback` document created; Crowns updated | |
| P-06 | Replay attack — duplicate feedback | Second `setDoc` with same `spotFeedbackDocId` fails (Firestore immutable rule) | |
| P-07 | Forged feedback — wrong spot | Write with spotId pointing to non-`occupied` spot — Rules reject | |
| P-08 | Forged feedback — wrong user | Write with mismatched `userId` — deterministic ID check fails | |
| P-09 | Notification from non-participant | Direct write to `spotNotifications` from third user — Rules reject | |
| P-10 | Ping cleanup after expiry | Expired Pings are removed within scheduled cleanup window | |

---

## Gate 5: Messaging and privacy

| # | Scenario | Expected | Result |
|---|---|---|---|
| M-01 | Send message — valid participant | Message appears in both participants' views | |
| M-02 | Read message — non-participant | Firestore Rules reject read | |
| M-03 | Write message — non-participant | Firestore Rules reject write | |
| M-04 | Change chat participants | Update attempt rejected (immutable participants rule) | |
| M-05 | Message with text > 500 chars | Rejected by Rules; send button disabled in UI | |
| M-06 | Smart reply — valid context | Replies generated and displayed | |
| M-07 | Smart reply — oversized context | Callable should validate and truncate `context` before calling Gemini | |
| M-08 | Report a user | Report document created with `reporterId == auth.uid` | |
| M-09 | Cross-user chat list | User A cannot query `chats` where they are not a participant | |

---

## Gate 6: Parking sign AI assistant

| # | Scenario | Expected | Result |
|---|---|---|---|
| AI-01 | Upload clear sign image | Analysis returned in < 5 seconds; YES/NO/CONDITIONAL status | |
| AI-02 | Upload blank/ambiguous image | ERROR status with user-facing message; no crash | |
| AI-03 | Upload image > size limit | Handled gracefully; error message | |
| AI-04 | Network failure mid-analysis | Retry prompt or error; no spinner freeze | |
| AI-05 | Gemini quota exhausted (simulated) | ERROR status displayed; no raw error code leaked | |
| AI-06 | Sign result — parking allowed | Timer start prompt shown | |
| AI-07 | Sign result — parking restricted | Clear restriction time displayed | |

---

## Gate 7: Street Intelligence

| # | Scenario | Expected | Result |
|---|---|---|---|
| SI-01 | Street segment lookup — cache hit | Segment returned from Firestore; no external call | |
| SI-02 | Street segment lookup — cache miss | SweepNYC queried; result cached; UI displays schedule | |
| SI-03 | SweepNYC unavailable — fallback to NYC Open Data | Graceful fallback; partial result displayed | |
| SI-04 | Both sources unavailable | Error state displayed; no crash; user can still park and set manual reminder | |
| SI-05 | Parse failure logged | `parseFailures` document created with minimal PII; no precise user coordinates | |
| SI-06 | Admin resolves parse failure | `adminResolveParseFailure` callable succeeds; failure marked resolved | |

---

## Gate 8: Admin surface

| # | Scenario | Expected | Result |
|---|---|---|---|
| AD-01 | Admin login — valid @parqueen.app Google account | Admin dashboard accessible | |
| AD-02 | Admin login — non-parqueen.app account | Login rejected | |
| AD-03 | Admin delete spot | Spot removed; `source: 'admin'` set; finder not penalized | |
| AD-04 | Admin suspend user | User receives suspended status; suspension document created | |
| AD-05 | Admin moderate avatar | `avatarModeration/{uid}` updated; user notified if possible | |
| AD-06 | Admin audit log append-only | Client cannot read or modify `adminAuditLog` | |
| AD-07 | Non-admin callable rejection | Staff/admin callables return `permission-denied` for regular users | |

---

## Gate 9: Performance benchmarks

Target metrics for production (Lighthouse mobile simulated throttling):

| Metric | Target | Measured | Result |
|---|---|---|---|
| First Contentful Paint | < 2.5 s | | |
| Largest Contentful Paint | < 4.0 s | | |
| Time to Interactive | < 5.0 s | | |
| StreetParkingView chunk | < 600 kB gzip | Current: 510 kB gzip | |
| Main bundle | < 100 kB gzip | Current: 233 kB gzip | |
| Map loads after permission granted | Map tiles visible < 2 s after grant | | |

---

## Gate 10: Accessibility (WCAG 2.2 AA)

| # | Scenario | Tool | Result |
|---|---|---|---|
| WC-01 | No keyboard traps | Manual navigation through all views | |
| WC-02 | Focus visible on all interactive elements | Keyboard only | |
| WC-03 | Color contrast ratio ≥ 4.5:1 for text | axe DevTools | |
| WC-04 | All images have meaningful `alt` | axe scan | |
| WC-05 | Forms have associated labels | axe scan | |
| WC-06 | Screen reader flow — sign-in | VoiceOver/NVDA | |
| WC-07 | Screen reader flow — create Ping | VoiceOver/NVDA | |
| WC-08 | Reduced motion respected | `prefers-reduced-motion` CSS media query present on animations | |

---

## Gate 11: Internationalization

| # | Scenario | Expected | Result |
|---|---|---|---|
| I18N-01 | All UI text renders in Spanish | Switch to `es` → no English strings visible | |
| I18N-02 | Language preference persists across reload | Set `es` → reload → `es` active | |
| I18N-03 | RTL languages not broken | N/A (Spanish/English only for launch) | SKIP |
| I18N-04 | Strings with dynamic values render correctly | e.g., `t('spots.expires_in', {minutes: 5})` → "Expira en 5 minutos" | |

---

## Gate 12: Native packaging (blocked)

All rows in this gate are SKIP until native packaging architecture is selected and implemented. See `docs/STORE_SUBMISSION_READINESS.md`.

| # | Scenario | Expected | Result |
|---|---|---|---|
| N-01 | iOS build via Xcode | Archive produces signed `.ipa` | SKIP |
| N-02 | Android build | Signed AAB produced | SKIP |
| N-03 | App Store Connect validation | No binary errors | SKIP |
| N-04 | Play Store upload | AAB accepted | SKIP |
| N-05 | PrivacyInfo.xcprivacy present | All API categories declared | SKIP |
| N-06 | Permission usage descriptions | All `NSUsageDescription` keys present | SKIP |
| N-07 | Reviewer account provided to Apple | Demo credentials work | SKIP |

---

## Sign-off log

| Gate | Sign-off required from | Date | Name | Notes |
|---|---|---|---|---|
| 1 | CI | | | |
| 2 | Security lead | | | |
| 3 | Engineering | | | |
| 4–7 | QA | | | |
| 8 | Engineering + legal | | | |
| 9 | Engineering | | | |
| 10 | Accessibility review | | | |
| 11 | Spanish language review | | | |
| 12 | Store submission PM | | | Blocked until native packaging |
