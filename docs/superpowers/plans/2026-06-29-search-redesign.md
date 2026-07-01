# Search Redesign — Parking Activity Explorer (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the map search bar from a simple address lookup into a Parking Activity Explorer — when a user selects a search result, show a bottom sheet summarizing nearby parking activity before optionally navigating the map to that location.

**Architecture:** Modify `useSearch` to expose a selected destination state. Add a new `ParkingActivitySheet` component that queries Firestore spots near the destination and displays activity stats in a BottomSheet. The search result click no longer moves the map — instead it opens the sheet. An "Explore area" button in the sheet animates the map to the destination. The existing `useSpotData` is NOT reused because it's bound to the user's GPS-based `searchCenter`; the activity query is a one-shot query against a different center point.

**Tech Stack:** React, Firestore (one-shot `getDocs` query), existing BottomSheet component, Mapbox geocoding (already in useSearch), geofire-common for geohash range queries.

## Global Constraints

- Firebase SDK **10.8.0**
- No new npm dependencies
- Mapbox token via `VITE_MAPBOX_TOKEN` env var (already configured)
- Search placeholder text: `"Check parking near..."`
- Map must NOT move until user taps "Explore area"
- Deploy with `--project parkqueen-46475363-ccf36`

---

### Task 1: Add Destination Selection to useSearch

**Files:**
- Modify: `views/street-parking/useSearch.ts`

**Interfaces:**
- Consumes: existing useSearch return values
- Produces:
  - `selectedDestination: { name: string; fullName: string; center: [number, number] } | null` — new state
  - `handleSelectResult: (result: any) => void` — sets selectedDestination from a Mapbox geocode result, clears search UI
  - `clearDestination: () => void` — resets selectedDestination to null

- [ ] **Step 1: Add selectedDestination state and handlers**

Add after the existing state declarations (line 8):

```typescript
const [selectedDestination, setSelectedDestination] = useState<{
    name: string;
    fullName: string;
    center: [number, number];
} | null>(null);
```

Add before the return block:

```typescript
const handleSelectResult = (result: any) => {
    setSelectedDestination({
        name: result.text,
        fullName: result.place_name,
        center: result.center as [number, number],
    });
    setSearchQuery('');
    setResults([]);
    setSearchOpen(false);
    inputRef.current?.blur();
};

const clearDestination = () => {
    setSelectedDestination(null);
};
```

- [ ] **Step 2: Add to return object**

Add `selectedDestination`, `handleSelectResult`, and `clearDestination` to the return block.

- [ ] **Step 3: Commit**

```bash
git add views/street-parking/useSearch.ts
git commit -m "feat: add destination selection state to useSearch

Captures selected geocode result as a destination object instead of
immediately moving the map. Exposes handleSelectResult and clearDestination.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Create ParkingActivitySheet Component

**Files:**
- Create: `views/street-parking/ParkingActivitySheet.tsx`

**Interfaces:**
- Consumes:
  - `destination: { name: string; fullName: string; center: [number, number] }`
  - `onExplore: () => void` — called when user taps "Explore area"
  - `onDismiss: () => void` — called on close
- Produces: A React component that queries spots near the destination and renders activity stats inside a BottomSheet

- [ ] **Step 1: Create ParkingActivitySheet.tsx**

```tsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { BottomSheet } from './BottomSheet';
import { MapPin } from 'lucide-react';
import { getDistance } from './utils';

interface ParkingActivitySheetProps {
    destination: { name: string; fullName: string; center: [number, number] };
    onExplore: () => void;
    onDismiss: () => void;
}

const SEARCH_RADIUS_MILES = 1;

export const ParkingActivitySheet: React.FC<ParkingActivitySheetProps> = ({
    destination, onExplore, onDismiss,
}) => {
    const [stats, setStats] = useState<{
        activePings: number;
        leavingLaterPings: number;
        mostRecentAgo: string | null;
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const fetchActivity = async () => {
            setLoading(true);
            try {
                const now = Timestamp.now();
                const q = query(
                    collection(db, 'spots'),
                    where('expiresAt', '>', now),
                );
                const snap = await getDocs(q);

                const [lng, lat] = destination.center;
                let activePings = 0;
                let leavingLaterPings = 0;
                let mostRecentMs = 0;

                snap.docs.forEach(d => {
                    const s = d.data();
                    if (s.status === 'occupied') return;

                    const distKm = getDistance(lat, lng, s.lat, s.lng);
                    const distMi = distKm * 0.621371;
                    if (distMi > SEARCH_RADIUS_MILES) return;

                    if (s.pingMode === 'later') {
                        leavingLaterPings++;
                    } else {
                        activePings++;
                    }

                    const reported = s.reportedAt?.toMillis?.() || 0;
                    if (reported > mostRecentMs) mostRecentMs = reported;
                });

                if (cancelled) return;

                let mostRecentAgo: string | null = null;
                if (mostRecentMs > 0) {
                    const diffMin = Math.round((Date.now() - mostRecentMs) / 60000);
                    if (diffMin < 1) mostRecentAgo = 'Just now';
                    else if (diffMin < 60) mostRecentAgo = `${diffMin} min ago`;
                    else mostRecentAgo = `${Math.round(diffMin / 60)} hr ago`;
                }

                setStats({ activePings, leavingLaterPings, mostRecentAgo });
            } catch (e) {
                console.warn('Parking activity query failed', e);
                if (!cancelled) setStats({ activePings: 0, leavingLaterPings: 0, mostRecentAgo: null });
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchActivity();
        return () => { cancelled = true; };
    }, [destination.center[0], destination.center[1]]);

    const hasActivity = stats && (stats.activePings > 0 || stats.leavingLaterPings > 0);

    return (
        <BottomSheet isOpen={true} onClose={onDismiss}>
            <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <MapPin size={16} className="text-[#38bdf8]" />
                    <h3 className="font-bold text-base text-[var(--color-text)]">{destination.name}</h3>
                </div>
                <p className="text-[10px] text-[var(--color-text-secondary)] mb-4 truncate px-4">{destination.fullName}</p>

                {loading ? (
                    <p className="text-xs text-[var(--color-text-secondary)] py-4">Checking parking activity...</p>
                ) : hasActivity ? (
                    <div className="space-y-2.5 mb-4">
                        <div className="flex justify-between items-center px-3 py-2 bg-white/5 rounded-xl border border-[var(--color-border)]">
                            <span className="text-xs text-[var(--color-text-secondary)]">Active pings</span>
                            <span className="text-sm font-bold text-green-400">{stats!.activePings}</span>
                        </div>
                        <div className="flex justify-between items-center px-3 py-2 bg-white/5 rounded-xl border border-[var(--color-border)]">
                            <span className="text-xs text-[var(--color-text-secondary)]">Leaving later</span>
                            <span className="text-sm font-bold text-yellow-400">{stats!.leavingLaterPings}</span>
                        </div>
                        {stats!.mostRecentAgo && (
                            <div className="flex justify-between items-center px-3 py-2 bg-white/5 rounded-xl border border-[var(--color-border)]">
                                <span className="text-xs text-[var(--color-text-secondary)]">Most recent ping</span>
                                <span className="text-xs font-semibold text-[var(--color-text)]">{stats!.mostRecentAgo}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-[var(--color-text-secondary)] py-4 mb-2">
                        No parking activity near {destination.name} right now
                    </p>
                )}

                <button
                    onClick={onExplore}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 text-white"
                    style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}
                >
                    Explore {destination.name} area
                </button>
            </div>
        </BottomSheet>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add views/street-parking/ParkingActivitySheet.tsx
git commit -m "feat: add ParkingActivitySheet for search destination preview

Shows active pings, leaving-later pings, and most recent ping time for a
searched location. Includes 'Explore area' button to navigate the map.
Empty state shows 'No parking activity nearby' message.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Update HeaderBar — Placeholder Text and Result Click

**Files:**
- Modify: `views/street-parking/HeaderBar.tsx`

**Interfaces:**
- Consumes: new `handleSelectResult` from useSearch (passed as prop)
- Produces: Updated search bar with new placeholder; result click calls `handleSelectResult` instead of moving map directly

- [ ] **Step 1: Update HeaderBarProps**

Add new prop to the interface:

```typescript
onSelectResult: (result: any) => void;
```

- [ ] **Step 2: Update placeholder text**

Change line 76:

```typescript
placeholder="Check parking near..."
```

- [ ] **Step 3: Replace the result click handler**

Replace the result `onClick` (lines 136-144) — instead of calling `mapRef.current?.easeTo`, call the new prop:

```tsx
onClick={() => {
    onSelectResult(r);
}}
```

- [ ] **Step 4: Remove mapRef from props if no longer needed**

Check if `mapRef` is still used anywhere else in HeaderBar. The search result click was the only use. If so, remove `mapRef` from the `HeaderBarProps` interface and the destructured props. (If the search loading/results dropdown or any other element still uses it, keep it.)

Actually — `mapRef` is not used anywhere else in HeaderBar except the result click. Remove it from the interface and destructured props.

- [ ] **Step 5: Commit**

```bash
git add views/street-parking/HeaderBar.tsx
git commit -m "feat: update search bar placeholder and route result clicks

Placeholder changed to 'Check parking near...'. Result clicks now call
onSelectResult prop instead of moving the map directly. Removed mapRef
prop from HeaderBar since it's no longer used there.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Integrate ParkingActivitySheet into StreetParkingView

**Files:**
- Modify: `views/StreetParkingView.tsx`

**Interfaces:**
- Consumes: `ParkingActivitySheet`, updated `useSearch` (selectedDestination, handleSelectResult, clearDestination), updated `HeaderBar` (onSelectResult, no mapRef)
- Produces: Full integration — search result → activity sheet → explore button moves map

- [ ] **Step 1: Add ParkingActivitySheet import**

```typescript
import { ParkingActivitySheet } from './street-parking/ParkingActivitySheet';
```

- [ ] **Step 2: Update HeaderBar usage**

In the JSX where `<HeaderBar>` is rendered (around line 588), make these changes:

1. Add the new prop: `onSelectResult={search.handleSelectResult}`
2. Remove `mapRef={mapRef}` (no longer a HeaderBar prop)

- [ ] **Step 3: Add ParkingActivitySheet rendering**

Add after the existing BottomSheet blocks (near the other bottom sheets), before the closing `</div>` of the main container:

```tsx
{/* Parking Activity Explorer */}
{search.selectedDestination && (
    <ParkingActivitySheet
        destination={search.selectedDestination}
        onExplore={() => {
            const dest = search.selectedDestination!;
            mapRef.current?.easeTo({
                center: dest.center,
                zoom: 14,
                duration: 800,
            });
            search.clearDestination();
        }}
        onDismiss={search.clearDestination}
    />
)}
```

- [ ] **Step 4: Commit**

```bash
git add views/StreetParkingView.tsx
git commit -m "feat: integrate ParkingActivitySheet into map view

Search result selection shows parking activity bottom sheet instead of
immediately moving the map. Explore button animates map to destination.
Dismiss clears the destination state.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Build, Deploy, Verify, Update HANDOFF.md

**Files:**
- Modify: `HANDOFF.md` (add search redesign documentation + Phase 2/3 roadmap)

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: Clean build.

- [ ] **Step 2: Verify no stale references**

```bash
grep -r "Search location" --include="*.tsx" .
```

Expected: No results (old placeholder text replaced).

- [ ] **Step 3: Deploy**

```bash
npm run build && firebase deploy --project parkqueen-46475363-ccf36
```

- [ ] **Step 4: Add to HANDOFF.md**

In Section 3 (Features Already Implemented), add under a new subsection:

```markdown
### Parking Activity Explorer (Search)
- **Search bar** placeholder "Check parking near..." (was "Search location...")
- **Destination preview** — selecting a geocode result shows a bottom sheet with parking activity stats instead of immediately moving the map
- **Activity stats shown:** active pings count, leaving-later pings count, most recent ping time
- **"Explore [destination] area"** button animates map to the searched location
- **Empty state:** "No parking activity near [destination] right now" with Explore button still available
- **One-shot Firestore query** against `spots` collection filtered by distance (1 mile radius) — NOT a live listener
```

In Section 11 (Future Roadmap), add under "Discussed and Designed":

```markdown
- **Search Phase 2** — add parking success rate (from handoff outcome data) and activity level label to destination preview
- **Search Phase 3** — "Notify me when someone pings near [destination]" (location subscriptions), historical trends, busy times, frequently searched locations
```

- [ ] **Step 5: Commit HANDOFF.md**

```bash
git add HANDOFF.md
git commit -m "docs: add search redesign and Phase 2/3 roadmap to HANDOFF.md

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 6: Manual test plan**

Test on the deployed app:

1. **Search flow:** Tap search bar → type a location → select a result → verify bottom sheet appears with parking stats, map does NOT move
2. **Explore:** Tap "Explore [name] area" → verify map animates to location, sheet dismisses
3. **Dismiss:** Open sheet → drag down or tap backdrop → verify sheet closes, map stays at current location
4. **Empty state:** Search a remote location with no pings → verify "No parking activity" message appears, Explore button still works
5. **Return:** After exploring, tap locate-me button → verify map returns to GPS location
