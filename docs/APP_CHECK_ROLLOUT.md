# App Check Rollout Plan (TM-12)

## Current State

App Check is **not enforced**. All Cloud Functions callables have `enforceAppCheck: false`. Client-side, `firebaseConfig.ts` already contains a complete, tested App Check initialization (reCAPTCHA Enterprise provider, `isTokenAutoRefreshEnabled: true`, DEV-only debug-token hook) — it is gated on `VITE_FIREBASE_APPCHECK_SITE_KEY` and is dead code (tree-shaken from the prod bundle) until that variable is set. No further source changes are required to activate client-side token generation.

**Stage 1 of the rollout is client initialization with zero backend enforcement.** Enforcement (Step 4 below) is a later, separate stage and must not be enabled until App Check traffic has been observed in production metrics first — see Step 6.

## Why Not Enforced Yet

Web enforcement requires a reCAPTCHA site key from Firebase console and explicit enrollment per app. Premature enforcement would lock out legitimate users before the site key is configured.

## Steps to Enable Production Enforcement

### 1. Register App Check in Firebase Console

1. Firebase Console → App Check → Apps
2. Register the web app (appId `1:768131391875:web:613c5d2a948862333196b6`)
3. Choose provider: **reCAPTCHA Enterprise** (recommended for production) or reCAPTCHA v3
4. Copy the site key

### 2. Configure the site key in the Vite build environment

Set in the production build environment (wherever `npm run build` is invoked before `firebase deploy --only hosting`):
```
VITE_FIREBASE_APPCHECK_SITE_KEY=<site-key-from-console>
```
This is the single Firebase Hosting site (`parkqueen-46475363-ccf36`) that serves both `parkqueen-46475363-ccf36.web.app` and the `admin.parqueen.app` custom domain from the same build — one variable, one build, both domains covered.

### 3. App Check initialization in `firebaseConfig.ts` — already implemented

No code change is needed here. `firebaseConfig.ts` already calls `initializeAppCheck` with `ReCaptchaEnterpriseProvider`, gated on `VITE_FIREBASE_APPCHECK_SITE_KEY`, with `isTokenAutoRefreshEnabled: true`. Setting the environment variable in Step 2 is what activates it — do not add a second `initializeAppCheck` call anywhere.

### 4. Enable Enforcement on Cloud Functions — separate stage, do not combine with Steps 1–3

Steps 1–3 only get valid App Check tokens flowing from real clients; nothing is blocked yet. Deploy hosting with the site key set (Step 2) and confirm in Firebase Console → App Check → Metrics that legitimate traffic is producing valid tokens *before* touching this step. Only after that observation window should `enforceAppCheck: false` be flipped to `true`, and only in `functions/index.js`, one callable at a time. Start with the highest-risk callables:
- `analyzeSign`
- `generateSmartReplies`
- `generateEmailOTP`
- `claimUsername`

### 5. Deploy

```bash
firebase deploy --only functions,hosting
```

### 6. Monitor

- Firebase Console → App Check → Metrics — watch for blocked requests
- If legitimate traffic is blocked, check browser console for App Check token errors
- Rollback: set `enforceAppCheck: false` and redeploy functions

## Dev Debug Token

Set `VITE_APPCHECK_DEBUG_TOKEN=<token>` in `.env.local`. Obtain a debug token from Firebase Console → App Check → Apps → overflow menu → Manage debug tokens.

The token is only read when `import.meta.env.DEV` is true and is never included in production bundles.

## Blocking Items

- [ ] Operator: register app in Firebase Console and obtain reCAPTCHA site key
- [ ] Product: decide enforcement rollout order (which callables first)
- [ ] Legal: confirm reCAPTCHA Enterprise terms acceptable
