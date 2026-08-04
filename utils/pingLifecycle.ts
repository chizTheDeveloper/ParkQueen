export const PING_LIVE_TTL_MS = 30 * 60 * 1000;

export type PingPhase = 'scheduled' | 'live';

export interface PingTiming {
  reportedAt?: unknown;
  expiresAt?: unknown;
  pingMode?: 'now' | 'later' | null;
  status?: 'available' | 'interested' | 'occupied' | string;
  finderId?: string | null;
  interestedUserId?: string | null;
}

export type PingLifecycleState =
  | 'scheduled_unclaimed'
  | 'scheduled_claimed'
  | 'live_unclaimed'
  | 'live_claimed'
  | 'expired';

export function timestampToMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();

  const timestamp = value as {
    toMillis?: () => number;
    toDate?: () => Date;
    seconds?: number;
    nanoseconds?: number;
  };
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate().getTime();
  if (typeof timestamp.seconds === 'number') return timestamp.seconds * 1000 + (timestamp.nanoseconds ?? 0) / 1_000_000;
  return 0;
}

export function getPingPhase(ping: PingTiming, nowMs = Date.now()): PingPhase {
  const reportedAtMs = timestampToMillis(ping.reportedAt);
  return reportedAtMs > nowMs ? 'scheduled' : 'live';
}

export function derivePingLifecycle(ping: PingTiming, nowMs = Date.now(), viewerId?: string | null) {
  const expiresAtMs = timestampToMillis(ping.expiresAt);
  const expired = ping.status === 'occupied' || (expiresAtMs > 0 && expiresAtMs <= nowMs);
  const phase = getPingPhase(ping, nowMs);
  const claimed = ping.status === 'interested' && !!ping.interestedUserId;
  const state: PingLifecycleState = expired
    ? 'expired'
    : phase === 'scheduled'
      ? (claimed ? 'scheduled_claimed' : 'scheduled_unclaimed')
      : (claimed ? 'live_claimed' : 'live_unclaimed');
  const isOwner = !!viewerId && viewerId === ping.finderId;
  const isClaimant = !!viewerId && viewerId === ping.interestedUserId;
  return {
    state,
    phase,
    expired,
    claimed,
    isOwner,
    isClaimant,
    canClaim: !expired && !claimed && ping.status === 'available' && !isOwner,
  };
}

export function getNextPingPhaseBoundary(items: PingTiming[], nowMs = Date.now()): number | null {
  let next: number | null = null;
  for (const item of items) {
    for (const value of [item.reportedAt, item.expiresAt]) {
      const boundary = timestampToMillis(value);
      if (boundary > nowMs && (next === null || boundary < next)) next = boundary;
    }
  }
  return next;
}

export function getPingExpiresAtMs(reportedAt: unknown): number {
  return timestampToMillis(reportedAt) + PING_LIVE_TTL_MS;
}

interface PingPhaseClockOptions {
  getItems: () => PingTiming[];
  onTick: (nowMs: number) => void;
  now?: () => number;
  schedule?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
  heartbeatMs?: number;
}

export function createPingPhaseClock({
  getItems,
  onTick,
  now = Date.now,
  schedule = setTimeout,
  cancel = clearTimeout,
  heartbeatMs = 60_000,
}: PingPhaseClockOptions) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const clearPending = () => {
    if (timer !== null) cancel(timer);
    timer = null;
  };

  const reconcile = () => {
    if (!running) return;
    clearPending();
    const current = now();
    onTick(current);
    const boundary = getNextPingPhaseBoundary(getItems(), current);
    const next = boundary === null ? current + heartbeatMs : Math.min(boundary, current + heartbeatMs);
    timer = schedule(reconcile, Math.min(next - current, 2_147_483_647));
  };

  return {
    start() {
      if (running) return;
      running = true;
      reconcile();
    },
    resume: reconcile,
    stop() {
      running = false;
      clearPending();
    },
  };
}
