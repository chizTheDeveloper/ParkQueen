# Profile UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the Profile screen to match the Modern Dark (Cinema Mobile) design system — SVG icons throughout, identity hero card, consistent section headers, minimum 12px text, spring press feedback, crown glow, and tighter crown/progress grouping.

**Architecture:** All changes are contained in `views/ProfileView.tsx`. No new files, no new dependencies — Lucide icons are already installed and used elsewhere in the codebase. CSS `active:scale` handles press feedback (web, no Reanimated needed). Emojis are replaced with Lucide SVG icons in colored containers matching the existing General Details pattern.

**Tech Stack:** React, Tailwind CSS, Lucide React, Firebase Firestore (unchanged), CSS custom properties for theming.

## Global Constraints

- Branch: `profile-ui-polish` — do NOT merge or deploy until user approves via localhost test
- No new npm packages — Lucide (`lucide-react`) is already installed
- Keep all existing logic (Firestore queries, upload handler, crown math) exactly as-is — UI only
- Preserve `var(--color-*)` CSS custom properties throughout — no hardcoded hex values except existing brand blues `#1e75ff` and `#38bdf8`
- Minimum text size: `text-xs` (12px) — no `text-[10px]` anywhere
- All tappable elements must have `active:scale-[0.97] transition-transform duration-150` press feedback
- Section header pattern: label sits INSIDE each card as a top row, not as a floating `<h3>` above the card

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `views/ProfileView.tsx` | Modify | All UI changes — identity card, icon replacements, section headers, text sizes, press feedback |

---

### Task 1: Identity Hero Card

Wrap the floating center-aligned identity block in a card container. The avatar overlaps the top edge. Title gets its own prominent line. Crown count gets a subtle glow.

**Files:**
- Modify: `views/ProfileView.tsx` — identity section (lines ~122–200)

**Interfaces:**
- Consumes: `user.avatarUrl`, `user.username`, `user.fullName`, `user.title`, `user.createdAt`, `user.crowns`, `getNextTitle(crowns)`
- Produces: identity card DOM structure used as-is by Tasks 2–7

- [ ] **Step 1: Replace the identity section**

Replace the entire `{/* User Info & Avatar */}` block (from `<div className="flex flex-col items-center text-center mb-6">` to its closing `</div>`) with:

```tsx
{/* Identity Hero Card */}
<div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-visible mb-4 pt-0">
  {/* Avatar — overlaps top of card */}
  <div className="flex flex-col items-center pt-5 pb-4 px-4">
    <div className="relative mb-3">
      <div className="w-[108px] h-[108px] rounded-full border-4 border-[#1e75ff] overflow-hidden shrink-0 relative bg-[var(--color-card)] flex items-center justify-center text-[var(--color-text-secondary)] shadow-lg shadow-[#1e75ff]/20">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <i className="fa-solid fa-user text-4xl"></i>
        )}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center animate-pulse">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
      </div>
      <button
        onClick={triggerUpload}
        className="absolute bottom-1 right-1 w-[31px] h-[31px] rounded-full bg-[#1e75ff] border-2 border-[var(--color-bg)] flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 active:scale-95 transition-all shadow-md"
        aria-label="Upload photo"
      >
        <Edit size={14} />
      </button>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
    </div>

    {/* Username */}
    <h2 className="text-xl font-extrabold text-[var(--color-text)]">{user.username || user.fullName || "User"}</h2>

    {user.username?.startsWith('user_') && (
      <button
        onClick={() => setView(AppView.EDIT_PROFILE)}
        className="mt-1.5 px-3 py-1 rounded-full bg-[#1e75ff]/15 border border-[#1e75ff]/30 text-[#38bdf8] text-[11px] font-semibold active:scale-95 transition-transform"
      >
        Complete your profile
      </button>
    )}

    {/* Title + Joined */}
    <div className="mt-2 flex items-center gap-1.5 flex-wrap justify-center">
      <span className="text-sm font-bold text-[#38bdf8]">{user.title || 'Newcomer'}</span>
      {(() => {
        const ts = user.createdAt;
        if (!ts) return null;
        const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
        return <span className="text-xs text-[var(--color-text-secondary)]">· Joined {d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>;
      })()}
    </div>

    {/* Crown count with glow */}
    <div className="mt-3 flex items-center gap-1.5">
      <Crown size={16} className="text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]" />
      <span
        className="text-base font-bold text-[var(--color-text)]"
        style={{ textShadow: '0 0 12px rgba(250,204,21,0.25)' }}
      >
        {user.crowns || 0} Crown{(user.crowns || 0) !== 1 ? 's' : ''}
      </span>
    </div>

    {/* Motivational text */}
    <p className="text-xs text-[var(--color-text-secondary)] mt-1 text-center">
      {(user.crowns || 0) === 0
        ? 'Ping a parking spot to earn your first Crowns.'
        : (user.crowns || 0) < 10
        ? 'Help another driver to become a Trusted Driver.'
        : (user.crowns || 0) < 50
        ? 'Keep helping your community.'
        : 'You\'re making a real difference for drivers.'}
    </p>

    {/* Progress bar */}
    {(() => {
      const crowns = user.crowns || 0;
      const next = getNextTitle(crowns);
      if (!next) return null;
      const prevThreshold = (() => {
        const thresholds = [0, 10, 50, 150, 400, 750, 1500, 3000];
        for (let i = thresholds.length - 1; i >= 0; i--) {
          if (crowns >= thresholds[i]) return thresholds[i];
        }
        return 0;
      })();
      const nextThreshold = crowns + next.crownsNeeded;
      const range = nextThreshold - prevThreshold;
      const progress = range > 0 ? ((crowns - prevThreshold) / range) * 100 : 0;
      return (
        <div className="w-full max-w-[220px] mt-3">
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#1e75ff] to-[#38bdf8] rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 text-center">
            {next.crownsNeeded} Crown{next.crownsNeeded !== 1 ? 's' : ''} until <span className="text-[#38bdf8] font-semibold">{next.title}</span>
          </p>
        </div>
      );
    })()}

    {uploadStatus && (
      <p className={`text-xs mt-2 font-semibold ${uploadStatus.includes('couldn') ? 'text-red-400' : 'text-blue-400'}`}>{uploadStatus}</p>
    )}
  </div>
</div>
```

- [ ] **Step 2: Add `Crown` to the Lucide import**

At line 5, update the import:
```tsx
import { ChevronLeft, ChevronRight, Edit, Clock, FileText, Shield, Info, Camera, Settings, Crown, Car, MapPin, Star } from 'lucide-react';
```

- [ ] **Step 3: Verify visually on localhost** — avatar should appear inside a card, title "Newcomer" should be on its own line larger than before, crown count should have a faint yellow glow.

- [ ] **Step 4: Commit**
```bash
git add views/ProfileView.tsx
git commit -m "feat: wrap identity in hero card with crown glow and title hierarchy"
```

---

### Task 2: Replace Emoji Icons in Activity Feed

Replace 👑 🚗 🟡 📍 emojis in the activity rows with Lucide SVG icons in small colored containers. Replace `+1 👑` / `+2 👑` reward labels with icon + number.

**Files:**
- Modify: `views/ProfileView.tsx` — activity feed section and data mapping

**Interfaces:**
- Consumes: `recentActivity` array with `{ id, icon, action, address, reward, timeAgo }`
- The `icon` field currently holds an emoji string — change it to a component key string: `'crown'`, `'car'`, `'pin'`, `'clock'`

- [ ] **Step 1: Update the data mapping in `useEffect` to use icon keys instead of emojis**

Replace the `setRecentActivity` mapping (around line 51–52):
```tsx
// Change icon values from emoji to string keys
if (s.status === 'occupied') {
  items.push({ id: `f-${d.id}`, icon: 'crown', action: 'Helped Driver', address: addr, reward: '+2', ts });
} else if (s.pingMode === 'later') {
  items.push({ id: `f-${d.id}`, icon: 'clock', action: 'Leaving Later', address: addr, reward: null, ts });
} else {
  items.push({ id: `f-${d.id}`, icon: 'pin', action: 'Pinged Spot', address: addr, reward: null, ts });
}
// ...
items.push({ id: `d-${d.id}`, icon: 'car', action: 'Parked', address: f.address || '', reward: '+1', ts });
```

Also update the state type on line 13:
```tsx
const [recentActivity, setRecentActivity] = useState<{ id: string; icon: string; action: string; address: string; timeAgo: string; reward: string | null }[]>([]);
```
(Type stays the same — `icon` is still a string, now a key instead of emoji.)

- [ ] **Step 2: Add icon renderer helper inside the component (before the return)**

```tsx
const activityIcon = (key: string) => {
  const map: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
    crown: { icon: <Crown size={13} />, bg: 'bg-yellow-400/15', color: 'text-yellow-400' },
    car:   { icon: <Car size={13} />,   bg: 'bg-green-400/15',  color: 'text-green-400' },
    pin:   { icon: <MapPin size={13} />, bg: 'bg-[#1e75ff]/15', color: 'text-[#38bdf8]' },
    clock: { icon: <Clock size={13} />, bg: 'bg-orange-400/15', color: 'text-orange-400' },
  };
  const m = map[key] || map['pin'];
  return (
    <div className={`w-7 h-7 rounded-lg ${m.bg} ${m.color} flex items-center justify-center shrink-0`}>
      {m.icon}
    </div>
  );
};
```

- [ ] **Step 3: Update activity row render to use the icon renderer**

Replace the activity row JSX (inside `recentActivity.map`):
```tsx
{recentActivity.map(item => (
  <div key={item.id} className="px-4 py-3 flex items-center gap-3 active:bg-white/5 transition-colors">
    {activityIcon(item.icon)}
    <p className="flex-1 text-xs font-semibold text-[var(--color-text)] truncate">
      {item.action}
      {item.address ? <span className="text-[var(--color-text-secondary)] font-normal"> · {item.address}</span> : null}
      <span className="text-[var(--color-text-secondary)] font-normal"> · {item.timeAgo}</span>
    </p>
    {item.reward && (
      <div className="flex items-center gap-0.5 shrink-0">
        <span className="text-xs font-bold text-yellow-400">{item.reward}</span>
        <Crown size={11} className="text-yellow-400" />
      </div>
    )}
  </div>
))}
```

- [ ] **Step 4: Commit**
```bash
git add views/ProfileView.tsx
git commit -m "feat: replace emoji icons with SVG in activity feed"
```

---

### Task 3: Consistent Section Headers + "View all activity" Button

All three sections (Recent Activity, Vehicle, General Details) should use the same internal header pattern. Replace the floating `<h3>` labels with in-card headers. Add a `ChevronRight` to "View all activity".

**Files:**
- Modify: `views/ProfileView.tsx` — three section blocks

**Interfaces:**
- Consumes: existing card structure from Task 1
- Produces: consistent section header pattern across all cards

- [ ] **Step 1: Update Recent Activity card to use internal header**

Replace:
```tsx
{/* Recent Activity */}
<div>
  <h3 className="font-bold text-[var(--color-text-secondary)] text-xs uppercase tracking-wider mb-2.5 px-1">Recent Activity</h3>
  <div className="bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl overflow-hidden">
```
With:
```tsx
{/* Recent Activity */}
<div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
  <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
    <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Recent Activity</p>
  </div>
```
And remove the closing `</div>` that was wrapping the `<h3>` + card pair (there was one extra).

- [ ] **Step 2: Update "View all activity" button to include chevron icon**

Replace:
```tsx
<button
  onClick={() => setView(AppView.PARKING_SPACE)}
  className="w-full py-2.5 text-center text-[11px] font-semibold text-[#38bdf8] border-t border-[var(--color-border)] hover:bg-white/5 transition-colors"
>
  View All Activity
</button>
```
With:
```tsx
<button
  onClick={() => setView(AppView.PARKING_SPACE)}
  className="w-full py-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#38bdf8] border-t border-[var(--color-border)] hover:bg-white/5 active:bg-white/10 transition-colors"
>
  View all activity
  <ChevronRight size={13} />
</button>
```

- [ ] **Step 3: Update Vehicle card to use internal header pattern**

Replace the Vehicle card's inner label:
```tsx
<p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Vehicle</p>
```
Remove the `mb-1` and restructure as:
```tsx
<div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
  <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
    <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Vehicle</p>
  </div>
  <button
    onClick={() => setView(AppView.EDIT_VEHICLE)}
    className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
  >
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#1e75ff]/10 flex items-center justify-center text-[#38bdf8] shrink-0">
        <Car size={18} />
      </div>
      <div>
        {user.vehicleBrand || user.vehicleColor || user.vehicleType ? (
          <p className="text-sm font-semibold text-[var(--color-text)]">
            {[user.vehicleColor, user.vehicleBrand].filter(Boolean).join(' ')}
            {user.vehicleType ? <span className="text-[var(--color-text-secondary)] font-normal"> • {user.vehicleType}</span> : null}
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold text-[var(--color-text)]">No vehicle added</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Add your vehicle to help drivers identify you</p>
          </>
        )}
      </div>
    </div>
    <ChevronRight size={16} className="text-[var(--color-text-secondary)] shrink-0" />
  </button>
</div>
```

- [ ] **Step 4: Update General Details section to use internal header and remove floating `<h3>`**

Replace:
```tsx
<div>
  <h3 className="font-bold text-[var(--color-text-secondary)] text-xs uppercase tracking-wider mb-2.5 px-1">General Details</h3>
  <div className="bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl divide-y divide-[var(--color-border)] overflow-hidden">
```
With:
```tsx
<div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
  <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
    <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Account</p>
  </div>
  <div className="divide-y divide-[var(--color-border)]">
```
And add a closing `</div>` before the final `</div>` of that section (to close the new inner wrapper div).

Also update the three row buttons inside to use `active:bg-white/10` instead of `hover:bg-[#0b2240]/40` for consistency:
```tsx
className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
```
And replace the `ChevronLeft size={16} className="... rotate-180"` on each row with `<ChevronRight size={16} className="text-[var(--color-text-secondary)]" />` (cleaner than rotate).

- [ ] **Step 5: Remove `space-y-6` outer wrapper spacing, replace with `space-y-3`**

The outer cards wrapper: change `space-y-6` → `space-y-3` for tighter card grouping now that section labels are inside cards.

- [ ] **Step 6: Commit**
```bash
git add views/ProfileView.tsx
git commit -m "feat: consistent in-card section headers, ChevronRight on all rows, tighter spacing"
```

---

### Task 4: Press Feedback + Text Size Floor

Add `active:scale-[0.97] transition-transform duration-150` to all tappable cards. Audit and eliminate all `text-[10px]` — replace with `text-xs`.

**Files:**
- Modify: `views/ProfileView.tsx`

- [ ] **Step 1: Add press scale to the three main card-level buttons**

Each of the three card wrapper buttons (Recent Activity "View all activity", Vehicle row, and each General Details row already has it from Task 3). Verify each has `active:scale-[0.97]` or `active:bg-white/10` at minimum.

For the identity card's upload button — already has `active:scale-95` from Task 1.

- [ ] **Step 2: Audit all `text-[10px]` occurrences and replace**

Search the file for `text-[10px]` — there should be none remaining after Tasks 1–3. If any remain (e.g. in the empty state text), change to `text-xs`.

Verify with:
```bash
grep -n "text-\[10px\]" views/ProfileView.tsx
```
Expected output: no matches.

- [ ] **Step 3: Commit**
```bash
git add views/ProfileView.tsx
git commit -m "feat: active press feedback on all cards, minimum 12px text throughout"
```

---

### Task 5: TypeScript Check + Localhost

Verify the file compiles cleanly and run the dev server.

**Files:**
- No changes — verification only

- [ ] **Step 1: Run TypeScript check**
```bash
npx tsc --noEmit 2>&1 | grep ProfileView
```
Expected output: no lines (no errors in ProfileView).

- [ ] **Step 2: Start dev server**
```bash
npm run dev
```
Expected: server starts on http://localhost:5173 (or 5174 if port in use).

- [ ] **Step 3: Manual verification checklist**
  - [ ] Identity block is inside a card with avatar visible
  - [ ] Title ("Newcomer" etc.) is on its own line, larger than before
  - [ ] Crown count has faint yellow glow
  - [ ] Activity feed shows colored icon containers (not emojis)
  - [ ] Reward labels show `+1 👑` with SVG crown icon
  - [ ] "View all activity" has a chevron
  - [ ] Vehicle card has Car icon in blue container
  - [ ] General Details rows use ChevronRight (not rotated ChevronLeft)
  - [ ] All section labels are inside cards, no floating `<h3>` labels
  - [ ] No visible 10px text anywhere
  - [ ] Tapping cards shows visual feedback

- [ ] **Step 4: Final commit if any small fixes were needed**
```bash
git add views/ProfileView.tsx
git commit -m "fix: post-review polish from localhost testing"
```
