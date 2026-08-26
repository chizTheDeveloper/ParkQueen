export interface ImpactCounts {
  pingsShared: number;
  successfulHandoffs: number;
  spotsFound: number;
}

export interface ImpactCountsInput {
  pingsShared?: number;
  successfulHandoffs?: number;
  spotsFound?: number;
}

/**
 * Normalizes the three YOUR IMPACT figures. Each is already an exact,
 * independently-sourced number by the time it reaches this function:
 *
 * - pingsShared: users/{uid}.impactStats.pingsShared (durable, go-forward)
 * - successfulHandoffs: users/{uid}.trustStats.handoffsCompleted (durable)
 * - spotsFound: getCountFromServer(spotFeedback where userId==uid &&
 *   outcome=='success') — a server aggregation over full history, not a
 *   document array Profile happens to have fetched for display purposes
 *
 * None of the three is derived from spots/spotFeedback document arrays —
 * counting ephemeral/partial fetches previously made these figures decay
 * or undercount over time. This function only guards against a missing
 * value rendering as `undefined`.
 */
export function deriveImpactCounts(input: ImpactCountsInput): ImpactCounts {
  return {
    pingsShared: input.pingsShared || 0,
    successfulHandoffs: input.successfulHandoffs || 0,
    spotsFound: input.spotsFound || 0,
  };
}
