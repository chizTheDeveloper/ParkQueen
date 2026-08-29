import { describe, it, expect, vi, beforeEach } from 'vitest';

const { reportCriticalActionFailure } = vi.hoisted(() => ({
  reportCriticalActionFailure: vi.fn(),
}));

vi.mock('../../utils/errorReporting', () => ({ reportCriticalActionFailure }));

import { reportPingCreationFailure } from './pingFailureReporting';

describe('reportPingCreationFailure', () => {
  beforeEach(() => reportCriticalActionFailure.mockClear());

  it('reports ping_create exactly once for an immediate ping (no departureTime)', () => {
    const error = new Error('boom');
    reportPingCreationFailure(error, null);
    expect(reportCriticalActionFailure).toHaveBeenCalledTimes(1);
    expect(reportCriticalActionFailure).toHaveBeenCalledWith('ping_create', error, { operationType: 'immediate' });
  });

  it('reports ping_create exactly once for a scheduled ping (departureTime set)', () => {
    const error = new Error('boom');
    reportPingCreationFailure(error, new Date('2026-09-01T12:00:00Z'));
    expect(reportCriticalActionFailure).toHaveBeenCalledTimes(1);
    expect(reportCriticalActionFailure).toHaveBeenCalledWith('ping_create', error, { operationType: 'scheduled' });
  });
});
