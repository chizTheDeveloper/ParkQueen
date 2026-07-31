const SAFE_FIRESTORE_ID = /^[^/]{1,500}$/;

export function spotFeedbackDocId(spotId: string, driverId: string): string {
  if (!SAFE_FIRESTORE_ID.test(spotId) || !SAFE_FIRESTORE_ID.test(driverId)) {
    throw new Error('Invalid feedback identifier');
  }
  return `${spotId}_${driverId}`;
}
