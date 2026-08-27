# Chat deletion write-path hardening

## Problem

`firestore.rules` let any chat participant directly delete, via the raw
Firestore SDK:

- an individual `chats/{chatId}/messages/{messageId}` document — including
  one sent by the *other* participant (the rule only checked chat
  membership, never `senderId`)
- the `chats/{chatId}` document itself

The deployed client (`MessagesView.doDeleteChat()`) deleted a conversation by
enumerating every message, batch-deleting them, then deleting the chat doc.
Because Firestore does not cascade-delete subcollections, a client that
deleted only the parent chat doc (whether by a client bug or a modified
client) would silently orphan its messages subcollection — permanently,
since the messages' own rules re-fetch the parent via `get(...)` to check
participant membership, which fails once the parent is gone.

There was also no proven guarantee that concurrent deletion and a new
`sendMessage` write couldn't race, leaving a message that "shouldn't exist"
next to an already-deleted (or about-to-be-deleted) parent.

## Fix

1. **`deleteChat`** (`functions/index.js`) — a new authenticated,
   App-Check-enforced callable. It re-verifies participant membership, marks
   the chat `deleting` inside a transaction *before* any recursive removal
   begins, then recursively deletes the messages subcollection followed by
   the parent chat doc via the Admin SDK. `sendMessage`'s own transaction
   checks that same `deleting` flag, so a write that raced the deletion
   marker is refused rather than silently orphaned. `deleteAccount`'s
   chats-cleanup step shares the identical helper (`markChatDeletingAndRecursiveDelete`),
   closing the same race there.
2. **`MessagesView.doDeleteChat()`** switched from direct
   `getDocs`/`writeBatch` to `httpsCallable(functions, 'deleteChat')({ chatId })`
   — a single request, independent of message count, with no client-side
   message enumeration.
3. **`firestore.rules`** — `chats/{chatId}: allow delete` and
   `chats/{chatId}/messages/{messageId}: allow delete` both changed from
   `chatParticipant(...)` to `if false`. Conversation deletion is now
   exclusively server-mediated.

## Rollout order (compatibility-safe — completed in this order)

1. **Deploy `functions:deleteChat`** (plus the `sendMessage`/`deleteAccount`
   race-guard changes it depends on). Rules and Hosting unchanged — the
   callable has zero production callers yet.
2. **Deploy Hosting** with `MessagesView` switched to
   `httpsCallable('deleteChat')`. Rules still unchanged — the legacy
   direct-delete path remains legally reachable for any client that hasn't
   picked up the new bundle yet, overlapping deliberately with step 3.
3. **Deploy the restrictive Firestore Rules** (`delete: if false` on both
   `chats/{chatId}` and `messages/{messageId}`) — only after step 2's client
   is confirmed live, so no legitimate client still depends on the direct
   path.

## Security contract after this rollout

Direct client SDK: chat/message `read` unchanged (participant-only); chat
`create` unchanged (locked schema); chat/message `update` still denied;
chat/message `delete` now denied unconditionally.

Server (Admin SDK, bypasses Rules): `sendMessage`, `deleteChat`, and
`deleteAccount` remain fully capable — no client requires direct
message/chat writes or deletes for any normal product behavior.

## Consequence for future chat-history pagination

Because individual message deletion is no longer possible while a chat's
parent document still exists, a bounded realtime listener's `removed`
doc-change event can now be treated unambiguously as a windowing eviction,
never a real deletion, for as long as the parent chat doc is still present
(a genuine deletion is always whole-chat, and is already detected via the
conversations-list listener). This was the second of the two dependencies
blocking pagination implementation; see the chat-history scaling
investigation for the full design.
