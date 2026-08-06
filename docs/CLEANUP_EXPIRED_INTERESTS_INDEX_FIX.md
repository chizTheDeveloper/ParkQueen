# cleanupExpiredInterests — missing index + write-safety fix

Tracks [issue #7](https://github.com/chizTheDeveloper/ParkQueen/issues/7).

## Failing query

`functions/index.js`, `cleanupExpiredInterests` (scheduled, every 1 minute, `us-central1`):

```js
db.collection("spots")
  .where("status", "==", "interested")
  .where("interestExpiresAt", "<=", now)
  .limit(500)
  .get();
```

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

## Deployment scope

**Firestore indexes only** (`firebase deploy --only firestore:indexes`), plus the corrected `cleanupExpiredInterests` Function source deploys as part of the next Functions deployment. No Rules, Hosting, Storage Rules, App Check, or other Function changes.

## Verification procedure

1. `firebase deploy --only firestore:indexes --project parkqueen-46475363-ccf36`.
2. Poll index state until `READY`:
   `gcloud firestore indexes composite list --project parkqueen-46475363-ccf36` (or the Firebase console Indexes tab) — building can take from seconds to minutes depending on collection size.
3. Deploy the corrected Function source (standard Functions deployment).
4. Confirm in Cloud Logging that `cleanupExpiredInterests` starts logging `✅ cleanupExpiredInterests: reverted N of M candidate spots` instead of `FAILED_PRECONDITION`.
5. Spot-check a manufactured expired claim (non-expired Ping) reopens to `available`, and one on an expired Ping does not.

## Rollback implications

- Reverting the index deploy alone returns the Function to its current no-op-via-exception state — safe, no data risk, matches the last several weeks of production behavior.
- Reverting the source fix alone (index still present) would restore the two write-safety defects under a now-succeeding query — not recommended; roll back both together if rolling back at all.
- No production data migration is involved; the index only affects query planning, and the code fix only affects which writes are staged, not existing document shapes.
