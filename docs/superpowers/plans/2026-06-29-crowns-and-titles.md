# Crowns & Titles System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder reputation/streak/tier system with a Crowns-based progression where users earn crowns for successful parking handoffs and unlock titles at defined thresholds.

**Architecture:** A shared `utils/crowns.ts` utility provides the title lookup function. A new Cloud Function `awardCrowns` triggers on `spotFeedback` creation with `outcome: 'success'` and increments both users' crowns server-side using `FieldValue.increment`. The user profile is redesigned to show username, title, and crown count. Title unlock detection happens client-side by comparing the user's title before/after an `onSnapshot` update.

**Tech Stack:** React, Firestore, Cloud Functions (firebase-functions v5, v2 API), firebase-admin `FieldValue.increment`.

## Global Constraints

- Firebase SDK **10.8.0** (client), firebase-admin **12.0.0** (functions)
- No new npm dependencies
- Crown values: driver gets +1, finder gets +2 on successful handoff
- Crowns are awarded server-side only (Cloud Function), never client-side
- Title is stored on user doc alongside crowns (recomputed on every crown update)
- Don't show "👑 0 Crowns" for Newcomers — show title only until first crown earned
- Deploy with `--project parkqueen-46475363-ccf36`

## Title Thresholds

| Crowns | Title |
|-----:|---|
| 0 | Newcomer |
| 10 | Trusted Driver |
| 50 | Street Scout |
| 150 | Neighborhood Guide |
| 400 | Parking Expert |
| 750 | Block Captain |
| 1,500 | Parking Veteran |
| 3,000 | Urban Legend |

---

### Task 1: Create Crowns Utility

**Files:**
- Create: `utils/crowns.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `TITLE_THRESHOLDS: { crowns: number; title: string }[]` — sorted ascending
  - `getTitleForCrowns(crowns: number): string` — returns the highest title the user qualifies for
  - `getNextTitle(crowns: number): { title: string; crownsNeeded: number } | null` — returns next title and crowns remaining, or null if at max

- [ ] **Step 1: Create utils/crowns.ts**

```typescript
export const TITLE_THRESHOLDS = [
    { crowns: 0, title: 'Newcomer' },
    { crowns: 10, title: 'Trusted Driver' },
    { crowns: 50, title: 'Street Scout' },
    { crowns: 150, title: 'Neighborhood Guide' },
    { crowns: 400, title: 'Parking Expert' },
    { crowns: 750, title: 'Block Captain' },
    { crowns: 1500, title: 'Parking Veteran' },
    { crowns: 3000, title: 'Urban Legend' },
];

export function getTitleForCrowns(crowns: number): string {
    for (let i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (crowns >= TITLE_THRESHOLDS[i].crowns) return TITLE_THRESHOLDS[i].title;
    }
    return 'Newcomer';
}

export function getNextTitle(crowns: number): { title: string; crownsNeeded: number } | null {
    for (const t of TITLE_THRESHOLDS) {
        if (crowns < t.crowns) return { title: t.title, crownsNeeded: t.crowns - crowns };
    }
    return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add utils/crowns.ts
git commit -m "feat: add crowns utility with title thresholds and lookup

Pure functions for title progression: getTitleForCrowns and getNextTitle.
Eight titles from Newcomer (0) to Urban Legend (3000).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Add awardCrowns Cloud Function

**Files:**
- Modify: `functions/index.js`

**Interfaces:**
- Consumes: `spotFeedback` document creation with `outcome: 'success'`, `userId`, `finderId`
- Produces: Increments `crowns` on both users, recomputes `title` on both users

- [ ] **Step 1: Add title thresholds and lookup to functions/index.js**

Add after the existing constants (around line 15, after the `db` declaration):

```javascript
// Crown title thresholds (must match client-side utils/crowns.ts)
const TITLE_THRESHOLDS = [
    { crowns: 0, title: 'Newcomer' },
    { crowns: 10, title: 'Trusted Driver' },
    { crowns: 50, title: 'Street Scout' },
    { crowns: 150, title: 'Neighborhood Guide' },
    { crowns: 400, title: 'Parking Expert' },
    { crowns: 750, title: 'Block Captain' },
    { crowns: 1500, title: 'Parking Veteran' },
    { crowns: 3000, title: 'Urban Legend' },
];

function getTitleForCrowns(crowns) {
    for (let i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (crowns >= TITLE_THRESHOLDS[i].crowns) return TITLE_THRESHOLDS[i].title;
    }
    return 'Newcomer';
}
```

- [ ] **Step 2: Add the awardCrowns Cloud Function**

Add after the existing Cloud Functions (at the end of the file):

```javascript
// 10) Award crowns on successful parking handoff
exports.awardCrowns = onDocumentCreated(
  {
    document: "spotFeedback/{feedbackId}",
    region: "us-central1",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.outcome !== 'success') return;

    const driverId = data.userId;
    const finderId = data.finderId;
    if (!driverId || !finderId || driverId === finderId) return;

    const batch = db.batch();

    // Award driver +1 crown
    const driverRef = db.doc(`users/${driverId}`);
    const driverSnap = await driverRef.get();
    const driverCrowns = (driverSnap.data()?.crowns || 0) + 1;
    batch.update(driverRef, {
        crowns: FieldValue.increment(1),
        title: getTitleForCrowns(driverCrowns),
    });

    // Award finder +2 crowns
    const finderRef = db.doc(`users/${finderId}`);
    const finderSnap = await finderRef.get();
    const finderCrowns = (finderSnap.data()?.crowns || 0) + 2;
    batch.update(finderRef, {
        crowns: FieldValue.increment(2),
        title: getTitleForCrowns(finderCrowns),
    });

    await batch.commit();
    console.log(`Crowns awarded: driver ${driverId} +1 (${driverCrowns}), finder ${finderId} +2 (${finderCrowns})`);
  }
);
```

- [ ] **Step 3: Commit**

```bash
git add functions/index.js
git commit -m "feat: add awardCrowns Cloud Function for handoff rewards

Triggers on spotFeedback creation with outcome 'success'. Awards driver
+1 crown and finder +2 crowns. Recomputes title for both users. Uses
batch write for atomicity.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Update User Profile Schema

**Files:**
- Modify: `database.ts`

**Interfaces:**
- Consumes: nothing
- Produces: New user documents created with `crowns: 0` and `title: 'Newcomer'` instead of `reputationScore`, `currentStreak`, `tier`

- [ ] **Step 1: Update saveUserProfile defaults**

In `database.ts`, find the `saveUserProfile` function where `reputationScore`, `currentStreak`, and `tier` are set. Replace those three fields:

Replace:
```typescript
    reputationScore: 0,
    currentStreak: 0,
    tier: 'Newcomer',
```

With:
```typescript
    crowns: 0,
    title: 'Newcomer',
```

- [ ] **Step 2: Commit**

```bash
git add database.ts
git commit -m "feat: replace reputationScore/streak/tier with crowns/title

New user documents now initialize with crowns: 0 and title: 'Newcomer'.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Redesign Profile Header with Crowns

**Files:**
- Modify: `views/ProfileView.tsx`

**Interfaces:**
- Consumes: `user.crowns`, `user.title` from Firestore user document
- Produces: Redesigned profile header showing username → title → crown count

- [ ] **Step 1: Replace the username + email section and gamification stats**

Replace lines 101-147 (from `<h2>` username through the end of the gamification stats grid) with:

```tsx
            <h2 className="text-xl font-extrabold text-[var(--color-text)]">{user.username || user.fullName || "User"}</h2>
            {user.username?.startsWith('user_') && (
              <button onClick={() => setView(AppView.EDIT_PROFILE)} className="text-[#1e75ff] text-xs font-semibold mt-1 underline" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                Complete your profile
              </button>
            )}
            <p className="text-sm font-semibold text-[#38bdf8] mt-1">{user.title || 'Newcomer'}</p>
            {(user.crowns || 0) > 0 && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">👑 {user.crowns} Crown{user.crowns !== 1 ? 's' : ''}</p>
            )}
            {uploadStatus && (
              <p className={`text-xs mt-2 font-semibold ${uploadStatus.includes('couldn') ? 'text-red-400' : 'text-blue-400'}`}>{uploadStatus}</p>
            )}
          </div>
```

- [ ] **Step 2: Remove the old gamification stats grid entirely**

Delete the entire `{/* Gamification Stats */}` section (the `grid grid-cols-3` div with Reputation, Streak, and Tier).

- [ ] **Step 3: Clean up unused imports**

Remove `Trophy`, `Flame`, and `Star` from the lucide-react import if they're no longer used elsewhere in the file. Check first — `Star` might be used in the stats section only.

Search for `Trophy`, `Flame`, `Star` usage in ProfileView.tsx. If only used in the deleted stats grid, remove from import.

- [ ] **Step 4: Remove the email display line**

The old code had `<p className="text-xs...">{user.email || ""}</p>` after the username. This is replaced by the title display. Make sure it's not duplicated.

- [ ] **Step 5: Commit**

```bash
git add views/ProfileView.tsx
git commit -m "feat: redesign profile header with crowns and title

Shows username → title (e.g. 'Neighborhood Guide') → crown count.
Removes old reputation/streak/tier stats grid. Crown count hidden
when zero (Newcomers see title only).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Title Unlock Celebration

**Files:**
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `user.title` from the `onSnapshot` listener on the user document
- Produces: A celebration toast when the user's title changes

- [ ] **Step 1: Find the user onSnapshot listener in App.tsx**

Search for the `onSnapshot` that watches the user document and sets `user` state.

- [ ] **Step 2: Add title change detection**

Add a `useRef` to track the previous title. Inside the `onSnapshot` callback, after setting the user state, compare old title to new title. If different and the new title is not 'Newcomer' (skip initial load), show a celebration.

Add state and ref:
```typescript
const [titleUnlock, setTitleUnlock] = useState<string | null>(null);
const prevTitleRef = useRef<string | null>(null);
```

Inside the `onSnapshot` callback, after the user data is processed:
```typescript
const newTitle = userData.title || 'Newcomer';
if (prevTitleRef.current && prevTitleRef.current !== newTitle && newTitle !== 'Newcomer') {
    setTitleUnlock(newTitle);
    setTimeout(() => setTitleUnlock(null), 5000);
}
prevTitleRef.current = newTitle;
```

- [ ] **Step 3: Add the celebration UI**

Add a celebration overlay in the JSX (near the existing push notification toast):

```tsx
{titleUnlock && (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-glass)] backdrop-blur-xl border border-yellow-500/30 rounded-2xl px-6 py-4 shadow-2xl text-center pointer-events-none">
        <div className="text-3xl mb-1">👑</div>
        <p className="text-sm font-bold text-[var(--color-text)]">New Title Unlocked!</p>
        <p className="text-base font-extrabold text-yellow-400 mt-0.5">{titleUnlock}</p>
    </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: add title unlock celebration toast

Detects title changes via onSnapshot and shows a 5-second crown
celebration overlay when a user earns a new title.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Build, Deploy, Update HANDOFF.md

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Build**

```bash
npm run build
```

- [ ] **Step 2: Deploy everything (hosting + functions + rules)**

```bash
npm run build && firebase deploy --project parkqueen-46475363-ccf36
```

- [ ] **Step 3: Update HANDOFF.md**

In Section 3 (Features Already Implemented), add:

```markdown
### Crowns & Titles
- **Crowns** replace the old reputation/streak/tier system — earned by contributing to the community
- **Crown values:** driver gets +1 on successful park, finder gets +2 for helping
- **Awarded server-side** via `awardCrowns` Cloud Function triggered on `spotFeedback` creation with `outcome: 'success'`
- **Title progression:** Newcomer (0) → Trusted Driver (10) → Street Scout (50) → Neighborhood Guide (150) → Parking Expert (400) → Block Captain (750) → Parking Veteran (1500) → Urban Legend (3000)
- **Profile header** shows username → title → crown count (crowns hidden at zero)
- **Title unlock celebration** — toast notification when user earns a new title
- **Title thresholds** defined in `utils/crowns.ts` (client) and `functions/index.js` (server) — must stay in sync
```

In the Important Files table, add:

```markdown
| `utils/crowns.ts` | Title thresholds and lookup functions (getTitleForCrowns, getNextTitle) |
```

- [ ] **Step 4: Commit HANDOFF.md**

```bash
git add HANDOFF.md
git commit -m "docs: add Crowns & Titles system to HANDOFF.md

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 5: Manual test plan**

1. **Profile display:** Open Profile → verify username, title ("Newcomer"), no crown count shown (0 crowns)
2. **Crown awarding:** Complete a successful parking handoff (two browser sessions) → driver confirms "Yes" → verify both users' crown counts increment in Firestore
3. **Title display:** Manually set a user's crowns to 10 in Firestore console → verify Profile shows "Trusted Driver" title and "👑 10 Crowns"
4. **Title unlock:** Change a user's crowns from 9 to 10 → verify the celebration toast appears with "Trusted Driver"
5. **Zero crowns:** Verify a user with 0 crowns sees "Newcomer" title only, no crown count
