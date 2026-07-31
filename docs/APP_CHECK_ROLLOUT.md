# App Check Rollout Plan (TM-12)

## Current State

App Check is **not enforced**. All Cloud Functions callables have `enforceAppCheck: false`. The debug-token hook is wired into `firebaseConfig.ts` (dev builds only, tree-shaken from prod).

## Why Not Enforced Yet

Web enforcement requires a reCAPTCHA site key from Firebase console and explicit enrollment per app. Premature enforcement would lock out legitimate users before the site key is configured.

## Steps to Enable Production Enforcement

### 1. Register App Check in Firebase Console

1. Firebase Console → App Check → Apps
2. Register the web app (appId `1:768131391875:web:613c5d2a948862333196b6`)
3. Choose provider: **reCAPTCHA Enterprise** (recommended for production) or reCAPTCHA v3
4. Copy the site key

### 2. Configure reCAPTCHA in Vite

Add to `.env.production`:
```
VITE_RECAPTCHA_SITE_KEY=<site-key-from-console>
```

### 3. Initialize App Check in `firebaseConfig.ts`

After the `initializeApp` call, add:
```typescript
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (siteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
```

### 4. Enable Enforcement on Cloud Functions

In `functions/index.js`, change `enforceAppCheck: false` to `enforceAppCheck: true` on each callable where enforcement is desired. Start with the highest-risk callables:
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
