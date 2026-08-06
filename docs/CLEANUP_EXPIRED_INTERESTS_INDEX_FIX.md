# cleanupExpiredInterests — missing index + write-safety fix

Tracks [issue #7](https://github.com/chizTheDeveloper/ParkQueen/issues/7).

## Failing query

`functions/index.js`, `cleanupExpiredInterests` (scheduled, every 1 minute, `us-central1`):

```js
db.collection("spots")
  .where("status", "==", "interested")
  .where("interestExpiresAt", "<=", now)
  .limit(100)
  .get();
```

(The limit was lowered from the original `500` to `100` as part of this fix — see "Runtime and backlog safety" below. The composite index requirement is unaffected: it's the same two fields either way.)

Every invocation has been throwing since deployment:

```
Error: 9 FAILED_PRECONDITION: The query requires an index. You can create it here: ...
```

Decoding the error's `create_composite` parameter confirms the exact requirement:

- Collection: `spots`
- Fields: `status` ASCENDING, `interestExpiresAt` ASCENDING (plus the implicit `__name__` tiebreaker)

This index does not exist in `firestore.indexes.json`, nor is it deployed — it is genuinely missing (not an undeployed-but-present case, and not a direction/collection-group mismatch).

Because `.get()` throws before returning a snapshot, **zero cleanup work happens on any invocation** — this has been a complete, silent no-op every ~60 seconds since deployment, not a partial failure.

## Required index

Added to `firestore.indexes.json`:

```json
{
  "collectionGroup": "spots",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "interestExpiresAt", "order": "ASCENDING" }
  ]
}
```

## Beyond the index: two write-safety defects

Adding only the index would have made this query start succeeding — and started actively exercising a write path that has never run in production. Review of that write path against the equivalent, already-safe pattern in `processScheduledClaims` found two real defects:

1. **Could reopen an already-expired Ping.** The original code unconditionally set `status: "available"` on every matching document. For a *committed* (scheduled) claim, `interestExpiresAt` is set equal to the Ping's own `expiresAt` at commit time (`handleScheduledClaim`), so once a committed claim's `interestExpiresAt` passes, the Ping itself has also expired — and this Function would have reopened it, violating the "expired Ping never reopens" invariant established elsewhere in this codebase (client Firestore Rules Arm 3/3b, `processScheduledClaims` Pass 2).
2. **TOCTOU race via a non-transactional batch.** The original code read a snapshot, then blindly `batch.update()`d every matched document with no re-validation. If a claimant committed to heading, delayed, or was replaced by a newer claimant between the initial query and the batch commit, their live claim would still have been silently cleared using the stale snapshot.

Both are fixed by switching from a single batch to a per-document transaction that re-reads fresh state immediately before writing, re-validates `status`/`interestExpiresAt` against current data, and branches on the Ping's own expiry before deciding whether to reopen it — mirroring the pattern already proven safe in `processScheduledClaims`.

## Runtime and backlog safety

The candidate query can return multiple documents, and this Function has a 60s timeout on a 1-minute schedule. Processing is a sequential `for...of` loop of independent transactions — deliberately **not** `Promise.all(snap.docs.map(...))` (unbounded concurrent transactions) and **not** the original `limit(500)` (too large to safely guarantee completion within 60s under realistic Firestore transaction latency).

- Query limit lowered to **100** candidates per invocation.
- Worst-case operation count per invocation: ~100 transactional reads + up to 100 transactional writes ≈ 200 document operations, plus the initial query read (≈100 document reads) — roughly 300 operations total.
- At realistic per-transaction latency (tens of ms in the same region), 100 sequential transactions comfortably completes in low single-digit seconds; even a pessimistic 200ms/transaction stays at ~20s, well under the 60s timeout.
- A backlog larger than 100 simply drains across successive one-minute runs rather than risking a timed-out invocation — proven in `cleanupExpiredInterests.integration.test.js` (CEI-11) by seeding 120 candidates and confirming the first run releases ≤100 and the second run drains the remainder.
- **No starvation is possible.** A candidate that gets cleared (fields nulled, including `interestExpiresAt`) can never match the query again — Firestore's range comparison (`<= now`) excludes `null` values — regardless of whether `status` stays `"interested"` (the never-reopen case). A committed/protected claim whose Ping hasn't expired yet is excluded from candidacy by the query itself (`interestExpiresAt` still in the future). Proven in CEI-12.
- Overlapping invocations (the service has `containerConcurrency: 80`, so two scheduler-triggered instances could in principle run concurrently) are safe: each candidate's fresh in-transaction re-read means whichever commit lands first wins, and the other sees already-cleared state and no-ops. Proven in CEI-10.
- One candidate's transaction failure is caught per-iteration and does not abort the rest of the batch; the invocation logs `examined`, `released`, `skipped`, and `errors` counts (no user IDs or private data).

## Deployment scope

**`functions:cleanupExpiredInterests` and `firestore:indexes` only.** No Rules, Hosting, Storage Rules, App Check, or other Function changes.

### Required order: Function before index

Deploy the corrected Function **before** the index, not after:

1. Deploy `functions:cleanupExpiredInterests`.
2. Confirm the new revision is active.
3. Deploy `firestore:indexes`.
4. Wait for the new composite index to reach `READY`.
5. Observe subsequent scheduler executions.

**Why this order matters:** the currently-deployed Function contains the two write-safety defects described above. The missing index is what has been preventing that unsafe code from ever reaching its writes (every invocation throws `FAILED_PRECONDITION` before any write is staged). Deploying the index first — while the old, unsafe Function revision is still active — would let the existing defective code start running for real, actively reopening expired Pings and racing stale claims. Deploying the corrected Function first means that once the index does become `READY`, only the safe, transaction-guarded code path can ever execute. While the index is still `BUILDING`, the corrected Function continues returning `FAILED_PRECONDITION` — expected and safe, since no candidate writes occur either way.

## Verification procedure

1. `firebase deploy --only functions:cleanupExpiredInterests --project parkqueen-46475363-ccf36`; confirm the new revision is `ACTIVE` with unchanged config (Node.js 20, Gen 2, `us-central1`, schedule, memory, timeout, concurrency, no secrets).
2. `firebase deploy --only firestore:indexes --project parkqueen-46475363-ccf36`.
3. Poll index state until `READY`: `gcloud firestore indexes composite list --project parkqueen-46475363-ccf36` (or the Firebase console Indexes tab).
4. Confirm in Cloud Logging that `cleanupExpiredInterests` starts logging `✅ cleanupExpiredInterests: examined N, released N, skipped N, errors N` instead of `FAILED_PRECONDITION`.
5. Observe at least three successful scheduled invocations before considering the incident resolved.

## Rollback implications

- **Do not** route `cleanupExpiredInterests` back to revision `cleanupexpiredinterests-00029-hun` (or any pre-fix revision) while the new index remains `READY` — that revision contains the unsafe write behavior the missing index was inadvertently masking; with the index present it would actually execute.
- If the corrected Function must be disabled, prefer pausing/disabling the Cloud Scheduler job or deploying an explicitly-reviewed safe no-op revision — not restoring the old code.
- Removing the index alone is not an immediate safe rollback: index deletion is not instantaneous, and while it still exists the old unsafe code (if ever redeployed) could still run against it.
- No production data migration is involved either way; the index only affects query planning, and the code fix only affects which writes are staged, not existing document shapes.
- To fully revert, do so through a protected PR after production is confirmed stable, not via direct redeploys of old artifacts.
