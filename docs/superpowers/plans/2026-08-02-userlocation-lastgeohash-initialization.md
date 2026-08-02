# UserLocation Last-Geohash Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first consented GPS update create the Rules-valid `userLocations/{uid}` document and safely update it thereafter without stale-UID writes or concurrent duplicate writes.

**Architecture:** Keep `userLocations/{uid}` optional until the map owns an authorized GPS result. A small session-local persister validates consent and current Auth ownership, serializes first writes, and calls one atomic Firestore `setDoc(..., { merge: true })` containing the complete two-field schema. The map owns one persister instance per mount; no account bootstrap, backend, or Rules behavior changes.

**Tech Stack:** React 18, TypeScript, Firebase Auth/Firestore 10.8, Vitest 4, Firebase Firestore Emulator.

## Global Constraints

- Branch only: `codex/fix-userlocation-lastgeohash-initialization`, based on `73dd4db3b2dad8f9a9c7e280a761458727f416ac`.
- Do not modify or deploy Functions, Rules, indexes, Storage, App Check, migrations, secrets, provider configuration, Hosting, or Parsona.
- Never write location data without persisted/browser location consent and a matching current Auth UID.
- Preserve the canonical schema: exactly `lastGeohash: string` and `lastGeohashUpdatedAt: timestamp`.
- Use `serverTimestamp()` in the production write and retain unrelated fields through merge semantics.
- Commit and push the feature branch only, then stop for review.

---

### Task 1: Session-Owned Geohash Persister

**Files:**
- Create: `utils/userLocationGeohash.ts`
- Create: `utils/userLocationGeohash.test.ts`

**Interfaces:**
- Produces: `createUserLocationGeohashPersister(write): { persist(input): Promise<'written' | 'skipped'> }`.
- Consumes: a `write(uid, geohash)` function so unit tests exercise the ownership/concurrency contract without a production Firebase connection.

- [ ] Write failing tests proving a first authorized update writes, duplicate concurrent updates serialize to one write, failed writes remain retryable, denied consent skips, missing/mismatched Auth skips, and a recreated account writes only its new UID.
- [ ] Run `npm.cmd test -- utils/userLocationGeohash.test.ts --run` and verify failure because the module does not exist.
- [ ] Implement the minimal closure with session-local persisted-prefix and in-flight state.
- [ ] Rerun the focused test and verify every behavior passes.

### Task 2: Firestore Upsert Compatibility and Map Integration

**Files:**
- Modify: `views/StreetParkingView.tsx:1-12,84-87,843-851`
- Modify: `firestore.rules.test.ts:1203-1265`

**Interfaces:**
- Consumes: `createUserLocationGeohashPersister`.
- Production writer: `setDoc(doc(db, 'userLocations', uid), { lastGeohash, lastGeohashUpdatedAt: serverTimestamp() }, { merge: true })`.

- [ ] Add emulator tests proving merge-upsert creates a missing canonical document, updates an existing document without losing either required field, concurrent valid first writes succeed, wrong-owner/extra-field writes fail, and distinct old/new UIDs remain isolated.
- [ ] Run `npm.cmd run test:rules` and verify the missing-document production path is not yet wired even though Rules permit the intended shape.
- [ ] Replace the inline `updateDoc` path with one map-session persister; pass `allowLocationTrackingRef.current`, `auth.currentUser?.uid`, `userRef.current?.id`, and the computed geohash.
- [ ] Keep genuine Firestore errors visible as `Failed to persist lastGeohash`; do not translate permission failures into missing-document noise.
- [ ] Rerun focused unit and emulator Rules suites.

### Task 3: Verification and Review Handoff

**Files:**
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: the verified implementation.
- Produces: a clean, pushed feature branch ready for protected PR review.

- [ ] Run TypeScript, unit, Rules, Functions integration, Functions syntax, and production build gates.
- [ ] Run all three configured Gitleaks scopes.
- [ ] Record an emulator-backed missing-document create followed by an existing-document merge update with no `No document to update` error.
- [ ] Update `HANDOFF.md` with root cause, schema, totals, warnings, and no-deployment status.
- [ ] Review the complete base diff, stage only milestone files, commit, push, and verify local/remote SHA equality and a clean worktree.
