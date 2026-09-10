/**
 * The one list of supported alert radii.
 *
 * This preference drives BOTH the push-notification radius and the Nearby
 * Activity feed radius, so the options have to be defined once. They were
 * previously a private const inside NotificationsSettingsView while the Nearby
 * feed used a hardcoded 2 miles that no preference could change.
 */
export const RADIUS_OPTIONS = [1, 2, 3, 5] as const;

export type NotificationRadius = (typeof RADIUS_OPTIONS)[number];

/** Matches the default applied wherever `user?.notificationRadius ?? 1` is read. */
export const DEFAULT_RADIUS: NotificationRadius = 1;

export function isSupportedRadius(value: unknown): value is NotificationRadius {
  return typeof value === 'number' && (RADIUS_OPTIONS as readonly number[]).includes(value);
}

/**
 * Coerces whatever is stored on the user to a radius the feed can actually
 * query. A value outside the supported set — from an older build, a manual
 * edit, or a partially-written document — must not silently widen or narrow
 * the query, so it falls back to the documented default.
 */
export function normalizeRadius(value: unknown): NotificationRadius {
  return isSupportedRadius(value) ? value : DEFAULT_RADIUS;
}

/** "1 mi" — used in the pill, the summary line and the empty state alike. */
export function formatRadius(value: unknown): string {
  return `${normalizeRadius(value)} mi`;
}
