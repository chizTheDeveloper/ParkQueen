import { describe, it, expect, vi, beforeEach } from 'vitest';

const { reportCriticalActionFailure } = vi.hoisted(() => ({
  reportCriticalActionFailure: vi.fn(),
}));

vi.mock('../../utils/errorReporting', () => ({ reportCriticalActionFailure }));

import { reportClaimFailure, reportClaimCancelFailure } from './claimFailureReporting';

describe('reportClaimFailure', () => {
  beforeEach(() => reportCriticalActionFailure.mockClear());

  it('reports spot_claim exactly once for an immediate (express-interest) claim', () => {
    const error = new Error('boom');
    reportClaimFailure(error, 'immediate');
    expect(reportCriticalActionFailure).toHaveBeenCalledTimes(1);
    expect(reportCriticalActionFailure).toHaveBeenCalledWith('spot_claim', error, { operationType: 'immediate' });
  });

  it('reports spot_claim exactly once for a scheduled claim', () => {
    const error = new Error('boom');
    reportClaimFailure(error, 'scheduled');
    expect(reportCriticalActionFailure).toHaveBeenCalledWith('spot_claim', error, { operationType: 'scheduled' });
  });
});

describe('reportClaimCancelFailure', () => {
  beforeEach(() => reportCriticalActionFailure.mockClear());

  it('reports claim_cancel exactly once', () => {
    const error = new Error('boom');
    reportClaimCancelFailure(error);
    expect(reportCriticalActionFailure).toHaveBeenCalledTimes(1);
    expect(reportCriticalActionFailure).toHaveBeenCalledWith('claim_cancel', error, undefined);
  });
});
