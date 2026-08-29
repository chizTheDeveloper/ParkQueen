const SAFE_FIRESTORE_ID = /^[^/]{1,500}$/;

export const HANDOFF_FAILURE_REASONS = [
  'Someone else got it',
  "Finder hadn't left yet",
  "Couldn't find the location",
  'Other',
] as const;

export type HandoffFailureReason = typeof HANDOFF_FAILURE_REASONS[number];

export function isHandoffFailureReason(value: unknown): value is HandoffFailureReason {
  return typeof value === 'string'
    && (HANDOFF_FAILURE_REASONS as readonly string[]).includes(value);
}

export function spotFeedbackDocId(spotId: string, driverId: string): string {
  if (!SAFE_FIRESTORE_ID.test(spotId) || !SAFE_FIRESTORE_ID.test(driverId)) {
    throw new Error('Invalid feedback identifier');
  }
  return `${spotId}_${driverId}`;
}
