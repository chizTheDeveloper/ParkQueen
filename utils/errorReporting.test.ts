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

import { captureClientException } from './errorReporting';

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
