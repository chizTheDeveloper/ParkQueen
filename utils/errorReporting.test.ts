import { describe, it, expect, vi, beforeEach } from 'vitest';

const { captureException, withScope } = vi.hoisted(() => ({
  captureException: vi.fn(),
  withScope: vi.fn((cb: (scope: any) => void) => {
    const scope = { setTag: vi.fn() };
    cb(scope);
    return scope;
  }),
}));

vi.mock('@sentry/react', () => ({ captureException, withScope }));

import { captureClientException, reportCriticalActionFailure } from './errorReporting';

describe('captureClientException', () => {
  beforeEach(() => {
    captureException.mockClear();
    withScope.mockClear();
  });

  it('reports the error to Sentry', () => {
    const error = new Error('boom');
    captureClientException(error);
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it('tags only the allowlisted context fields (route/component/errorCode)', () => {
    let capturedScope: any;
    withScope.mockImplementationOnce((cb: (scope: any) => void) => {
      capturedScope = { setTag: vi.fn() };
      cb(capturedScope);
      return capturedScope;
    });
    captureClientException(new Error('boom'), { route: 'map', component: 'StreetIntelligenceCard', errorCode: 'permission-denied' });
    expect(capturedScope.setTag).toHaveBeenCalledWith('route', 'map');
    expect(capturedScope.setTag).toHaveBeenCalledWith('component', 'StreetIntelligenceCard');
    expect(capturedScope.setTag).toHaveBeenCalledWith('errorCode', 'permission-denied');
    expect(capturedScope.setTag).toHaveBeenCalledTimes(3);
  });

  it('does not attach arbitrary fields — the context type only allows route/component/errorCode', () => {
    let capturedScope: any;
    withScope.mockImplementationOnce((cb: (scope: any) => void) => {
      capturedScope = { setTag: vi.fn() };
      cb(capturedScope);
      return capturedScope;
    });
    // @ts-expect-error — props/state/arbitrary objects are not part of the allowlisted context type
    captureClientException(new Error('boom'), { props: { secret: 'x' } });
    const taggedKeys = capturedScope.setTag.mock.calls.map((call: any[]) => call[0]);
    expect(taggedKeys).not.toContain('props');
  });

  it('works with no context at all', () => {
    expect(() => captureClientException(new Error('boom'))).not.toThrow();
    expect(captureException).toHaveBeenCalled();
  });
});

describe('reportCriticalActionFailure', () => {
  beforeEach(() => {
    captureException.mockClear();
    withScope.mockClear();
  });

  it('reports the allowed action exactly once', () => {
    reportCriticalActionFailure('ping_create', new Error('boom'));
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('attaches a stable action tag', () => {
    let scope: any;
    withScope.mockImplementationOnce((cb: (scope: any) => void) => { scope = { setTag: vi.fn() }; cb(scope); return scope; });
    reportCriticalActionFailure('spot_claim', new Error('boom'));
    expect(scope.setTag).toHaveBeenCalledWith('action', 'spot_claim');
  });

  it('attaches the surface tag when provided', () => {
    let scope: any;
    withScope.mockImplementationOnce((cb: (scope: any) => void) => { scope = { setTag: vi.fn() }; cb(scope); return scope; });
    reportCriticalActionFailure('spot_claim', new Error('boom'), { surface: 'map' });
    expect(scope.setTag).toHaveBeenCalledWith('surface', 'map');
  });

  it('does not attach a surface tag when not provided', () => {
    let scope: any;
    withScope.mockImplementationOnce((cb: (scope: any) => void) => { scope = { setTag: vi.fn() }; cb(scope); return scope; });
    reportCriticalActionFailure('spot_claim', new Error('boom'));
    const taggedKeys = scope.setTag.mock.calls.map((call: any[]) => call[0]);
    expect(taggedKeys).not.toContain('surface');
  });

  it('attaches the operationType tag when provided', () => {
    let scope: any;
    withScope.mockImplementationOnce((cb: (scope: any) => void) => { scope = { setTag: vi.fn() }; cb(scope); return scope; });
    reportCriticalActionFailure('ping_create', new Error('boom'), { operationType: 'scheduled' });
    expect(scope.setTag).toHaveBeenCalledWith('operationType', 'scheduled');
  });

  it('derives a safe errorCode tag from a Firebase-style error.code', () => {
    let scope: any;
    withScope.mockImplementationOnce((cb: (scope: any) => void) => { scope = { setTag: vi.fn() }; cb(scope); return scope; });
    const firebaseError = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    reportCriticalActionFailure('spot_claim', firebaseError);
    expect(scope.setTag).toHaveBeenCalledWith('errorCode', 'permission-denied');
  });

  it('falls back to the error name when there is no .code', () => {
    let scope: any;
    withScope.mockImplementationOnce((cb: (scope: any) => void) => { scope = { setTag: vi.fn() }; cb(scope); return scope; });
    reportCriticalActionFailure('spot_claim', new TypeError('boom'));
    expect(scope.setTag).toHaveBeenCalledWith('errorCode', 'TypeError');
  });

  it('an explicit context.errorCode overrides the code derived from the error', () => {
    let scope: any;
    withScope.mockImplementationOnce((cb: (scope: any) => void) => { scope = { setTag: vi.fn() }; cb(scope); return scope; });
    const firebaseError = Object.assign(new Error('boom'), { code: 'internal' });
    reportCriticalActionFailure('spot_claim', firebaseError, { errorCode: 'unexpected' });
    expect(scope.setTag).toHaveBeenCalledWith('errorCode', 'unexpected');
  });

  it('does not accept arbitrary context fields — the type only allows surface/errorCode/operationType', () => {
    // @ts-expect-error — uid/spotId/etc are not part of the allowlisted context type
    reportCriticalActionFailure('spot_claim', new Error('boom'), { spotId: 'abc123', uid: 'u1' });
  });

  it('never sends the original error message — only a sanitized, action-scoped message', () => {
    reportCriticalActionFailure('account_create', new Error('failed for user someone@example.com'));
    const sentError = captureException.mock.calls[0][0];
    expect(sentError.message).not.toContain('someone@example.com');
    expect(sentError.message).toContain('account_create');
  });

  it('preserves the original stack trace for diagnostic value', () => {
    const original = new Error('boom');
    reportCriticalActionFailure('ping_create', original);
    const sentError = captureException.mock.calls[0][0];
    expect(sentError.stack).toBe(original.stack);
  });

  it('never throws into the caller, even if Sentry itself throws', () => {
    withScope.mockImplementationOnce(() => { throw new Error('sentry is down'); });
    expect(() => reportCriticalActionFailure('ping_create', new Error('boom'))).not.toThrow();
  });

  it('never throws when given a non-Error value', () => {
    expect(() => reportCriticalActionFailure('ping_create', 'a plain string error')).not.toThrow();
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
