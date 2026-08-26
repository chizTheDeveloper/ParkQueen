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
 * Pings shared = the durable users/{uid}.impactStats.pingsShared counter,
 * written go-forward-only by incrementTotalSpotsPinged. NOT derived from the
 * spots collection: spots are deleted by cleanupExpiredSpotsHourly roughly
 * 30-90 minutes after creation, so counting them made this "lifetime impact"
 * stat both decay over time and cap out at whatever fit in that window.
 *
 * Successful handoffs = the durable users/{uid}.trustStats.handoffsCompleted
 * counter, maintained by updateTrustOnFeedback (Cloud Functions) on every
 * successful spotFeedback creation. Same rationale as above.
 *
 * Spots found = feedback records where outcome === 'success' (driver parked).
 * Excludes 'failed' and undefined outcomes.
 *
 * ponytail: spotsFound still does a full-collection read; move to a durable
 * per-user counter or a Firestore count aggregation once history exceeds
 * ~500 docs.
 */
export function deriveImpactCounts(
  feedback: ImpactFeedback[],
  handoffsCompleted: number,
  pingsShared: number,
): ImpactCounts {
  return {
    pingsShared: pingsShared || 0,
    successfulHandoffs: handoffsCompleted || 0,
    spotsFound: feedback.filter(f => f.outcome === 'success').length,
  };
}
