/**
 * Hydrant proximity assessment.
 *
 * NYC prohibits parking within 15 feet of either side of a fire hydrant
 * (NYC DOT parking rules). Fifteen feet is a smaller distance than a phone GPS
 * fix is typically accurate to, so every result here is an ESTIMATE and the
 * wording never asserts legality either way.
 *
 * This is the single implementation of the assessment. Both the Hydrant
 * Distance tool and the "Am I Safe Here?" parking check call it, so the two
 * screens can never disagree about the same spot.
 */

export const HYDRANT_THRESHOLD_FT = 15;

/** Radius searched around the supplied point. ~197 ft — bounded, never the whole dataset. */
export const HYDRANT_SEARCH_RADIUS_M = 60;

/**
 * Assumed horizontal accuracy when the platform does not report one.
 * ~10 m is a routine open-sky phone fix; assuming better would manufacture
 * confidence the reading does not have.
 */
export const ASSUMED_ACCURACY_M = 10;

/**
 * Beyond this the fix says almost nothing at a 15 ft scale, so the answer is
 * "too close to call" no matter what the arithmetic works out to.
 */
export const MAX_USABLE_ACCURACY_M = 30;

export const METERS_TO_FEET = 3.28084;

export function metersToFeet(m: number): number {
  return m * METERS_TO_FEET;
}

export type HydrantStatus =
  | 'within'            // estimated at or inside 15 ft
  | 'too_close_to_call' // the accuracy range straddles 15 ft, or the fix is too poor
  | 'beyond'            // estimated outside 15 ft, and accuracy supports saying so
  | 'none_nearby'       // no hydrant in the searched radius
  | 'unavailable';      // lookup failed

export interface HydrantAssessment {
  status: HydrantStatus;
  /** Rounded feet to the nearest hydrant, or null when there is nothing to report. */
  distanceFt: number | null;
  /** Rounded feet of location accuracy actually used in the decision. */
  accuracyFt: number;
  /** True when accuracyFt came from ASSUMED_ACCURACY_M rather than the device. */
  accuracyAssumed: boolean;
  thresholdFt: number;
}

export interface HydrantAssessmentInput {
  /** Geodesic metres to the nearest hydrant; null when none was found. */
  distanceMeters: number | null;
  /** Reported horizontal accuracy in metres, if the platform gave one. */
  accuracyMeters?: number | null;
  /** Set when the lookup itself failed. */
  failed?: boolean;
}

/**
 * Conservative by construction:
 *
 * - at or inside the threshold always reports `within`, even with a poor fix,
 *   because the risk is what matters;
 * - outside the threshold only reports `beyond` when the accuracy radius does
 *   not reach back across it;
 * - anything ambiguous lands on `too_close_to_call`.
 *
 * There is no input that produces a "you are legally parked" answer.
 */
export function assessHydrantDistance(input: HydrantAssessmentInput): HydrantAssessment {
  const reported = typeof input.accuracyMeters === 'number' && Number.isFinite(input.accuracyMeters) && input.accuracyMeters >= 0
    ? input.accuracyMeters
    : null;
  const accuracyM = reported ?? ASSUMED_ACCURACY_M;
  const base = {
    accuracyFt: Math.round(metersToFeet(accuracyM)),
    accuracyAssumed: reported === null,
    thresholdFt: HYDRANT_THRESHOLD_FT,
  };

  if (input.failed) return { ...base, status: 'unavailable', distanceFt: null };

  if (input.distanceMeters === null || input.distanceMeters === undefined || !Number.isFinite(input.distanceMeters)) {
    return { ...base, status: 'none_nearby', distanceFt: null };
  }

  const distanceFt = metersToFeet(input.distanceMeters);
  const rounded = Math.round(distanceFt);

  // At or inside the line: report the risk regardless of how good the fix is.
  if (distanceFt <= HYDRANT_THRESHOLD_FT) {
    return { ...base, status: 'within', distanceFt: rounded };
  }

  // Outside the line, but a fix this coarse cannot resolve a 15 ft question.
  if (accuracyM > MAX_USABLE_ACCURACY_M) {
    return { ...base, status: 'too_close_to_call', distanceFt: rounded };
  }

  // Outside the line, but the uncertainty still reaches back across it.
  const accuracyFtExact = metersToFeet(accuracyM);
  if (distanceFt - accuracyFtExact <= HYDRANT_THRESHOLD_FT) {
    return { ...base, status: 'too_close_to_call', distanceFt: rounded };
  }

  return { ...base, status: 'beyond', distanceFt: rounded };
}

/**
 * Whether this assessment is an active reason to move the car.
 * Only a reading at or inside the threshold qualifies — uncertainty is not
 * evidence of a violation, and absence of data is not evidence of safety.
 */
export function isHydrantBlocking(a: HydrantAssessment): boolean {
  return a.status === 'within';
}

/** Whether this assessment leaves a question the driver should resolve themselves. */
export function isHydrantUncertain(a: HydrantAssessment): boolean {
  return a.status === 'too_close_to_call' || a.status === 'unavailable';
}
