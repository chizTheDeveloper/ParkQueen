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
 * Derives community impact counts from owner-scoped Firestore snapshots.
 *
 * Pings shared = all spot documents (every document is a genuine committed Ping).
 * Successful handoffs = spots where status === 'occupied' (canonical "helped driver").
 * Note: successfulHandoffs is always a subset of pingsShared.
 *
 * Spots found = feedback records where outcome === 'success' (driver parked).
 * Excludes 'failed' and undefined outcomes.
 *
 * ponytail: full-collection reads are acceptable for now; move to Firestore count
 * aggregations or user-document counters once per-user history exceeds ~500 docs.
 */
export function deriveImpactCounts(
  spots: ImpactSpot[],
  feedback: ImpactFeedback[],
): ImpactCounts {
  return {
    pingsShared: spots.length,
    successfulHandoffs: spots.filter(s => s.status === 'occupied').length,
    spotsFound: feedback.filter(f => f.outcome === 'success').length,
  };
}
