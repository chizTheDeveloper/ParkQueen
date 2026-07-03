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
