import { reportCriticalActionFailure } from '../../utils/errorReporting';

/** Shared terminal-catch reporting for handleExpressInterest / handleScheduledClaim. */
export function reportClaimFailure(error: unknown, operationType: 'immediate' | 'scheduled'): void {
  reportCriticalActionFailure('spot_claim', error, { operationType });
}

/** Terminal-catch reporting for handleCancelByClaimer. Never reports spot/finder identifiers. */
export function reportClaimCancelFailure(error: unknown): void {
  reportCriticalActionFailure('claim_cancel', error, undefined);
}
