# Parking Handoff Completion Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the post-arrival feedback prompt with a structured outcome confirmation flow (Yes/No → celebration + optional departure ping or failure reason), and notify the finder on successful handoffs.

**Architecture:** The existing `useInterestFlow` hook gains new state (`handoffStep`) to drive a multi-screen flow inside the existing BottomSheet. A new `HandoffFlow.tsx` component renders the three screens (outcome question, celebration + departure picker, failure reason). Departure pings are new spot documents with an `originSpotId` link — the rest of the system treats them as normal yellow pings. Finder recognition uses the existing `spotNotifications` collection with a new `handoff_success` type.

**Tech Stack:** React, Firestore, geofire-common (geohash generation), existing BottomSheet component.

## Global Constraints

- Firebase SDK **10.8.0** — all imports must resolve to this version
- No new npm dependencies
- No community points display (hold until points economy exists)
- No reputation impact from failure reasons in v1
- Departure pings are new spot documents, not mutations of the original
- `originSpotId` is for analytics only, not runtime logic
- Deploy with `--project parkqueen-46475363-ccf36`

---

### Task 1: Extend useInterestFlow with Handoff State

**Files:**
- Modify: `views/street-parking/useInterestFlow.ts`

**Interfaces:**
- Consumes: existing `useInterestFlow` options and return value
- Produces:
  - `handoffStep: 'outcome' | 'celebration' | 'failure_reason' | null` — new state exposed in return
  - `handoffSpotRef: { id, lat, lng, address, finderId, finderName, geohash } | null` — snapshot of spot data captured at arrival time
  - `handleArrival()` — modified to set `handoffStep = 'outcome'` and capture spot snapshot
  - `handleHandoffOutcome(outcome: 'success' | 'failed')` — new function, writes spotFeedback, notifies finder on success, advances to next screen
  - `handleFailureReason(reason: string)` — new function, updates spotFeedback with reason, dismisses flow
  - `handleDeparturePing(durationMinutes: number)` — new function, creates new spot doc with `originSpotId`
  - `handleSkipDeparture()` — new function, dismisses flow
  - `showFeedback` — removed from return value (replaced by `handoffStep`)

- [ ] **Step 1: Add handoff state and spot snapshot**

Add new state variables and a ref for the spot snapshot. Modify `handleArrival` to capture spot data before setting status to occupied.

In `useInterestFlow.ts`, add after the existing state declarations (line 31):

```typescript
const [handoffStep, setHandoffStep] = useState<'outcome' | 'celebration' | 'failure_reason' | null>(null);
const handoffSpotRef = useRef<{
    id: string; lat: number; lng: number; address?: string;
    finderId: string; finderName: string; geohash?: string;
} | null>(null);
```

Add `useRef` to the React import on line 1:

```typescript
import { useState, useEffect, useRef } from 'react';
```

- [ ] **Step 2: Modify handleArrival to capture spot snapshot and start handoff flow**

Replace the existing `handleArrival` (lines 182-189):

```typescript
const handleArrival = async () => {
    if (!selectedItem || !user || !db) return;
    // Capture spot data before marking occupied
    handoffSpotRef.current = {
        id: selectedItem.id,
        lat: selectedItem.lat,
        lng: selectedItem.lng,
        address: selectedItem.title || selectedItem.address,
        finderId: selectedItem.finderId,
        finderName: selectedItem.finderName,
        geohash: selectedItem.geohash,
    };
    await updateDoc(doc(db, 'spots', selectedItem.id), { status: 'occupied' });
    setTrackedItemId(null);
    activeRouteDestinationRef.current = null;
    if (mapRef.current) clearRoute(mapRef.current);
    setHandoffStep('outcome');
};
```

- [ ] **Step 3: Add handleHandoffOutcome**

Add after `handleArrival`:

```typescript
const handleHandoffOutcome = async (outcome: 'success' | 'failed') => {
    const spotSnap = handoffSpotRef.current;
    if (!spotSnap || !user) return;

    await addDoc(collection(db, 'spotFeedback'), {
        spotId: spotSnap.id,
        userId: user.id,
        finderId: spotSnap.finderId,
        outcome,
        failureReason: null,
        createdAt: Timestamp.now(),
    });

    if (outcome === 'success') {
        // Notify finder
        await addDoc(collection(db, 'spotNotifications'), {
            targetUserId: spotSnap.finderId,
            type: 'handoff_success',
            message: 'Your parking ping helped another driver find parking!',
            createdAt: Timestamp.now(),
        });
        setHandoffStep('celebration');
    } else {
        setHandoffStep('failure_reason');
    }
};
```

- [ ] **Step 4: Add handleFailureReason**

```typescript
const handleFailureReason = async (reason: string) => {
    const spotSnap = handoffSpotRef.current;
    if (!spotSnap || !user) return;

    // Update the most recent feedback doc for this spot+user
    const q = query(
        collection(db, 'spotFeedback'),
        where('spotId', '==', spotSnap.id),
        where('userId', '==', user.id),
        orderBy('createdAt', 'desc'),
        limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { failureReason: reason });
    }

    setHandoffStep(null);
    handoffSpotRef.current = null;
    setSelectedItem(null);
};
```

Note: This requires updating `firestore.rules` for `spotFeedback` to allow reads by the creator. Currently `allow read: if false`. We'll handle this in Task 4.

- [ ] **Step 5: Add handleDeparturePing and handleSkipDeparture**

```typescript
const handleDeparturePing = async (durationMinutes: number) => {
    const spotSnap = handoffSpotRef.current;
    if (!spotSnap || !user) return;

    const now = Date.now();
    const reportedAt = Timestamp.fromMillis(now + durationMinutes * 60000);
    const expiresAt = Timestamp.fromMillis(now + durationMinutes * 60000 + 3600000); // +1hr after departure

    await addDoc(collection(db, 'spots'), {
        lat: spotSnap.lat,
        lng: spotSnap.lng,
        type: 'free',
        status: 'available',
        finderId: user.id,
        finderName: user.username || user.fullName || 'Anonymous',
        pingMode: 'later',
        reportedAt,
        expiresAt,
        geohash: spotSnap.geohash || '',
        address: spotSnap.address || '',
        originSpotId: spotSnap.id,
    });

    setHandoffStep(null);
    handoffSpotRef.current = null;
    setSelectedItem(null);
};

const handleSkipDeparture = () => {
    setHandoffStep(null);
    handoffSpotRef.current = null;
    setSelectedItem(null);
};
```

- [ ] **Step 6: Update the return object**

Replace `showFeedback` with the new handoff values. Update the return block (lines 204-223):

```typescript
return {
    trackedItemId,
    isEtaPickerOpen,
    setIsEtaPickerOpen,
    interestError,
    setInterestError,
    handoffStep,
    finderToast,
    driverNotification,
    handleExpressInterest,
    handleCancelByFinder,
    handleCancelByClaimer,
    handleDelayByFinder,
    handleArrival,
    handleHandoffOutcome,
    handleFailureReason,
    handleDeparturePing,
    handleSkipDeparture,
    getEstDriveMinutes,
    isWithinArrivalRange,
    ETA_OPTIONS,
    MAX_ETA_MINUTES,
};
```

- [ ] **Step 7: Update the notification listener to handle handoff_success**

In the `onSnapshot` listener (lines 42-57), add handling for the `handoff_success` type. Inside the `snap.docChanges().forEach` callback, after the existing `if (data.type === 'cancelled')` block:

```typescript
if (data.type === 'handoff_success') {
    setFinderToast(data.message);
    setTimeout(() => setFinderToast(null), 6000);
}
```

- [ ] **Step 8: Commit**

```bash
git add views/street-parking/useInterestFlow.ts
git commit -m "feat: add handoff completion state machine to useInterestFlow

Replaces showFeedback boolean with handoffStep state ('outcome', 'celebration',
'failure_reason'). Captures spot snapshot at arrival time. Adds handlers for
outcome confirmation, failure reasons, departure pings (new spot docs with
originSpotId), and finder notification via spotNotifications.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Create HandoffFlow Component

**Files:**
- Create: `views/street-parking/HandoffFlow.tsx`

**Interfaces:**
- Consumes:
  - `handoffStep: 'outcome' | 'celebration' | 'failure_reason' | null`
  - `onOutcome: (outcome: 'success' | 'failed') => void`
  - `onFailureReason: (reason: string) => void`
  - `onDeparturePing: (durationMinutes: number) => void`
  - `onSkip: () => void`
- Produces: A React component rendering three screens inside BottomSheet content area

- [ ] **Step 1: Create HandoffFlow.tsx**

```tsx
import React, { useState } from 'react';

const FAILURE_REASONS = [
    'Someone else got the spot',
    'Finder hadn\'t left yet',
    'Couldn\'t find the location',
    'Other',
];

const DURATION_OPTIONS = [
    { label: '30 min', minutes: 30 },
    { label: '1 hr', minutes: 60 },
    { label: '2 hr', minutes: 120 },
    { label: '4 hr', minutes: 240 },
];

interface HandoffFlowProps {
    step: 'outcome' | 'celebration' | 'failure_reason';
    onOutcome: (outcome: 'success' | 'failed') => void;
    onFailureReason: (reason: string) => void;
    onDeparturePing: (durationMinutes: number) => void;
    onSkip: () => void;
}

export const HandoffFlow: React.FC<HandoffFlowProps> = ({
    step, onOutcome, onFailureReason, onDeparturePing, onSkip,
}) => {
    const [submitted, setSubmitted] = useState(false);

    if (step === 'outcome') {
        return (
            <div className="text-center">
                <div className="text-4xl mb-3">🅿️</div>
                <h3 className="font-bold text-lg text-[var(--color-text)] mb-1">Were you able to park?</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mb-5">Let us know how it went</p>
                <div className="flex gap-3">
                    <button
                        onClick={() => { if (!submitted) { setSubmitted(true); onOutcome('success'); } }}
                        disabled={submitted}
                        className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}
                    >
                        Yes
                    </button>
                    <button
                        onClick={() => { if (!submitted) { setSubmitted(true); onOutcome('failed'); } }}
                        disabled={submitted}
                        className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-[var(--color-border)] hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)] disabled:opacity-50"
                    >
                        No
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'celebration') {
        return (
            <div className="text-center">
                <div className="text-5xl mb-3">🎉</div>
                <h3 className="font-bold text-lg text-[var(--color-text)] mb-1">You parked!</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mb-5">Know when you'll be leaving?</p>
                <p className="text-[10px] text-[var(--color-text-secondary)] mb-3">Help the next driver find this spot</p>
                <div className="grid grid-cols-4 gap-2 mb-3">
                    {DURATION_OPTIONS.map(opt => (
                        <button
                            key={opt.minutes}
                            onClick={() => onDeparturePing(opt.minutes)}
                            className="py-2.5 rounded-xl text-xs font-semibold bg-white/5 border border-[var(--color-border)] hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)]"
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={onSkip}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold bg-white/5 border border-[var(--color-border)] hover:bg-white/10 transition-all text-[var(--color-text-secondary)]"
                >
                    Skip
                </button>
            </div>
        );
    }

    if (step === 'failure_reason') {
        return (
            <div className="text-center">
                <h3 className="font-bold text-lg text-[var(--color-text)] mb-1">What happened?</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mb-4">This helps us improve the experience</p>
                <div className="space-y-2">
                    {FAILURE_REASONS.map(reason => (
                        <button
                            key={reason}
                            onClick={() => onFailureReason(reason)}
                            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-[var(--color-border)] hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)]"
                        >
                            {reason}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return null;
};
```

- [ ] **Step 2: Commit**

```bash
git add views/street-parking/HandoffFlow.tsx
git commit -m "feat: add HandoffFlow component for post-arrival screens

Three screens: outcome question (Yes/No), celebration with departure duration
picker (30min/1hr/2hr/4hr + Skip), and failure reason picker. Buttons debounced
via submitted state.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Integrate HandoffFlow into StreetParkingView

**Files:**
- Modify: `views/StreetParkingView.tsx`

**Interfaces:**
- Consumes: `HandoffFlow` component, updated `useInterestFlow` return values
- Produces: Replaces old feedback BottomSheet with new HandoffFlow BottomSheet

- [ ] **Step 1: Add HandoffFlow import**

At the top of `StreetParkingView.tsx`, add to imports:

```typescript
import { HandoffFlow } from './street-parking/HandoffFlow';
```

- [ ] **Step 2: Replace the feedback BottomSheet**

Replace lines 517-534 (the `{/* Post-arrival feedback */}` block) with:

```tsx
{/* Post-arrival handoff flow */}
<BottomSheet isOpen={interestFlow.handoffStep !== null} onClose={interestFlow.handleSkipDeparture}>
    {interestFlow.handoffStep && (
        <HandoffFlow
            step={interestFlow.handoffStep}
            onOutcome={interestFlow.handleHandoffOutcome}
            onFailureReason={interestFlow.handleFailureReason}
            onDeparturePing={interestFlow.handleDeparturePing}
            onSkip={interestFlow.handleSkipDeparture}
        />
    )}
</BottomSheet>
```

- [ ] **Step 3: Update the selectedItem sync useEffect**

Find the useEffect that guards `selectedItem` clearing (around line 128). Change `interestFlow.showFeedback` to `interestFlow.handoffStep`:

```typescript
if (!interestFlow.handoffStep) {
    setSelectedItem(null);
}
```

- [ ] **Step 4: Remove the old Check import if unused**

Check if `Check` from lucide-react is still used elsewhere in StreetParkingView. If the feedback BottomSheet was the only user, remove it from the import.

Search for other uses of `<Check` in the file. If none, update the lucide import to remove `Check`.

- [ ] **Step 5: Commit**

```bash
git add views/StreetParkingView.tsx
git commit -m "feat: integrate HandoffFlow into StreetParkingView

Replaces old post-arrival feedback BottomSheet with new HandoffFlow component.
Updates selectedItem sync guard to use handoffStep instead of showFeedback.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Update Firestore Rules and Types (must deploy before Task 1's failure reason flow works)

**Files:**
- Modify: `firestore.rules`
- Modify: `types.ts`
- Modify: `views/street-parking/types.ts`

**Interfaces:**
- Consumes: nothing
- Produces: Updated security rules allowing spotFeedback reads by creator; `originSpotId` field on StreetSpot and MapItem

- [ ] **Step 1: Update spotFeedback rules**

In `firestore.rules`, replace the `spotFeedback` block (lines 64-66):

```
match /spotFeedback/{feedbackId} {
    allow create: if signedIn();
    allow read: if signedIn() && resource.data.userId == request.auth.uid;
    allow update: if signedIn() && resource.data.userId == request.auth.uid;
}
```

This allows the creator to read and update their own feedback docs (needed by `handleFailureReason` which queries then updates).

- [ ] **Step 2: Add originSpotId to StreetSpot interface**

In `types.ts`, add to the `StreetSpot` interface after `interestExpiresAt`:

```typescript
originSpotId?: string | null;
```

- [ ] **Step 3: Add originSpotId and address to MapItem interface**

In `views/street-parking/types.ts`, add to the `MapItem` interface after `interestExpiresAt`:

```typescript
address?: string;
originSpotId?: string | null;
geohash?: string;
```

- [ ] **Step 4: Commit**

```bash
git add firestore.rules types.ts views/street-parking/types.ts
git commit -m "feat: update Firestore rules and types for handoff flow

Allow spotFeedback reads/updates by creator (needed for failure reason flow).
Add originSpotId to StreetSpot and MapItem interfaces. Add address and geohash
to MapItem for departure ping creation.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Finder Celebration Toast

**Files:**
- Modify: `views/StreetParkingView.tsx`

**Interfaces:**
- Consumes: `interestFlow.finderToast` (already exists, now receives `handoff_success` messages)
- Produces: Enhanced finder toast with celebration styling for handoff_success

- [ ] **Step 1: Locate the existing finderToast rendering**

Search for `finderToast` rendering in StreetParkingView. It should be a simple text toast.

- [ ] **Step 2: Verify the existing toast works for handoff_success messages**

The `finderToast` state is already set by the notification listener in `useInterestFlow` (Task 1, Step 7). The existing toast rendering in StreetParkingView should display "Your parking ping helped another driver find parking!" when a `handoff_success` notification arrives. If the existing toast rendering is just a simple text display, it may need enhanced styling.

Find the finderToast rendering and check if it needs a celebration style. If it's a basic toast, update it to show a party emoji prefix for handoff success messages:

```tsx
{interestFlow.finderToast && (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-glass)] border border-[var(--color-border)] backdrop-blur-xl rounded-2xl px-5 py-3 shadow-2xl text-center pointer-events-none">
        <p className="text-sm font-semibold text-[var(--color-text)]">{interestFlow.finderToast}</p>
    </div>
)}
```

The message text already contains the celebration wording ("Your parking ping helped another driver find parking!"). The `finderToast` auto-dismisses after 6 seconds (set in Task 1, Step 7).

- [ ] **Step 3: Commit**

```bash
git add views/StreetParkingView.tsx
git commit -m "feat: finder celebration toast for successful handoffs

Finder sees 'Your parking ping helped another driver find parking!' when a
driver confirms they parked successfully. Uses existing finderToast mechanism
with spotNotifications listener.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Ensure MapItem Includes Required Fields from Firestore

**Files:**
- Modify: `views/street-parking/useSpotData.ts`

**Interfaces:**
- Consumes: Firestore spot documents
- Produces: MapItem objects now include `address`, `geohash`, and `originSpotId` fields

- [ ] **Step 1: Check how MapItem objects are constructed from Firestore data**

Read `useSpotData.ts` and find where spot documents are mapped to `MapItem` objects. Ensure `address`, `geohash`, and `originSpotId` are included in the mapping.

- [ ] **Step 2: Add missing fields to the MapItem construction**

In the spot document → MapItem mapping, add:

```typescript
address: d.address || '',
geohash: d.geohash || '',
originSpotId: d.originSpotId || null,
```

- [ ] **Step 3: Commit**

```bash
git add views/street-parking/useSpotData.ts
git commit -m "feat: include address, geohash, originSpotId in MapItem mapping

Ensures spot data from Firestore is available for the departure ping flow
which needs the original spot's address and geohash.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 7: End-to-End Verification

**Files:** None modified — verification only.

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: Clean build with no TypeScript errors.

- [ ] **Step 2: Verify no references to removed showFeedback**

Search for `showFeedback` across the codebase. It should not appear in any active code (only in git history).

```bash
grep -r "showFeedback" --include="*.ts" --include="*.tsx" .
```

Expected: No results.

- [ ] **Step 3: Verify no references to old handleFeedback**

```bash
grep -r "handleFeedback" --include="*.ts" --include="*.tsx" .
```

Expected: No results (replaced by `handleHandoffOutcome`, `handleFailureReason`).

- [ ] **Step 4: Deploy**

```bash
npm run build && firebase deploy --project parkqueen-46475363-ccf36
```

- [ ] **Step 5: Manual test plan**

Test in the deployed app with two browser sessions (one incognito):

1. **Happy path:** User A pings → User B claims → User B taps "I've arrived" → sees "Were you able to park?" → taps Yes → sees celebration + duration picker → taps "1 hr" → new yellow pin appears on map → User A sees finder toast
2. **Skip path:** Same as above but tap "Skip" instead of a duration → flow dismisses, no new ping created
3. **Failure path:** User B taps "No" → sees reason picker → taps "Someone else got the spot" → sees brief acknowledgment → flow dismisses
4. **BottomSheet dismiss:** Drag down or tap backdrop during any handoff step → flow dismisses cleanly
5. **Verify departure ping:** The yellow pin from step 1 should have correct address (same as original spot), correct departure time (now + 1hr), and should trigger push notifications to nearby users

- [ ] **Step 6: Commit any fixes from testing**

If any issues found during testing, fix and commit.
