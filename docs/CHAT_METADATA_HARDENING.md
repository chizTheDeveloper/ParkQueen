# Chat metadata write-path hardening

## Problem

Follow-up finding from the chat message write-path hardening: `sendMessage`
already writes `chats/{chatId}.lastMessage`/`lastMessageTimestamp`/
`lastSenderId` atomically with each message (via the Admin SDK, in the same
transaction as the message document). But `firestore.rules`' `chats/{chatId}`
`create`/`update` rules still allowed a direct client write of those same
three fields — the Rules only checked size/type of the fields present, not
who was authoritative for them. A participant (or a modified client) could
set `lastMessage` to arbitrary unmoderated text, `lastSenderId` to their own
uid, and `lastMessageTimestamp` to any value, entirely bypassing
`sendMessage`'s moderation/rate-limit/membership checks — creating a fake
"latest message" preview in the other participant's chat list without ever
creating a corresponding (or any) message document.

**A live, non-test instance of this gap was found in production code**:
`views/MessagesView.tsx`'s `initChat()` (the function that creates/re-touches
a chat document before the user has sent their first real message) wrote a
hardcoded `lastMessage: "Conversation started"` placeholder directly via
`setDoc`. Beyond the security gap, this was also a latent functional bug:
re-navigating to an *existing* conversation (e.g. clicking "Message" again
from a spot card) would silently overwrite the real last-message preview
back to that placeholder.

A second, unrelated finding: `views/street-parking/SpotDetailsCard.tsx`
contained a `sendQuickReply` function using the old pre-`sendMessage`
direct-write pattern (`setDoc`/`addDoc` straight to Firestore). It was
**dead code** — not wired to any button or state that could trigger it
(confirmed by repo-wide search: `sendQuickReply`, `quickReplies`,
`showQuickReplies`, and `messageSent` had no call sites or JSX references).
Removed rather than migrated, since the equivalent live functionality
already exists via `onMessageUser` → `MessagesView` → `sendMessage`.

## Fix

- `firestore.rules`' `chats/{chatId}`: `lastMessage`/`lastMessageTimestamp`/
  `lastSenderId` removed entirely from both the `create` and `update`
  allowed-field lists. `sendMessage` (Admin SDK) remains the sole writer of
  these three fields — Rules changes don't affect it.
- `participants`/`participantNames`/`relatedSpotTitle` remain client-writable
  (via `initChat()`, on chat creation and idempotent re-navigation) — these
  are chat *setup* fields chosen once by the initiating participant, not
  message-derived preview data, and are out of this task's scope (see
  Residual below).
- `MessagesView.tsx`'s `initChat()` no longer sends the fabricated
  `lastMessage`/`lastMessageTimestamp`/`lastSenderId` placeholder at all —
  those fields stay absent until the first real `sendMessage` call sets
  them authoritatively.
- `SpotDetailsCard.tsx`'s dead `sendQuickReply` (and its now-unused
  `quickReplies` array, `showQuickReplies`/`messageSent` state, and
  Firestore imports) removed.

## Severity

**MEDIUM.** Cross-user-persistent (not local-only/cosmetic): the forged
`lastMessage` is visible in the *other* participant's real chat-list UI.
Bounded to chats the attacker is already a legitimate participant in (no
access to arbitrary strangers' chats). No message document is created, so
the forged preview has no underlying "real" content and doesn't survive a
close inspection of the messages subcollection — but the chat-list preview
itself, which is what most users actually see day-to-day, was fully
attacker-controlled and unmoderated.

## Residual (out of scope for this PR)

`participantNames` is read as a display-name fallback in the chat list/
header (`MessagesView.tsx`), and remains client-writable with no content
moderation — a participant could set `participantNames[otherUid]` to an
arbitrary string, visible until the live profile-name lookup
(`userProfilesCache`) overrides it. Lower severity than the `lastMessage`
gap (self-correcting once the real profile loads; the content class is
"a cached display name" set once at conversation start, not a persistent
message-like preview) and architecturally more like the "chat settings"
Phase 7 explicitly says should stay client-owned. Tracked separately, not
fixed here.
