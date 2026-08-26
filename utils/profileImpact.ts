export interface ImpactSpot {
  status?: string;
}

export interface ImpactFeedback {
  outcome?: string;
}

export interface ImpactCounts {
  pingsShared: number;
  successfulHandoffs: number;
  spotsFound: number;
}

/**
 * Derives community impact counts.
 *
 * Pings shared = all spot documents (every document is a genuine committed Ping).
 *
 * Successful handoffs = the durable users/{uid}.trustStats.handoffsCompleted
 * counter, maintained by updateTrustOnFeedback (Cloud Functions) on every
 * successful spotFeedback creation. NOT derived from spots.status ===
 * 'occupied': spots are deleted by cleanupExpiredSpotsHourly roughly 30-90
 * minutes after creation regardless of status, so counting them made this
 * "lifetime impact" stat silently decrease over time with no user action.
 *
 * Spots found = feedback records where outcome === 'success' (driver parked).
 * Excludes 'failed' and undefined outcomes.
 *
 * ponytail: pingsShared/spotsFound still do full-collection reads; move to
 * Firestore count aggregations or user-document counters once per-user
 * history exceeds ~500 docs.
 */
export function deriveImpactCounts(
  spots: ImpactSpot[],
  feedback: ImpactFeedback[],
  handoffsCompleted: number,
): ImpactCounts {
  return {
    pingsShared: spots.length,
    successfulHandoffs: handoffsCompleted || 0,
    spotsFound: feedback.filter(f => f.outcome === 'success').length,
  };
}
