interface NotificationPingItem {
  id: string;
  status?: string;
  expiresAt?: { toMillis?: () => number; seconds?: number } | null;
  [key: string]: unknown;
}

export type NotificationPingResolution<T extends NotificationPingItem> =
  | { kind: 'live'; item: T }
  | { kind: 'unavailable' };

const liveStatuses = new Set(['available', 'interested', 'occupied']);

const expirationMillis = (value: NotificationPingItem['expiresAt']): number | null => {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1_000;
  return null;
};

const isLive = (item: NotificationPingItem, nowMs: number) => {
  if (!liveStatuses.has(item.status ?? '')) return false;
  const expiresAt = expirationMillis(item.expiresAt);
  return expiresAt !== null && expiresAt > nowMs;
};

export async function resolveNotificationPing<T extends NotificationPingItem>(
  spotId: string,
  currentItems: T[],
  nowMs: number,
  fetchById: (spotId: string) => Promise<T | null>,
): Promise<NotificationPingResolution<T>> {
  const current = currentItems.find(item => item.id === spotId);
  if (current) return isLive(current, nowMs) ? { kind: 'live', item: current } : { kind: 'unavailable' };

  const fetched = await fetchById(spotId);
  return fetched && isLive(fetched, nowMs)
    ? { kind: 'live', item: fetched }
    : { kind: 'unavailable' };
}
