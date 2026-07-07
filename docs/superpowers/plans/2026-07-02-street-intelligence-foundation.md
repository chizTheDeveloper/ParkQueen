# Street Intelligence Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Street Intelligence foundation — Firestore schema, admin management UI, segment-matching logic, and a Safe Until card inside the My Car session sheet — so that every parking session automatically surfaces next street cleaning info for the user's specific side of the street.

**Architecture:** Street segments and their cleaning rules live in Firestore (`streetSegments/{id}/streetRules/{ruleId}`). When a user starts a My Car session, the client queries nearby segments by geohash, detects which side of the street the user is on via cross-product geometry, and stores the matched segment info in localStorage alongside the saved spot. The session sheet then fetches the matched segment's rules and computes Safe Until on-demand (never stored). Admins enter segments via a new admin dashboard page; intersections are geocoded via Nominatim at save time to produce the geometry needed for side detection.

**Tech Stack:** React + TypeScript + Tailwind CSS, Firebase Firestore, geofire-common (already installed), Nominatim geocoding API (free, no key)

## Global Constraints

- **NEVER** use `git add -A` or `git add .` — always stage specific files by name
- **NEVER** commit `functions/.env`
- Subcollection name: `streetRules` (not `parkingRestrictions`, not `rules`)
- Confidence level for manually entered segments: `'parqueen_verified'` (not `'nyc_verified'`)
- `safeUntil` is ALWAYS computed on demand — never persisted
- `blockComplexity` is ALWAYS derived from rule count — never stored
- All geometry math uses lat/lng in degrees (no projection); cross-product sign determines side
- Days stored as 3-letter strings: `"Mon"`, `"Tue"`, `"Wed"`, `"Thu"`, `"Fri"`, `"Sat"`, `"Sun"`
- Times stored as `"HH:MM"` 24-hour strings: `"08:00"`, `"11:00"`
- `parkingSide` values: `"N"` | `"S"` | `"E"` | `"W"`
- Boroughs stored as NYC codes: `"MN"` | `"BK"` | `"QN"` | `"BX"` | `"SI"`
- Nominatim requires a `User-Agent` header; use `"ParQueen/1.0"`
- geofire-common is already installed and imported as `* as geofire from 'geofire-common'` in StreetParkingView — use the same import pattern
- The existing `SavedSpot` type is defined **inline** in `StreetParkingView.tsx` (not in a shared types file) — extend it there
- Admin dashboard pattern: add nav item to `navItems` array in `AdminDashboardView.tsx` Sidebar, add case to `renderPage()` switch, create new page component

---

### Task 1: Firestore rules for streetSegments and suspensions

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Produces: `streetSegments` collection readable by all, writable by admin only; `streetSegments/{id}/streetRules` subcollection same; `suspensions` collection same

- [ ] **Step 1: Add the new collection rules to `firestore.rules`**

Add inside the `match /databases/{database}/documents {` block, after the `adminAuditLog` block:

```
    match /streetSegments/{segmentId} {
      allow read: if true;
      allow write: if isAdmin();

      match /streetRules/{ruleId} {
        allow read: if true;
        allow write: if isAdmin();
      }
    }

    match /suspensions/{suspensionId} {
      allow read: if true;
      allow write: if isAdmin();
    }
```

- [ ] **Step 2: Verify rules compile**

```bash
firebase firestore:rules --check
```

Expected: no compilation errors. If the CLI doesn't support `--check`, deploy rules only:

```bash
firebase deploy --only firestore:rules
```

Expected output contains: `✔  firestore: released rules firestore.rules to cloud.firestore`

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore rules for streetSegments and suspensions"
```

---

### Task 2: Street intelligence utility functions

**Files:**
- Create: `utils/streetIntelligence.ts`

**Interfaces:**
- Produces (consumed by Tasks 4 and 5):
  - `geocodeIntersection(street: string, cross: string, borough: string): Promise<{ lat: number; lng: number } | null>`
  - `computeBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number`
  - `computeGeohash(lat: number, lng: number): string`
  - `detectParkingSide(userLat: number, userLng: number, fromLat: number, fromLng: number, toLat: number, toLng: number): 'N' | 'S' | 'E' | 'W'`
  - `computeSafeUntil(schedules: CleaningSchedule[], parkingSide: string, suspensions: SuspensionDoc[], now?: Date): SafeUntilResult`
  - `getBlockComplexity(ruleCount: number): 'simple' | 'moderate' | 'complex'`
  - Types: `CleaningSchedule`, `SuspensionDoc`, `SafeUntilResult`, `SegmentDoc`, `StreetRuleDoc`

- [ ] **Step 1: Create `utils/streetIntelligence.ts`**

```typescript
import * as geofire from 'geofire-common';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CleaningSchedule {
  side: string;
  days: string[];      // ["Mon", "Thu"]
  startTime: string;   // "08:00"
  endTime: string;     // "11:00"
}

export interface StreetRuleDoc {
  id: string;
  type: 'streetCleaning';
  effectiveDate: any;         // Firestore Timestamp
  supersededAt: any | null;
  schedules: CleaningSchedule[];
  source: string;
  lastSourceSync: string | null;
}

export interface SegmentDoc {
  id: string;
  cityId: string;
  streetName: string;
  fromCross: string;
  toCross: string;
  borough: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  centerLat: number;
  centerLng: number;
  bearing: number;
  geohash: string;
  cslSegmentId: string | null;
  confidence: {
    level: 'parqueen_verified' | 'community' | 'flagged';
    source: 'admin' | 'nyc_open_data' | 'user_report';
    lastVerifiedAt: any;
    communityConfirmations: number;
  };
  createdAt: any;
  updatedAt: any;
}

export interface SuspensionDoc {
  id: string;
  cityId: string;
  date: string;              // "YYYY-MM-DD"
  type: 'holiday' | 'emergency';
  label: string;
  affectsTypes: string[];    // ["streetCleaning"]
  source: 'admin';
}

export interface SafeUntilResult {
  activeNow: boolean;
  safeUntil: Date | null;    // null = no cleaning rule for this side
  nextDay: string | null;    // e.g. "Thursday"
  nextTime: string | null;   // e.g. "8:00 AM"
  scheduleDescription: string | null; // "Mon & Thu · 8–11 AM"
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

const BOROUGH_NAMES: Record<string, string> = {
  MN: 'Manhattan', BK: 'Brooklyn', QN: 'Queens', BX: 'Bronx', SI: 'Staten Island',
};

export async function geocodeIntersection(
  street: string,
  cross: string,
  borough: string,
): Promise<{ lat: number; lng: number } | null> {
  const boroughName = BOROUGH_NAMES[borough] || borough;
  const q = encodeURIComponent(`${street} and ${cross}, ${boroughName}, New York, NY`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ParQueen/1.0' } });
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

/** Returns bearing in degrees (0 = North, 90 = East, 180 = South, 270 = West) */
export function computeBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const dLon = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

export function computeGeohash(lat: number, lng: number): string {
  return geofire.geohashForLocation([lat, lng], 9);
}

/**
 * Returns which side of the street segment the user is standing on.
 * Uses the sign of the 2D cross product to determine left vs. right of the segment.
 * Then maps left/right to cardinal direction based on segment bearing.
 */
export function detectParkingSide(
  userLat: number,
  userLng: number,
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): 'N' | 'S' | 'E' | 'W' {
  // Segment direction vector
  const dx = toLng - fromLng;
  const dy = toLat - fromLat;
  // Vector from segment start to user
  const px = userLng - fromLng;
  const py = userLat - fromLat;
  // Cross product: positive = user is to the LEFT of segment direction
  const cross = dx * py - dy * px;

  // Bearing of segment (direction it runs toward "to")
  const bearing = computeBearing(
    { lat: fromLat, lng: fromLng },
    { lat: toLat, lng: toLng },
  );

  // Mostly E-W segment (bearing near 90° or 270°): sides are N / S
  const isEW = (bearing > 45 && bearing < 135) || (bearing > 225 && bearing < 315);
  if (isEW) {
    // Segment runs eastward (bearing ~90): left of travel = North side
    // Segment runs westward (bearing ~270): left of travel = South side
    const runningEast = bearing < 180;
    if (runningEast) return cross > 0 ? 'N' : 'S';
    return cross > 0 ? 'S' : 'N';
  } else {
    // Mostly N-S segment: sides are E / W
    const runningNorth = bearing < 90 || bearing > 270;
    if (runningNorth) return cross > 0 ? 'W' : 'E';
    return cross > 0 ? 'E' : 'W';
  }
}

// ─── Safe Until ───────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseTime(timeStr: string, onDate: Date): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(onDate);
  d.setHours(h, m, 0, 0);
  return d;
}

function isSuspended(date: Date, affectsType: string, suspensions: SuspensionDoc[]): boolean {
  const dateStr = date.toISOString().slice(0, 10);
  return suspensions.some(
    (s) => s.date === dateStr && s.affectsTypes.includes(affectsType),
  );
}

export function computeSafeUntil(
  schedules: CleaningSchedule[],
  parkingSide: string,
  suspensions: SuspensionDoc[],
  now: Date = new Date(),
): SafeUntilResult {
  const sideSchedules = schedules.filter((s) => s.side === parkingSide);

  if (!sideSchedules.length) {
    return { activeNow: false, safeUntil: null, nextDay: null, nextTime: null, scheduleDescription: null };
  }

  // Build human-readable schedule description from first matching rule
  const first = sideSchedules[0];
  const daysLabel = first.days.join(' & ');
  const [sh, sm] = first.startTime.split(':').map(Number);
  const [eh, em] = first.endTime.split(':').map(Number);
  const fmt = (h: number, m: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  const scheduleDescription = `${daysLabel} · ${fmt(sh, sm)}–${fmt(eh, em)}`;

  // Check if currently inside a cleaning window
  for (const sched of sideSchedules) {
    const todayName = DAY_NAMES[now.getDay()];
    if (sched.days.includes(todayName)) {
      const start = parseTime(sched.startTime, now);
      const end = parseTime(sched.endTime, now);
      if (now >= start && now < end && !isSuspended(now, 'streetCleaning', suspensions)) {
        return { activeNow: true, safeUntil: end, nextDay: null, nextTime: null, scheduleDescription };
      }
    }
  }

  // Find next cleaning window in the next 14 days
  for (let daysAhead = 0; daysAhead < 14; daysAhead++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + daysAhead);
    candidate.setHours(0, 0, 0, 0);

    const dayName = DAY_NAMES[candidate.getDay()];

    for (const sched of sideSchedules) {
      if (!sched.days.includes(dayName)) continue;

      const start = parseTime(sched.startTime, candidate);
      // Skip if this window already passed today
      if (daysAhead === 0 && start <= now) continue;
      if (isSuspended(candidate, 'streetCleaning', suspensions)) continue;

      const fullDay = FULL_DAY_NAMES[candidate.getDay()];
      const [h, m] = sched.startTime.split(':').map(Number);
      return {
        activeNow: false,
        safeUntil: start,
        nextDay: fullDay,
        nextTime: fmt(h, m),
        scheduleDescription,
      };
    }
  }

  // No cleaning found in 14 days (all suspended or no rules hit)
  return { activeNow: false, safeUntil: null, nextDay: null, nextTime: null, scheduleDescription };
}

// ─── Block Complexity ─────────────────────────────────────────────────────────

export function getBlockComplexity(ruleCount: number): 'simple' | 'moderate' | 'complex' {
  if (ruleCount <= 1) return 'simple';
  if (ruleCount <= 3) return 'moderate';
  return 'complex';
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `utils/streetIntelligence.ts`. Pre-existing errors in other files are acceptable.

- [ ] **Step 3: Commit**

```bash
git add utils/streetIntelligence.ts
git commit -m "feat: street intelligence utility functions — geocoding, side detection, Safe Until"
```

---

### Task 3: Admin — Streets & Suspensions management page

**Files:**
- Create: `views/admin/StreetSegmentsPage.tsx`
- Modify: `views/AdminDashboardView.tsx` (add nav item + renderPage case)

**Interfaces:**
- Consumes (from Task 2):
  - `geocodeIntersection`, `computeBearing`, `computeGeohash` from `../../utils/streetIntelligence`
  - `CleaningSchedule`, `SegmentDoc`, `SuspensionDoc`, `StreetRuleDoc` types
- Produces: Firestore writes to `streetSegments/{id}`, `streetSegments/{id}/streetRules/{id}`, `suspensions/{id}`

- [ ] **Step 1: Create `views/admin/StreetSegmentsPage.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  query, orderBy, Timestamp, where,
} from 'firebase/firestore';
import { MapPin, Plus, Trash2, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react';
import {
  geocodeIntersection, computeBearing, computeGeohash,
  CleaningSchedule, SegmentDoc, SuspensionDoc, StreetRuleDoc,
} from '../../utils/streetIntelligence';

const BOROUGHS = [
  { code: 'MN', label: 'Manhattan' },
  { code: 'BK', label: 'Brooklyn' },
  { code: 'QN', label: 'Queens' },
  { code: 'BX', label: 'Bronx' },
  { code: 'SI', label: 'Staten Island' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Add Segment Form ──────────────────────────────────────────────────────────

function AddSegmentForm({ onSaved }: { onSaved: () => void }) {
  const [streetName, setStreetName] = useState('');
  const [fromCross, setFromCross] = useState('');
  const [toCross, setToCross] = useState('');
  const [borough, setBorough] = useState('MN');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!streetName.trim() || !fromCross.trim() || !toCross.trim()) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const [fromCoord, toCoord] = await Promise.all([
        geocodeIntersection(streetName, fromCross, borough),
        geocodeIntersection(streetName, toCross, borough),
      ]);
      if (!fromCoord || !toCoord) {
        setError('Could not geocode one or both intersections. Check street names and try again.');
        setSaving(false);
        return;
      }
      const centerLat = (fromCoord.lat + toCoord.lat) / 2;
      const centerLng = (fromCoord.lng + toCoord.lng) / 2;
      const bearing = computeBearing(fromCoord, toCoord);
      const geohash = computeGeohash(centerLat, centerLng);

      await addDoc(collection(db, 'streetSegments'), {
        cityId: 'nyc',
        streetName: streetName.trim(),
        fromCross: fromCross.trim(),
        toCross: toCross.trim(),
        borough,
        fromLat: fromCoord.lat,
        fromLng: fromCoord.lng,
        toLat: toCoord.lat,
        toLng: toCoord.lng,
        centerLat,
        centerLng,
        bearing,
        geohash,
        cslSegmentId: null,
        confidence: {
          level: 'parqueen_verified',
          source: 'admin',
          lastVerifiedAt: Timestamp.now(),
          communityConfirmations: 0,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      setStreetName('');
      setFromCross('');
      setToCross('');
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Add Street Segment</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Street Name</label>
          <input
            value={streetName}
            onChange={e => setStreetName(e.target.value)}
            placeholder="Broadway"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">From Cross Street</label>
          <input
            value={fromCross}
            onChange={e => setFromCross(e.target.value)}
            placeholder="W 72 St"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">To Cross Street</label>
          <input
            value={toCross}
            onChange={e => setToCross(e.target.value)}
            placeholder="W 73 St"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Borough</label>
          <select
            value={borough}
            onChange={e => setBorough(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {BOROUGHS.map(b => <option key={b.code} value={b.code}>{b.label}</option>)}
          </select>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm mb-3">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Geocoding & saving…' : 'Add Segment'}
      </button>
    </div>
  );
}

// ── Cleaning Rule Form ────────────────────────────────────────────────────────

function AddRuleForm({ segmentId, onSaved }: { segmentId: string; onSaved: () => void }) {
  const [side, setSide] = useState('N');
  const [days, setDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('11:00');
  const [saving, setSaving] = useState(false);

  const toggleDay = (d: string) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleSave = async () => {
    if (!days.length) return;
    setSaving(true);
    const schedule: CleaningSchedule = { side, days, startTime, endTime };
    await addDoc(collection(db, 'streetSegments', segmentId, 'streetRules'), {
      type: 'streetCleaning',
      effectiveDate: Timestamp.now(),
      supersededAt: null,
      schedules: [schedule],
      source: 'admin',
      lastSourceSync: new Date().toISOString().slice(0, 10),
    });
    setDays([]);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Add Cleaning Rule</p>
      <div className="flex flex-wrap gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Side</label>
          <select value={side} onChange={e => setSide(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-sm">
            {['N', 'S', 'E', 'W'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Start</label>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">End</label>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-sm" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {DAYS.map(d => (
          <button
            key={d}
            onClick={() => toggleDay(d)}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${days.includes(d) ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            {d}
          </button>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving || !days.length}
        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : 'Save Rule'}
      </button>
    </div>
  );
}

// ── Segment Row ───────────────────────────────────────────────────────────────

function SegmentRow({ seg, onDeleted }: { seg: SegmentDoc; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [rules, setRules] = useState<StreetRuleDoc[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadRules = async () => {
    setLoadingRules(true);
    const snap = await getDocs(
      query(collection(db, 'streetSegments', seg.id, 'streetRules'), where('supersededAt', '==', null))
    );
    setRules(snap.docs.map(d => ({ id: d.id, ...d.data() } as StreetRuleDoc)));
    setLoadingRules(false);
  };

  const handleExpand = () => {
    if (!expanded) loadRules();
    setExpanded(e => !e);
  };

  const deleteRule = async (ruleId: string) => {
    await deleteDoc(doc(db, 'streetSegments', seg.id, 'streetRules', ruleId));
    loadRules();
  };

  const deleteSegment = async () => {
    if (!confirm(`Delete segment "${seg.streetName}" (${seg.fromCross}–${seg.toCross})?`)) return;
    setDeleting(true);
    await deleteDoc(doc(db, 'streetSegments', seg.id));
    onDeleted();
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-3 bg-white">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{seg.streetName}</p>
          <p className="text-xs text-gray-500">{seg.fromCross} → {seg.toCross} · {BOROUGHS.find(b => b.code === seg.borough)?.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">ParQueen Verified</span>
          <button onClick={handleExpand} className="p-1 text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={deleteSegment} disabled={deleting} className="p-1 text-red-400 hover:text-red-600 disabled:opacity-50">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-3 mb-2">Cleaning Rules</p>
          {loadingRules ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="text-xs text-gray-400">No rules yet.</p>
          ) : (
            <div className="space-y-2">
              {rules.map(rule => (
                rule.schedules.map((sched, i) => (
                  <div key={`${rule.id}-${i}`} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 text-xs">
                    <span className="font-semibold text-gray-700">Side {sched.side}</span>
                    <span className="text-gray-500">{sched.days.join(' & ')}</span>
                    <span className="text-gray-500">{sched.startTime}–{sched.endTime}</span>
                    <button onClick={() => deleteRule(rule.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              ))}
            </div>
          )}
          <AddRuleForm segmentId={seg.id} onSaved={loadRules} />
        </div>
      )}
    </div>
  );
}

// ── Suspensions Panel ─────────────────────────────────────────────────────────

function SuspensionsPanel() {
  const [suspensions, setSuspensions] = useState<SuspensionDoc[]>([]);
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<'holiday' | 'emergency'>('holiday');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const snap = await getDocs(query(collection(db, 'suspensions'), orderBy('date', 'desc')));
    setSuspensions(snap.docs.map(d => ({ id: d.id, ...d.data() } as SuspensionDoc)));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!date || !label) return;
    setSaving(true);
    await addDoc(collection(db, 'suspensions'), {
      cityId: 'nyc',
      date,
      type,
      label: label.trim(),
      affectsTypes: ['streetCleaning'],
      source: 'admin',
      createdAt: Timestamp.now(),
    });
    setDate('');
    setLabel('');
    setSaving(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'suspensions', id));
    load();
  };

  return (
    <div className="mt-8">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">ASP Suspensions</h3>
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Martin Luther King Jr. Day" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Type</label>
            <select value={type} onChange={e => setType(e.target.value as any)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="holiday">Holiday</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
        </div>
        <button onClick={handleAdd} disabled={saving || !date || !label} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Add Suspension'}
        </button>
      </div>
      <div className="space-y-2">
        {suspensions.map(s => (
          <div key={s.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">{s.label}</p>
              <p className="text-xs text-gray-500">{s.date} · {s.type}</p>
            </div>
            <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {!suspensions.length && <p className="text-sm text-gray-400">No suspensions on record.</p>}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export const StreetSegmentsPage = () => {
  const [segments, setSegments] = useState<SegmentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'segments' | 'suspensions'>('segments');

  const loadSegments = async () => {
    setLoading(true);
    const snap = await getDocs(query(collection(db, 'streetSegments'), orderBy('streetName')));
    setSegments(snap.docs.map(d => ({ id: d.id, ...d.data() } as SegmentDoc)));
    setLoading(false);
  };

  useEffect(() => { loadSegments(); }, []);

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Street Intelligence</h2>
        <p className="text-sm text-gray-500 mt-1">Manage street segments and parking rules for the ParQueen Street Intelligence system.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['segments', 'suspensions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'segments' && (
        <>
          <AddSegmentForm onSaved={loadSegments} />
          {loading ? (
            <p className="text-sm text-gray-400">Loading segments…</p>
          ) : segments.length === 0 ? (
            <p className="text-sm text-gray-400">No segments yet. Add one above.</p>
          ) : (
            <div>
              {segments.map(seg => (
                <SegmentRow key={seg.id} seg={seg} onDeleted={loadSegments} />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'suspensions' && <SuspensionsPanel />}
    </div>
  );
};
```

- [ ] **Step 2: Add Streets nav item and page to `AdminDashboardView.tsx`**

In the `navItems` array inside `Sidebar`, add after `'Settings'`:

```tsx
{ icon: <MapPin size={20} />, name: 'Streets' },
```

Also add `MapPin` to the lucide-react import at the top of `AdminDashboardView.tsx`:

```tsx
import { BarChart, Bell, Search, Settings, DollarSign, List, Users, LayoutDashboard, ChevronLeft, ChevronRight, LogOut, MapPin } from 'lucide-react';
```

Add the import for `StreetSegmentsPage` near the other page imports:

```tsx
import { StreetSegmentsPage } from './admin/StreetSegmentsPage';
```

Add a case to `renderPage()`:

```tsx
case 'Streets':
  return <StreetSegmentsPage />;
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

Expected: builds successfully. TypeScript errors in pre-existing files are acceptable; no new errors in `StreetSegmentsPage.tsx` or `AdminDashboardView.tsx`.

- [ ] **Step 4: Deploy and test manually**

```bash
firebase deploy --only hosting
```

Open the admin dashboard at `admin.parqueen.app` (or `localhost:5173?admin`).
- Click "Streets" in the sidebar — page loads
- Add a test segment: `Broadway`, from `W 72 St`, to `W 73 St`, borough `Manhattan`
- Verify it appears in the list without error
- Expand the segment → Add a cleaning rule: Side N, Mon & Thu, 08:00–11:00 → rule appears
- Switch to Suspensions tab → add a suspension for any future date → appears in list

- [ ] **Step 5: Commit**

```bash
git add views/admin/StreetSegmentsPage.tsx views/AdminDashboardView.tsx
git commit -m "feat: Streets admin page — segment entry, cleaning rules, suspensions management"
```

---

### Task 4: My Car session segment matching

**Files:**
- Modify: `views/StreetParkingView.tsx`

**Interfaces:**
- Consumes (from Task 2):
  - `detectParkingSide` from `../../utils/streetIntelligence`
  - `SegmentDoc`, `StreetRuleDoc` types
- Produces: `savedSpot` in localStorage now includes `segmentId`, `parkingSide`, `restrictionVersionId`, `streetName` (segment-level) — consumed by Task 5
- The extended `SavedSpot` type must be updated inline in `StreetParkingView.tsx`

- [ ] **Step 1: Extend the `SavedSpot` type in `StreetParkingView.tsx`**

Find the existing type definition (around line 94) and replace:

```tsx
type SavedSpot = { lat: number; lng: number; address: string; savedAt: number };
```

with:

```tsx
type SavedSpot = {
  lat: number;
  lng: number;
  address: string;
  savedAt: number;
  // Street Intelligence — null if no segment matched
  segmentId: string | null;
  parkingSide: 'N' | 'S' | 'E' | 'W' | null;
  restrictionVersionId: string | null;
  segmentStreetName: string | null;
};
```

- [ ] **Step 2: Add the segment-matching imports at the top of `StreetParkingView.tsx`**

Add to the existing imports section (after the existing firebase/firestore import):

```tsx
import { collection, addDoc, Timestamp, doc, deleteDoc, writeBatch, updateDoc, getDocs, where, query, orderBy, startAt, endAt } from 'firebase/firestore';
import * as geofire from 'geofire-common';
import { detectParkingSide } from '../utils/streetIntelligence';
```

Note: `collection`, `getDocs`, `query`, `where` are already imported — only add the new ones (`orderBy`, `startAt`, `endAt`) and the `detectParkingSide` import. Check the existing import line and add only what's missing.

- [ ] **Step 3: Add the `matchNearestSegment` helper function**

Add this function inside `StreetParkingView` component body, before `saveMySpot`:

```tsx
const matchNearestSegment = async (userLat: number, userLng: number) => {
  try {
    const radiusM = 80;
    const center: [number, number] = [userLat, userLng];
    const bounds = geofire.geohashQueryBounds(center, radiusM);

    const snaps = await Promise.all(
      bounds.map(([start, end]) =>
        getDocs(
          query(
            collection(db, 'streetSegments'),
            orderBy('geohash'),
            startAt(start),
            endAt(end),
          ),
        ),
      ),
    );

    const candidates = snaps.flatMap(s =>
      s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
    );

    if (!candidates.length) return null;

    // Sort by distance from user to segment center
    const withDist = candidates.map((seg: any) => ({
      ...seg,
      dist: geofire.distanceBetween([userLat, userLng], [seg.centerLat, seg.centerLng]),
    }));
    withDist.sort((a: any, b: any) => a.dist - b.dist);
    const nearest = withDist[0];

    const parkingSide = detectParkingSide(
      userLat, userLng,
      nearest.fromLat, nearest.fromLng,
      nearest.toLat, nearest.toLng,
    );

    // Get active rule version ID
    const rulesSnap = await getDocs(
      query(
        collection(db, 'streetSegments', nearest.id, 'streetRules'),
        where('supersededAt', '==', null),
      ),
    );
    const restrictionVersionId = rulesSnap.docs[0]?.id || null;

    return {
      segmentId: nearest.id as string,
      parkingSide,
      restrictionVersionId,
      segmentStreetName: nearest.streetName as string,
    };
  } catch (e) {
    console.warn('Segment match failed:', e);
    return null;
  }
};
```

- [ ] **Step 4: Update `saveMySpot` to call `matchNearestSegment`**

Find the existing `saveMySpot` function (around line 147) and replace it:

```tsx
const saveMySpot = async () => {
    if (!userLocation) return;
    const [lng, lat] = userLocation;
    const [address, segmentMatch] = await Promise.all([
        reverseGeocode(lng, lat),
        matchNearestSegment(lat, lng),
    ]);
    const spot: SavedSpot = {
        lat,
        lng,
        address,
        savedAt: Date.now(),
        segmentId: segmentMatch?.segmentId ?? null,
        parkingSide: segmentMatch?.parkingSide ?? null,
        restrictionVersionId: segmentMatch?.restrictionVersionId ?? null,
        segmentStreetName: segmentMatch?.segmentStreetName ?? null,
    };
    localStorage.setItem(SAVED_SPOT_KEY, JSON.stringify(spot));
    setSavedSpot(spot);
    setShowSessionSheet(true);
};
```

- [ ] **Step 5: Build and verify**

```bash
npm run build
```

Expected: no new TypeScript errors. The `SavedSpot` type change will propagate — verify no accesses to the old shape break anything. The new fields are all optional/nullable so existing usage is unaffected.

- [ ] **Step 6: Commit**

```bash
git add views/StreetParkingView.tsx
git commit -m "feat: match street segment on My Car session start — stores segmentId, parkingSide, restrictionVersionId"
```

---

### Task 5: StreetIntelligenceCard and session sheet integration

**Files:**
- Create: `views/street-parking/StreetIntelligenceCard.tsx`
- Modify: `views/StreetParkingView.tsx` (add card to session sheet)

**Interfaces:**
- Consumes (from Tasks 2 and 4):
  - `SavedSpot` extended type (segmentId, parkingSide, restrictionVersionId)
  - `computeSafeUntil`, `getBlockComplexity`, `StreetRuleDoc`, `SuspensionDoc`, `SafeUntilResult` from `../../utils/streetIntelligence`
  - Firestore: reads `streetSegments/{id}/streetRules` and `suspensions`

- [ ] **Step 1: Create `views/street-parking/StreetIntelligenceCard.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Leaf, Clock, AlertTriangle, CheckCircle, Layers } from 'lucide-react';
import {
  computeSafeUntil, getBlockComplexity,
  StreetRuleDoc, SuspensionDoc, SafeUntilResult, CleaningSchedule,
} from '../../utils/streetIntelligence';

interface Props {
  segmentId: string;
  parkingSide: 'N' | 'S' | 'E' | 'W';
  streetName: string;
}

const SIDE_LABELS: Record<string, string> = {
  N: 'North Side', S: 'South Side', E: 'East Side', W: 'West Side',
};

const COMPLEXITY_CONFIG = {
  simple: { label: 'Easy Block', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  moderate: { label: 'Moderate Block', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  complex: { label: 'Complex Block', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

export const StreetIntelligenceCard = ({ segmentId, parkingSide, streetName }: Props) => {
  const [result, setResult] = useState<SafeUntilResult | null>(null);
  const [ruleCount, setRuleCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [rulesSnap, suspSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'streetSegments', segmentId, 'streetRules'),
            where('supersededAt', '==', null),
          )),
          getDocs(query(collection(db, 'suspensions'), orderBy('date', 'desc'))),
        ]);

        if (cancelled) return;

        const rules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StreetRuleDoc));
        const suspensions = suspSnap.docs.map(d => ({ id: d.id, ...d.data() } as SuspensionDoc));

        // Flatten all schedules from active rules
        const allSchedules: CleaningSchedule[] = rules.flatMap(r => r.schedules || []);

        setRuleCount(rules.length);
        setResult(computeSafeUntil(allSchedules, parkingSide, suspensions));
      } catch (e) {
        console.warn('StreetIntelligenceCard load error:', e);
        setResult(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [segmentId, parkingSide]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4 animate-pulse">
        <div className="h-3 w-24 bg-white/10 rounded mb-2" />
        <div className="h-6 w-40 bg-white/10 rounded" />
      </div>
    );
  }

  if (!result) return null;

  const complexity = getBlockComplexity(ruleCount);
  const cx = COMPLEXITY_CONFIG[complexity];

  // No cleaning rules for this side
  if (!result.scheduleDescription) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Leaf size={14} className="text-[var(--color-text-secondary)]" />
          <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
            {streetName} · {SIDE_LABELS[parkingSide]}
          </p>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">No street cleaning on record for this side.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4">
      {/* Street + side header */}
      <div className="flex items-center gap-2 mb-3">
        <Leaf size={14} className="text-[var(--color-text-secondary)]" />
        <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
          {streetName} · {SIDE_LABELS[parkingSide]}
        </p>
      </div>

      {/* Safe Until / Active Now */}
      {result.activeNow ? (
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <div>
            <p className="text-base font-extrabold text-red-400 leading-tight">Active Now</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Cleaning in progress — move your car immediately
            </p>
          </div>
        </div>
      ) : result.nextDay ? (
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={18} className="text-green-400 shrink-0" />
          <div>
            <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest leading-none mb-0.5">Safe Until</p>
            <p className="text-base font-extrabold text-white leading-tight">{result.nextDay} {result.nextTime}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={18} className="text-green-400 shrink-0" />
          <p className="text-sm text-[var(--color-text-secondary)]">No upcoming cleaning found (14 days).</p>
        </div>
      )}

      {/* Because: explanation */}
      <p className="text-xs text-[var(--color-text-secondary)] mb-3">
        Because: street cleaning {result.scheduleDescription}
      </p>

      {/* Block complexity + confidence */}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cx.bg} ${cx.color}`}>
          {cx.label}
        </span>
        <span className="text-[10px] font-semibold text-[var(--color-text-secondary)] bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
          ParQueen Verified
        </span>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add `StreetIntelligenceCard` to the session sheet in `StreetParkingView.tsx`**

Add the import near the other street-parking imports:

```tsx
import { StreetIntelligenceCard } from './street-parking/StreetIntelligenceCard';
```

In the session sheet JSX (around line 703), inside `{savedSpot && (`, add the card immediately after the header section `</div>` (after the address block, before the Navigate button):

```tsx
{/* Street Intelligence */}
{savedSpot.segmentId && savedSpot.parkingSide && savedSpot.segmentStreetName && (
    <StreetIntelligenceCard
        segmentId={savedSpot.segmentId}
        parkingSide={savedSpot.parkingSide}
        streetName={savedSpot.segmentStreetName}
    />
)}
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: successful build. No new TypeScript errors.

- [ ] **Step 4: Deploy and end-to-end test**

```bash
firebase deploy --only hosting
```

Manual test sequence:
1. In admin dashboard → Streets → add segment for a block you know (e.g. your street)
2. Add a cleaning rule: correct side, real days/times
3. Open ParQueen app → go to that street on the map → tap "Ping Parking" to save My Car
4. Open My Car session sheet → `StreetIntelligenceCard` appears showing street name, side, Safe Until date/time, "Because" explanation, badge
5. If no segment exists nearby → card does not appear (graceful degradation)
6. Add a suspension for today → re-open session sheet → Safe Until jumps to next non-suspended window

- [ ] **Step 5: Commit**

```bash
git add views/street-parking/StreetIntelligenceCard.tsx views/StreetParkingView.tsx
git commit -m "feat: StreetIntelligenceCard in My Car sheet — Safe Until, side detection, schedule explanation"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| `streetRules` subcollection (not `parkingRestrictions`) | Task 1, 2, 3 |
| `parqueen_verified` confidence (not `nyc_verified`) | Task 3 |
| `safeUntil` computed on demand, never stored | Task 2, 5 |
| `blockComplexity` derived, never stored | Task 2, 5 |
| `restrictionVersionId` stored on session | Task 4 |
| Geocode cross streets at save time (not manual GeoJSON) | Task 3 |
| `centerLat`/`centerLng` for geohash proximity query | Task 3 |
| Side detection via cross product | Task 2, 4 |
| "Because:" explanation in UI | Task 5 |
| Suspensions respected in Safe Until | Task 2, 5 |
| City Provider field (`cityId`) on every document | Task 3 |
| `lastSourceSync` on each rule | Task 3 |
| `cslSegmentId: null` placeholder for future NYC sync | Task 3 |
| Graceful degradation when no segment matched | Task 4, 5 |
| Admin Streets page with segment + rule + suspension management | Task 3 |

**No placeholders found.**

**Type consistency verified:** `CleaningSchedule`, `StreetRuleDoc`, `SuspensionDoc`, `SafeUntilResult`, `SegmentDoc` all defined once in `utils/streetIntelligence.ts` and imported everywhere. `SavedSpot` extended inline in `StreetParkingView.tsx` as designed. `detectParkingSide` signature matches usage in Task 4. `computeSafeUntil` signature matches usage in Task 5.
