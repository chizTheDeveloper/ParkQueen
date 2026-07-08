# Name Safety — Brand Protection & Impersonation Prevention

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent impersonation of ParQueen brand and fake support/official accounts by enforcing normalized blocking on usernames and display names — both client-side and server-side.

**Architecture:** Two files changed: `utils/moderation.ts` (client) and `functions/index.js` (server). Both currently use exact-match for reserved words, missing compound names like `parqueen_admin` or `admin123`. Fix: two-tier approach — substring blocking for brand/strong terms, exact-token blocking for short ambiguous terms.

**Tech Stack:** TypeScript (client), Node.js CommonJS (Cloud Functions)

## Global Constraints

- Do NOT touch Firestore rules.
- Do NOT touch Cloud Functions beyond the reserved-word check in `claimUsername` and `moderateContent`.
- Do NOT touch auth logic.
- Do NOT touch admin views or admin audit log.
- Error messages must NEVER reveal which specific reserved word was detected.
- Client and server must use identical term lists and identical normalization logic (maintained separately — no shared import between them).
- No new dependencies.
- `moderateDisplayName` uses the same checks as usernames. Beta safety > edge-case flexibility.
- The existing `BANNED_WORDS` profanity list is NOT changed.

---

## Two-tier blocking strategy

### Tier 1 — Compact normalization + substring match
Used for: brand terms, strong/unambiguous internal terms.
- `compactNormalize`: lowercase → l33tspeak substitutions → strip `[_\-.\s]`
- Block if normalized string **contains** the term anywhere.

```
"parqueen_admin" → "parqueenadmin" → contains "parqueen" → blocked
"admin123"       → "admin123"       → contains "admin"    → blocked
"0fficial"       → "official"       → contains "official" → blocked
```

### Tier 2 — Token splitting + exact match
Used for: short/ambiguous terms (`mod`, `dev`, `api`, `team`, `help`).
- `tokenize`: lowercase → split on `[_\-.\s]+` → array of tokens
- Block if **any token exactly equals** the short term.

```
"mod_team"      → ["mod","team"]     → "mod" exact → blocked
"modernDriver"  → ["modernDriver"]   → no exact match → allowed
"dev_support"   → ["dev","support"]  → "dev" exact → blocked (also "support" in tier 1)
"devonParks"    → ["devonParks"]     → no exact match → allowed
"steam"         → ["steam"]          → not "team" → allowed
"helpfulDriver" → ["helpfulDriver"]  → not "help" → allowed
```

---

## Term lists

### Brand terms (tier 1 — substring after compact normalize)
```
parqueen, parkqueen
```

### Strong reserved terms (tier 1 — substring after compact normalize)
```
admin, administrator, support, official, system, root, security,
firebase, backend, moderator, staff, owner, founder, developer
```

### Short ambiguous terms (tier 2 — exact token match)
```
mod, dev, api, team, help
```

---

## Files changed

- `utils/moderation.ts` — client-side validation
- `functions/index.js` — server-side `claimUsername` + `moderateContent`
- `views/EditProfileView.tsx` — wire `moderateDisplayName` into display name save

---

## Implementation (completed ✓)

### `utils/moderation.ts`

1. Replace `RESERVED` set with `BRAND_TERMS`, `STRONG_RESERVED`, `SHORT_RESERVED` arrays.
2. Rename existing `normalize` → `compactNormalize` (internal, already does l33tspeak + separator strip).
3. Add `tokenize` helper (lowercase, split on `[_\-.\s]+`).
4. Replace `checkReservedUsername` with `checkImpersonation` using two-tier logic.
5. Update `moderateUsername` — call `checkImpersonation`, error: `"Please choose a different username."`
6. Add `moderateDisplayName` — same checks, error: `"That name can't be used. Please choose another."`

### `functions/index.js`

1. Replace `RESERVED_USERNAMES` with matching `BRAND_TERMS`, `STRONG_RESERVED`, `SHORT_RESERVED`.
2. Add `tokenize` helper.
3. Add `checkImpersonation` function.
4. Update `moderateContent` (username type) to call `checkImpersonation`.
5. Update `claimUsername` reserved check to call `checkImpersonation`.

### `views/EditProfileView.tsx`

1. Import `moderateDisplayName`.
2. Add `fullName` check in `handleSave` before the Firestore write.

---

## Final report checklist

- [ ] ParQueen/brand impersonation blocked (substring, tier 1)
- [ ] Admin/support/internal impersonation blocked (substring, tier 1)
- [ ] Short ambiguous terms blocked only on exact token — no false positives on "modernDriver", "devonParks", "steam", "helpfulDriver"
- [ ] `claimUsername` Cloud Function enforces same check server-side
- [ ] `moderateContent` callable enforces same check for username type
- [ ] UI shows generic copy only — blocked term never revealed
- [ ] `moderateDisplayName` wired into display name save in EditProfileView
- [ ] No Firestore data shape changed
- [ ] `npx tsc --noEmit` clean
- [ ] `npm test` — all 40 pass
- [ ] `npm run build` clean
