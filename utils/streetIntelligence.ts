import * as geofire from 'geofire-common';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CleaningSchedule {
  side: string;
  days: string[];      // ["Mon", "Thu"]
  startTime: string;   // "08:00"
  endTime: string;     // "11:00"
  ruleType?: string;   // "metered_no_parking_window" for short metered-street windows; absent for classic ASP
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
  referenceAddress?: string;
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
  evenSideIsPositiveCross: boolean;
  cslSegmentId: string | null;
  source?: 'admin' | 'sweepnyc';
  status?: 'active' | 'needs_review' | 'archived' | 'duplicate';
  confidenceScore?: number;   // 1.0 = admin-verified, 0.95 = sweepnyc, 0.6 = community
  editedBy?: string;          // 'admin:uid' | 'system:sweepnyc' | 'system:quality'
  provenance?: {
    provider: 'admin' | 'sweepnyc' | 'community' | 'import';
    // admin provenance
    importedBy?: string;
    // sweepnyc provenance
    sweepNYCObjectId?: number;
    fetchedAt?: any;
    parserVersion?: string;
    rawSignTexts?: string[];
    refreshedAt?: any;
    refreshCount?: number;
  };
  // Archive metadata — present only when status === 'archived'
  archivedAt?: any;
  archivedBy?: string;
  archiveReason?: string;
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
  status?: string;           // 'archived' when soft-deleted by admin
}

export interface SafeUntilResult {
  activeNow: boolean;
  safeUntil: Date | null;    // null = no cleaning rule for this side
  nextDay: string | null;    // e.g. "Thursday"
  nextTime: string | null;   // e.g. "8:00 AM"
  scheduleDescription: string | null; // "Mon & Thu · 8–11 AM"
}

// ─── Geocoding & Geometry ─────────────────────────────────────────────────────

const BOROUGH_NAMES: Record<string, string> = {
  MN: 'Manhattan', BK: 'Brooklyn', QN: 'Queens', BX: 'Bronx', SI: 'Staten Island',
};

export async function geocodeAddress(
  address: string,
  borough: string,
): Promise<{ lat: number; lng: number } | null> {
  const boroughName = BOROUGH_NAMES[borough] || borough;
  const q = encodeURIComponent(`${address}, ${boroughName}, NY`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export const geocodeIntersection = geocodeAddress;

/**
 * Fetches OSM street geometry near a point via Overpass.
 * Combines all way segments found, normalizes bearing to 0–180° so
 * the cross-product sign is consistent for even/odd side detection.
 */
export async function fetchStreetGeometry(
  streetName: string,
  lat: number,
  lng: number,
): Promise<{ fromLat: number; fromLng: number; toLat: number; toLng: number; bearing: number } | null> {
  const delta = 0.003;
  const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`;
  const q = `[out:json][timeout:10];way[name="${streetName}"](${bbox});out geom;`;
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.elements?.length) return null;
    // Use the single way closest to (lat, lng) — prevents multi-block bearing errors from aggregating all ways
    const validWays = data.elements.filter((el: any) => el.geometry && el.geometry.length >= 2);
    if (!validWays.length) return null;
    const closestWay = validWays.reduce((best: any, el: any) => {
      const mid = el.geometry[Math.floor(el.geometry.length / 2)];
      const d = (mid.lat - lat) ** 2 + (mid.lon - lng) ** 2;
      return (!best || d < best.d) ? { el, d } : best;
    }, null as any);
    const wayNodes: { lat: number; lon: number }[] = closestWay.el.geometry;
    if (wayNodes.length < 2) return null;
    let fromLat = wayNodes[0].lat, fromLng = wayNodes[0].lon;
    let toLat = wayNodes[wayNodes.length - 1].lat, toLng = wayNodes[wayNodes.length - 1].lon;
    // Normalize: always point with bearing 0–180° for consistent cross-product sign
    let bearing = computeBearing({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng });
    if (bearing > 180) {
      [fromLat, toLat] = [toLat, fromLat];
      [fromLng, toLng] = [toLng, fromLng];
      bearing = computeBearing({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng });
    }
    return { fromLat, fromLng, toLat, toLng, bearing };
  } catch {
    return null;
  }
}

/** Raw cross product — positive means user is left of the from→to direction. */
export function computeCrossRaw(
  userLat: number, userLng: number,
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
): number {
  const dx = toLng - fromLng;
  const dy = toLat - fromLat;
  return dx * (userLat - fromLat) - dy * (userLng - fromLng);
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
 * Returns which side of the street segment the user is on: 'even' or 'odd'.
 * Requires evenSideIsPositiveCross from the segment doc (computed at segment creation
 * using a known even-numbered reference address).
 * The segment must have bearing normalized to 0–180° (done by fetchStreetGeometry).
 */
export function detectParkingSide(
  userLat: number,
  userLng: number,
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  evenSideIsPositiveCross: boolean,
): 'even' | 'odd' {
  const cross = computeCrossRaw(userLat, userLng, fromLat, fromLng, toLat, toLng);
  return (cross > 0) === evenSideIsPositiveCross ? 'even' : 'odd';
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

// SuspensionDoc.date is a NYC civil-calendar date ("YYYY-MM-DD"), not a UTC
// or device-local one — ASP suspensions are defined by NYC's own calendar day
// regardless of where the app happens to be running. Intl.DateTimeFormat with
// an explicit timeZone is DST-safe and independent of the runtime's local
// timezone (unlike Date.toISOString(), which is always UTC).
export function toNYCDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function isSuspended(date: Date, affectsType: string, suspensions: SuspensionDoc[]): boolean {
  const dateStr = toNYCDateKey(date);
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
