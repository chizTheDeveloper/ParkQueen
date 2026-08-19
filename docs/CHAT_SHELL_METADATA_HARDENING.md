# Chat shell metadata hardening

Narrow follow-up to the authoritative chat-metadata hardening (which closed
`lastMessage`/`lastMessageTimestamp`/`lastSenderId`). This closes the two
remaining client-writable `chats/{chatId}` fields: `participantNames` and
`relatedSpotTitle`.

## `participantNames` — REMOVED

**Producer:** `MessagesView.tsx`'s `initChat()`, written once at chat
creation from `user.fullName`/a live lookup of the other participant's
`users/{uid}.fullName` at that moment.

**Consumer:** the conversation-list and chat-header display-name fallback
chain — but only as the *second* priority, after a live lookup.

**The decisive finding:** `MessagesView.tsx` already does a live, always-
overriding lookup of `users/{uid}.fullName` for every conversation partner
(`fetchNames()`, populating `userProfilesCache`), and the render logic
(`userProfilesCache[...]?.name || ...`) always prefers that live value.
`participantNames` was only ever visible during the brief window before
that lookup resolves — typically a fraction of a second, every time, with
no user action required. This is real and exploitable (an attacker sharing
a chat with a victim could forge the cached name and it *would* render,
briefly) but not persistent — it self-heals on every load without
depending on the victim doing anything.

**Severity: LOW.** Cross-user but not persistent — bounded to a sub-second,
automatically-corrected window. (Explicitly not dismissed as "safe because
self-correcting" — the exploit is real, just short-lived.)

**Decision: REMOVE (Option C).** Since the live lookup already exists and
always wins, the cache had no remaining purpose beyond being forgeable
attack surface. Removed from the Rules schema (`create`/`update`), from
`initChat()`'s write, and from every place that read it for display. The
fallback chain is now simply `userProfilesCache[...]?.name ||
t('messages.anonymous')` — during the loading window, a generic
placeholder shows instead of a name that could theoretically be forged.

## `relatedSpotTitle` — CREATE-ONCE

**Producer:** `MessagesView.tsx`'s `initChat()`, from
`activeChatContext.context` — an app-generated string (e.g. "Spot pinged by
X") assembled client-side at the moment the user clicks "Message" from a
spot card, not raw free-text user input.

**Consumer:** rendered directly and unconditionally in both the chat header
and the conversation-list item (`{conv.relatedSpotTitle}`) — no live
override exists for this field (unlike `participantNames`), since the
originating spot is ephemeral (spots expire and get deleted by
`cleanupExpiredSpotsHourly`) and there is no always-available authoritative
source to re-derive it from later.

**The gap:** it remained in the chat `update` Rules' allowed-field list, so
a participant could mutate it to arbitrary text at any point after chat
creation — completely bypassing the app-generated-string-template
constraint that governs its value at creation time. Because nothing
overrides it on render (unlike `participantNames`), this exposure **is**
persistent.

**Severity: MEDIUM.** Cross-user-persistent, renders unconditionally,
bounded to chats the attacker already participates in.

**Decision: CREATE-ONCE (Option B).** Not server-derived — there's no
live spot/listing document to authoritatively re-derive it from after
creation (out of scope: whether spot-document fields like `finderName`
are themselves content-moderated is a separate, unrelated question — see
Residual below). Remains client-supplied once, at creation, then
immutable. Rules: still allowed in `create`'s optional-field list; no
longer reachable through any `update` path at all.

## Net effect on `chats/{chatId}` Rules

With `lastMessage`/`lastMessageTimestamp`/`lastSenderId` already server-
owned (prior PR), `participantNames` removed, and `relatedSpotTitle` now
create-once, **no field on an existing `chats/{chatId}` doc is directly
client-updatable at all** — `allow update: if false`. `initChat()` was
updated to check for the chat's existence first and skip the write
entirely on re-navigation to an existing conversation (previously it
always attempted a `{merge:true}` write, which would now be rejected).

## Residual (out of scope for this PR)

`relatedSpotTitle`'s content, and `finderName`/`interestedUserName` more
broadly, ultimately trace back to `spots/{id}` document fields that are
themselves not content-moderated (only size-bounded) at the Rules level.
This is a separate, pre-existing gap in an unrelated subsystem (spot/ping
documents, not chat documents) and is not addressed here.
