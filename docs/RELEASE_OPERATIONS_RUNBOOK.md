# ParQueen Release Operations Runbook

Assessment date: 2026-07-24  
Status: draft — based on repository and Firebase configuration inspection; steps require operator validation before first use

---

## Overview

This runbook covers the steps to deploy a web release of ParQueen. It does not cover native iOS/Android packaging; those require a separate runbook once a native architecture is selected.

**Key principle:** All changes to production must be separately approved before execution. This runbook describes steps, not authorization. Do not execute any step without a go/no-go decision from the designated approver.

---

## Pre-deployment checklist

Run through the full QA Release Matrix (`docs/QA_RELEASE_MATRIX.md`) Gates 1–9 before proceeding. Every REQUIRED row must be PASS. Record gate sign-offs in that document.

In addition, confirm:

- [ ] BLK-01 resolved: `cdn.voiceagent.ai` script removed from `index.html`
- [ ] BLK-02 resolved: Firestore Rules on audit branch approved for deployment
- [ ] BLK-03 resolved: `deleteAccount` callable covers all data collections
- [ ] BLK-04 resolved: CSP headers defined in `firebase.json`
- [ ] BLK-05 resolved: Phone and email removed from public user document
- [ ] Storage Rules committed to `storage.rules` and approved
- [ ] All secrets confirmed rotated/valid (TM-19)
- [ ] Firebase budget alert set

---

## Environment setup

### Required tools

- Node.js 20+ (production Functions runtime) or 24+ (used in audit)
- npm 11+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project access: `firebase login` with authorized account
- Git with access to `origin/main`

### Firebase project

- Project ID: `parkqueen-46475363-ccf36`
- Hosting URL: `https://parkqueen-46475363-ccf36.web.app`
- Region: `us-central1` (Functions)
- Production branch: `main`

---

## Deployment steps

### Step 1: Prepare the release branch

```bash
git checkout main
git pull origin main
# Verify baseline commit
git log --oneline -1  # expected: b761795 or a descendant
```

Cherry-pick or merge only approved commits from `audit/app-store-readiness-2026`:

```bash
# Example — only after separate code review and approval of each commit
git cherry-pick <firestore-rules-fix-commit>
git cherry-pick <dependency-fix-commit>
# Do NOT cherry-pick in bulk; review each commit independently
```

### Step 2: Run full gate suite

```bash
npm ci                     # must succeed without flags
npx tsc --noEmit           # must pass
npm test                   # must pass all tests
npm run build              # must produce dist/
npm run test:rules         # must pass all 70 tests
```

Do not proceed if any gate fails.

### Step 3: Verify no secrets in bundle

```bash
# After npm run build:
grep -r 'AIzaSy' dist/ | grep -v 'apiKey'      # Should only match the public Firebase apiKey
grep -r 'sk-\|SG\.\|sendgrid' dist/             # Must return no results
grep -r 'voiceagent' dist/                       # Must return no results
grep -r 'acme-corp' dist/                        # Must return no results
```

### Step 4: Deploy Firestore Rules

```bash
# Review the rules before deploying
cat firestore.rules

# Deploy to production — requires Firebase project access
firebase deploy --only firestore:rules

# Immediately verify the deployed rules hash matches the file
firebase firestore:rules:get --project parkqueen-46475363-ccf36
```

**Note:** Deploying Firestore Rules is a live, immediate change to production access control. Confirm the emulator test suite passes (Step 2) immediately before this step.

### Step 5: Deploy Storage Rules (when `storage.rules` exists)

```bash
# Only after storage.rules is committed and reviewed
firebase deploy --only storage
```

### Step 6: Deploy Cloud Functions

```bash
cd functions
npm ci           # Functions have their own package.json
cd ..

# Deploy all functions (or specific ones)
firebase deploy --only functions

# Verify deployment
firebase functions:list
```

**Rollback:** If a function deployment fails, the previous version continues serving. To rollback to a specific revision, redeploy the prior commit.

### Step 7: Deploy hosting

```bash
# Build must have been run in Step 2 already
firebase deploy --only hosting
```

After deployment:

```bash
# Verify the deployed version
curl -I https://parkqueen-46475363-ccf36.web.app/
# Check: Content-Security-Policy header present
# Check: X-Content-Type-Options: nosniff
# Check: X-Frame-Options: DENY (or SAMEORIGIN)
```

### Step 8: Smoke test

Open `https://parkqueen-46475363-ccf36.web.app/` in a fresh private window:

- [ ] App loads without console errors
- [ ] Sign-in flow completes (use test phone number)
- [ ] Map renders and shows user location
- [ ] Create a Ping (or verify existing Ping visible)
- [ ] Chat view opens without unauthorized data visible
- [ ] Sign out — confirm session data cleared

### Step 9: Post-deployment monitoring

Check Firebase console within 1 hour of deployment:

- [ ] Function error rate stable (< 5%)
- [ ] Firestore reads within expected range
- [ ] No unexpected billing spike
- [ ] No 401/403 errors in Hosting logs

---

## Rollback procedures

### Hosting rollback

Firebase Hosting maintains a release history. Rollback to the previous release:

```bash
firebase hosting:rollback
```

Or via the Firebase console: Hosting → Release history → select prior release → Roll back.

### Firestore Rules rollback

Rules changes can be rolled back by re-deploying the prior `firestore.rules` file:

```bash
git checkout <prior-commit> -- firestore.rules
firebase deploy --only firestore:rules
git checkout HEAD -- firestore.rules   # restore current version
```

### Functions rollback

Redeploy the prior functions commit:

```bash
git stash
git checkout <prior-commit>
cd functions && npm ci && cd ..
firebase deploy --only functions
git stash pop
```

### Emergency: break-glass incident response

If a critical security incident is detected in production:

1. **Disable sign-in:** Firebase console → Authentication → Sign-in method → Disable all providers temporarily.
2. **Lock Firestore reads:** Deploy a `firestore.rules` that denies all access (`match /{document=**} { allow read, write: if false; }`).
3. **Disable Functions:** Firebase console → Functions → select function → Disable.
4. **Notify team:** Post to incident channel with timestamp, symptom, and initial action taken.
5. **Preserve evidence:** Do not delete logs; capture screenshots of Firebase console metrics.
6. **Root cause:** Investigate after users are protected, not before.
7. **Re-enable:** Only after root cause is confirmed and fix deployed.

---

## Secret management

All secrets are stored in Google Cloud Secret Manager. Do not hard-code secrets in source, functions, or CI variables.

| Secret name | Purpose | Owner to rotate |
|---|---|---|
| `geminiApiKey` | Gemini API access for AI features | Engineering |
| `sendgrid-api-key` (if present) | Email OTP | Engineering |
| `mapbox_token` (if in Secret Manager) | Server-side Mapbox usage | Engineering |

To verify secret versions:

```bash
gcloud secrets list --project parkqueen-46475363-ccf36
gcloud secrets versions list <secret-name> --project parkqueen-46475363-ccf36
```

Do not print secret values. Only verify that active versions exist and are recent.

---

## Firebase Hosting headers

**These are already live.** `firebase.json` is the single source of truth — read the
`hosting.headers` block there rather than this snippet, which is kept only to show the
original shape and has since diverged from production in several ways: the policy is
enforced with a `report-uri` to Sentry, `style-src` needs `'unsafe-inline'` for React's
inline style attributes, `firebaseio.com` was dropped (the app is Firestore-only), no
nonce is used (there are no inline scripts), and `Cache-Control: no-cache` now defaults
on `**` so SPA routes cannot serve stale HTML. Pinned by `utils/cspConfig.test.ts`,
`utils/cspReporting.test.ts` and `utils/hostingCacheControl.test.ts`.

Historical proposal:

```json
"headers": [
  {
    "source": "**",
    "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      {
        "key": "Content-Security-Policy",
        "value": "default-src 'self'; script-src 'self' 'nonce-REPLACE'; style-src 'self' https://api.mapbox.com; img-src 'self' data: blob: https://*.mapbox.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.mapbox.com; font-src 'self' https://cdnjs.cloudflare.com; worker-src blob:; frame-ancestors 'none'"
      }
    ]
  },
  {
    "source": "**/*.@(js|css|woff2)",
    "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
    ]
  },
  {
    "source": "/index.html",
    "headers": [
      { "key": "Cache-Control", "value": "no-cache" }
    ]
  }
]
```

**Note:** The CSP `nonce-REPLACE` directive requires server-side nonce injection or a build plugin. For a static SPA, `'unsafe-inline'` may be needed for inline styles with a plan to remove after further refactoring. This must be reviewed by the security lead before deployment.

---

## Deployment frequency and branching

- All deployable changes must originate from reviewed, passing commits on `main`.
- Do not deploy directly from feature branches.
- `audit/app-store-readiness-2026` findings must be cherry-picked to `main` after individual code review, not merged wholesale.
- Never force-push `main`.
- Tag each production deployment: `git tag -a v<major>.<minor>.<patch> -m "Release message"`.

---

## Contacts and escalation

| Role | Responsibility |
|---|---|
| Engineering lead | Release authorization, hotfix decisions |
| Security lead | Gate 2 sign-off, Rules deployment approval |
| Firebase project admin | Console access, IAM changes |
| On-call engineer | Post-deployment monitoring, rollback execution |

No deployment step should be executed without at least one additional person reviewing the output.
