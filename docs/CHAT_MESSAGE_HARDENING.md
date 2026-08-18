# Chat message write-path hardening

## Problem

Confirmed by the server-side content moderation / dead-callable audit: chat
message creation was `client → local moderateMessage() → direct Firestore
addDoc()`. `firestore.rules` validated schema/ownership/size only — no
content check. Client-side JS is not a security boundary; a modified
client (or a raw Firestore SDK call) could write banned words, slurs, or
off-platform-solicitation text directly to `chats/{chatId}/messages/{id}`,
fully satisfying the Rules.

`moderateContent` (deployed since the app's inception) was never wired to
any caller — it was designed as an audit-log sink, not the enforcement
gate — so it provided no protection either.

## Fix

New authoritative callable `sendMessage` (`functions/index.js`):
performs auth, chat-membership authorization, server-side moderation
(`functions/moderation.js`, extracted from `moderateContent`'s existing
logic — no third implementation), rate limiting, and the Firestore write
itself via the Admin SDK. `moderateMessage()` remains client-side for
instant UX feedback only; it is not relied on for enforcement.

## Rollout order (compatibility-safe — do not reorder)

1. **Deploy `functions:sendMessage` only.** Rules and Hosting unchanged.
   Existing production client keeps working exactly as before (direct
   writes still allowed) — `sendMessage` exists but nothing calls it yet.
2. **Deploy Hosting** with `MessagesView` switched to
   `httpsCallable('sendMessage')`. Rules still unchanged — this creates a
   deliberate short overlap window where the old direct-write path remains
   legally reachable (for any client that hasn't picked up the new bundle
   yet) while the new client already uses the authoritative path.
3. **Real-traffic canary**: a genuine message sent through the refreshed
   app must show up in Cloud Logging as a clean `sendMessage` invocation
   (App Check VALID, Firestore write success, zero permission errors) —
   this also doubles as the first real-traffic IAM canary for
   `parqueen-user@...`.
4. **Only after step 3 passes**, deploy the restrictive Firestore Rules
   (`messages/{messageId}: allow create: if false`) — closing the direct
   client-write path for good. If step 3 fails, do not deploy Rules; the
   old permissive Rules remain the safe rollback state.
5. **Second real-traffic check** post-Rules-deploy: another genuine
   message must still succeed through `sendMessage` (unaffected, since it
   uses the Admin SDK, which Rules don't gate).

## Stale-client note

A browser with an old cached bundle that still calls `addDoc` directly
after step 4 will get a Rules-level `PERMISSION_DENIED` on send. Firebase
Hosting serves content-hashed asset filenames, so a stale `index.html`
(the only unhashed, short-cache entry point) is the sole thing that could
keep an old bundle alive, and it self-heals on next load/refresh. This is
an acceptable, short-lived, and self-correcting failure mode — not a
reason to weaken the final Rules.

## Deferred

- `moderateContent` remains deployed but uncalled; re-evaluate for
  deprecation/removal after this migration is verified end-to-end.
- Username/`fullName` writes have the same "client-side-only moderation,
  no Rules content check" shape (see the audit) — tracked as a separate
  follow-up task, not addressed here.
- `chats/{chatId}.lastMessage`/`lastMessageTimestamp`/`lastSenderId`
  remain client-writable via `chats/{chatId}`'s own `update` rule (used
  previously to cache the message preview after `addDoc`). `sendMessage`
  now sets these itself via the Admin SDK, so the legitimate client no
  longer needs to write them directly — but the Rules branch permitting a
  direct client update to `lastMessage` was not removed in this change
  (out of scope: the audit's explicit target was the `messages` subcollection's
  `create` rule). A bypass client could still set an unmoderated preview
  string here even after this fix ships. Worth closing in a follow-up.
