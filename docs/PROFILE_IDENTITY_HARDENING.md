# Profile identity write-path hardening

## Problem

Confirmed by the server-side content moderation / dead-callable audit:
`users/{uid}.username` and `users/{uid}.fullName` were both directly
client-writable. `firestore.rules` validated schema/size/ownership only —
never content — so a modified client could bypass `claimUsername`'s
server-side uniqueness/moderation checks (for `username`) or the purely
client-side `moderateDisplayName()` (for `fullName`, which had no server
check at all) and write a banned/impersonating value straight into its own
profile document.

## Fix

- **`claimUsername`** (existing callable) is now the sole authoritative
  writer of `users/{uid}.username`, extended to also atomically create the
  initial `users/{uid}` account doc (plus its `private/social` and
  `private/preferences` seed docs) for a brand-new account — a
  responsibility formerly split out to the client's `saveUserProfile()`
  (now removed; see `database.ts`). Reservation and profile can no longer
  disagree, and account bootstrap is now a single atomic transaction
  instead of a client `Promise.all` of independent writes.
- **`updateDisplayName`** (new callable) is the sole authoritative writer of
  `users/{uid}.fullName`, mirroring `moderateContent`'s existing
  banned-word/impersonation checks (`checkBannedWords`/`checkImpersonation`).
- `firestore.rules`' `users/{userId}`: `create` is now `if false` (no
  legitimate client create path remains); `update`'s allowed-field list no
  longer includes `username`/`fullName` — an ordinary owner update touching
  either field is denied, while vehicle/avatar fields remain editable.
- `moderateDisplayName()`/`moderateUsername()` (client) remain for instant
  UX feedback only — not a security boundary.

## Production data consistency (pre-migration, read-only, aggregate-only)

9 user profiles, 11 username reservations. Zero duplicates, zero malformed
usernames, zero owner mismatches, zero profile-without-reservation cases.
2 reservations had no matching user doc — the pre-existing, already
anticipated "orphaned reservation from an interrupted claim" case (see
`claimUsername`'s own prior comments and test `RL-U3`). `claimUsername`'s
idempotent-retry branch now self-heals this by creating the missing
account doc if one doesn't exist, instead of silently no-op'ing.

## App Check

- `updateDisplayName`: enforced from first release (new callable, no
  legacy caller — same reasoning as `sendMessage`).
- `claimUsername`: **not** enforced. Real production traffic sampled over
  the last 30 days (6 genuine invocations) showed App Check `MISSING` on
  every request — this traffic predates the client's current App-Check-
  active bundle, and there have been zero fresh samples since. Enforcing
  without current evidence risks breaking account creation for real users;
  revisit once fresh post-App-Check-client traffic exists.

## Rollout order (same pattern as chat hardening)

1. Deploy `functions:claimUsername` and `functions:updateDisplayName` only.
2. Deploy Hosting (client migrated to the two callables).
3. Real-traffic canary for both paths.
4. Deploy the restrictive Firestore Rules.
5. Second real-traffic check.

## Deferred

- `claimUsername`'s own App Check enforcement — pending fresh traffic
  evidence (see above).
- The wider question of whether other `users/{userId}` fields (vehicle,
  avatar) deserve their own authoritative write paths is out of scope —
  those fields carry no comparable moderation/uniqueness requirement.
