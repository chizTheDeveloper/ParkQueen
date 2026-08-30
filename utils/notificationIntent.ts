export type NotificationIntent =
  | { version: 1; type: 'ping'; spotId: string }
  | { version: 1; type: 'my_car' }
  | { version: 1; type: 'notifications' };

type LocationLike = Pick<Location, 'hash' | 'pathname' | 'search'>;
type HistoryLike = Pick<History, 'replaceState'>;

const FRAGMENT_PREFIX = '#pq-notification=';
const SPOT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const normalizeSpotId = (value: unknown): string | null => {
  if (typeof value !== 'string' || !SPOT_ID_PATTERN.test(value)) return null;
  // My Car document identifiers can embed a Firebase UID. They are not valid
  // Ping-routing values and must never be placed in notification route state.
  if (value.startsWith('mycar_')) return null;
  return value;
};

export function normalizeNotificationIntent(value: unknown): NotificationIntent | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.type !== 'string') return null;

  if (value.type === 'ping') {
    if (!hasOnlyKeys(value, ['version', 'type', 'spotId'])) return null;
    const spotId = normalizeSpotId(value.spotId);
    return spotId ? { version: 1, type: 'ping', spotId } : null;
  }

  if (value.type === 'my_car' || value.type === 'notifications') {
    if (!hasOnlyKeys(value, ['version', 'type'])) return null;
    return { version: 1, type: value.type };
  }

  return null;
}

export function readNotificationIntentFromPayload(payload: unknown): NotificationIntent {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};

  if (data.navigationVersion === '1' && typeof data.navigationType === 'string') {
    const candidate = data.navigationType === 'ping'
      ? { version: 1, type: 'ping', spotId: data.spotId }
      : { version: 1, type: data.navigationType };
    return normalizeNotificationIntent(candidate) ?? { version: 1, type: 'notifications' };
  }

  const legacySpotId = normalizeSpotId(data.spotId);
  return legacySpotId
    ? { version: 1, type: 'ping', spotId: legacySpotId }
    : { version: 1, type: 'notifications' };
}

export function encodeNotificationIntentFragment(intent: NotificationIntent): string {
  const serialized = intent.type === 'ping'
    ? `v1:ping:${intent.spotId}`
    : `v1:${intent.type}`;
  return `${FRAGMENT_PREFIX}${encodeURIComponent(serialized)}`;
}

function parseNotificationIntentFragment(hash: string): NotificationIntent | null {
  if (!hash.startsWith(FRAGMENT_PREFIX)) return null;

  let decoded = '';
  try {
    decoded = decodeURIComponent(hash.slice(FRAGMENT_PREFIX.length));
  } catch {
    return { version: 1, type: 'notifications' };
  }

  if (decoded === 'v1:my_car') return { version: 1, type: 'my_car' };
  if (decoded === 'v1:notifications') return { version: 1, type: 'notifications' };
  if (decoded.startsWith('v1:ping:')) {
    return normalizeNotificationIntent({ version: 1, type: 'ping', spotId: decoded.slice('v1:ping:'.length) })
      ?? { version: 1, type: 'notifications' };
  }
  return { version: 1, type: 'notifications' };
}

export function consumeNotificationIntentFragment(
  location: LocationLike,
  history: HistoryLike,
): NotificationIntent | null {
  const intent = parseNotificationIntentFragment(location.hash);
  if (!location.hash.startsWith(FRAGMENT_PREFIX)) return null;
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  return intent ?? { version: 1, type: 'notifications' };
}
