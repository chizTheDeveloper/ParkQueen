/**
 * Presentation for a Ping in the Nearby Activity feed.
 *
 * These are derived views of the EXISTING lifecycle — `derivePingLifecycle`
 * remains the authority on what a Ping actually is. Nothing here invents a
 * state: "leaving later" is a scheduled phase, "expiring soon" is a real
 * `expiresAt` approaching, and "new" is a real `reportedAt` the viewer has
 * not seen yet.
 */

import { derivePingLifecycle, timestampToMillis } from './pingLifecycle';

/** A live Ping is flagged as expiring once this little of its window remains. */
export const EXPIRING_SOON_MS = 5 * 60 * 1000;

export type PingCardKind = 'available' | 'leaving_later';

export interface PingCardPresentation {
  kind: PingCardKind;
  /** Live Ping close to its expiresAt. Never set for a scheduled Ping. */
  expiringSoon: boolean;
  /** Reported after the viewer last opened the feed. */
  isNew: boolean;
  /** Epoch ms this scheduled Ping becomes available; null when already live. */
  availableAtMs: number | null;
  /** Whole minutes left before expiry, for the urgency copy. Null when not applicable. */
  minutesLeft: number | null;
}

export interface PingCardInput {
  reportedAt?: unknown;
  expiresAt?: unknown;
  status?: string;
  finderId?: string | null;
  interestedUserId?: string | null;
  pingMode?: 'now' | 'later' | null;
}

export function derivePingCard(
  ping: PingCardInput,
  nowMs: number,
  lastViewedMs: number,
): PingCardPresentation {
  const lifecycle = derivePingLifecycle(ping, nowMs);
  const reportedAtMs = timestampToMillis(ping.reportedAt);
  const expiresAtMs = timestampToMillis(ping.expiresAt);

  const scheduled = lifecycle.phase === 'scheduled';
  const msLeft = expiresAtMs > 0 ? expiresAtMs - nowMs : null;

  return {
    kind: scheduled ? 'leaving_later' : 'available',
    // A Ping that has not started yet cannot be "expiring soon" — that would
    // read as urgency on something the driver cannot take.
    expiringSoon: !scheduled && msLeft !== null && msLeft > 0 && msLeft <= EXPIRING_SOON_MS,
    isNew: reportedAtMs > 0 && reportedAtMs > lastViewedMs,
    availableAtMs: scheduled ? reportedAtMs : null,
    minutesLeft: !scheduled && msLeft !== null && msLeft > 0 ? Math.ceil(msLeft / 60000) : null,
  };
}

const KM_TO_MILES = 0.621371;

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function kmToMiles(km: number): number {
  return km * KM_TO_MILES;
}

/** Feet under a tenth of a mile, otherwise one decimal of a mile. */
export function formatDistance(km: number): string {
  const miles = kmToMiles(km);
  if (miles < 0.1) return `${Math.round(km * 3280.84)} ft`;
  return `${miles.toFixed(1)} mi`;
}

/** Wall-clock time a scheduled Ping frees up, e.g. "4:15 PM". */
export function formatAvailableAt(ms: number, locale = 'en-US'): string {
  return new Date(ms).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Caps what the list renders. Ten is the pre-existing cap and stays: a Ping
 * feed is a "what can I take right now" surface, and the measured listener
 * budget already bounds how much arrives. Anything beyond is summarised
 * honestly rather than silently dropped.
 */
export const MAX_VISIBLE_PINGS = 10;

export interface FeedCounts {
  visible: number;
  total: number;
  hiddenByCap: number;
}

export function summarizeFeed(totalInRadius: number): FeedCounts {
  const visible = Math.min(totalInRadius, MAX_VISIBLE_PINGS);
  return { visible, total: totalInRadius, hiddenByCap: Math.max(0, totalInRadius - visible) };
}
