# Spot user-generated metadata authority hardening

## Problem

Follow-up to the chat metadata hardening: `spots/{spotId}` caches several
identity-display fields — `finderName`, `finderTitle`, `finderVehicleColor`/
`Type`/`Brand` (set at spot creation), and the `interestedUser*` /
`holdRequestedByName` equivalents (set at claim/hold-request time) — copied
from the acting user's own profile at write time. Firestore Rules validated
only type/size, never that the value actually matched the caller's real
profile. A modified authenticated client could set any of these to
arbitrary text — a false name, a fabricated high-crown "title" (e.g. "Urban
Legend" with zero real crowns), or a mismatched vehicle description — and,
unlike chat's `participantNames`, **nothing corrects it later**: spot
rendering (`SpotDetailsCard.tsx`, `StreetParkingView.tsx`) always reads the
cached spot field directly for the *other* party, with no live profile
re-fetch the way `MessagesView.tsx` does for chat partner names.

## Fields audited and their disposition

| Field(s) | Origin | Rendered to | Forgeable before this change | Self-correcting? |
|---|---|---|---|---|
| `finderId`, `interestedUserId`, `holdRequestedBy`, `claimedBy` | `== request.auth.uid` (Rules-enforced) | n/a (used as keys) | No — already authoritative | n/a |
| `finderName`/`interestedUserName`/`holdRequestedByName` | `user.username \|\| user.fullName \|\| 'Anonymous'` | Yes, prominently | **Yes** | No |
| `finderTitle`/`interestedUserTitle` | `getTitleForCrowns(user.crowns)` | Yes, as a trust/reputation badge | **Yes** | No |
| `finderVehicleColor/Type/Brand`, `interestedUserVehicle*` | `user.vehicleColor/Type/Brand` | Yes, for handoff identification | **Yes** | No |
| `address` | `reverseGeocode(lat, lng)` — never free-text in the legitimate flow | Yes | Yes, but low-impact (see Residual) | No |
| `lat`/`lng`/`geohash`/`expiresAt`/`status`/`type`/`pingMode` | Already type/range/enum/timestamp-validated | n/a or map pin | No | n/a |

## Severity

**MEDIUM-HIGH** for the identity-display group (`*Name`/`*Title`/
`*Vehicle*`): cross-user, persistent (no correction mechanism at all,
unlike chat), and spans both content-moderation risk (arbitrary/offensive
name text) and trust-integrity risk (fabricated reputation tier, mismatched
vehicle description ahead of a real-world meetup). Distinguished as a
content-moderation gap (name text) *and* an authorization/integrity gap
(title/vehicle mismatch vs. the caller's real profile) — related but not
identical, per the audit's framing.

**LOW** for `address`: an attacker who wants to mislead about location
already has a more direct tool (choosing an arbitrary `lat`/`lng` — GPS-
spoofing resistance is explicitly out of scope for this task), so
forging just the text label adds little beyond that pre-existing,
accepted limitation.

## Fix — Rules-only, zero client changes

Every legitimate write already derives these fields from the acting
user's live profile (`user.username`, `getTitleForCrowns(user.crowns)`,
`user.vehicleColor` etc.) — the only thing that changes is that Rules now
**require** the write to match. Added three helper functions
(`matchesFinderIdentity`, `matchesInterestedUserIdentity`,
`matchesHoldRequesterIdentity`, plus `expectedDisplayName`/
`titleForCrowns`) applied to exactly the three writes that first populate
each field group: spot `create` (finder), Arm 1 (claim → interestedUser),
Arm 9 (hold request → holdRequestedByName). Arms that *clear* these fields
back to `null` (claimer cancel, Arms 3/3b) are untouched — nulling out
carries no forgery risk.

`titleForCrowns` mirrors `utils/crowns.ts`'s `TITLE_THRESHOLDS`/
`getTitleForCrowns` exactly (8 fixed numeric tiers) — flagged with a
keep-in-sync comment; if the thresholds ever change, both places must be
updated together.

This required **no client changes and no new Function** — spot
creation/claim/hold-request remain direct-client writes (Phase 13's
"replace the entire Ping architecture" STOP condition does not apply: the
existing Rules-based authorization model can fully express "this field
must match the caller's own live profile"). `parqueen-user@...`'s IAM
footprint and the App Check enforced set are both unaffected.

## Production data consistency

Zero spots currently exist in production (the collection is fully
ephemeral — spots expire hourly via `cleanupExpiredSpotsHourly`). No
existing-data migration risk of any kind.

## Residual (out of scope for this PR)

- `address` text can still diverge from the true `lat`/`lng` reverse-geocode
  result — low-impact, not fixed here (see Severity above).
- GPS/coordinate-spoofing resistance is explicitly out of scope per the
  task's own instruction.
- `moderateContent` deprecation, `cleanAvatarOrphans` production drift, and
  unrelated IAM migration remain separately deferred, as before.
