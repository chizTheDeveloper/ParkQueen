import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// This vitest environment (environment: 'node') has no window/DOM globals at
// all — ErrorBoundary's existing manual Reload button, and the stale-chunk
// recovery helpers it now delegates to, both reference window.location.
vi.hoisted(() => {
  (globalThis as any).window = { location: { reload: () => {} } };
});

import ErrorBoundary from './ErrorBoundary';
import * as staleChunkRecovery from './utils/staleChunkRecovery';
import * as errorReporting from './utils/errorReporting';

function Bomb({ message }: { message: string }): React.ReactElement {
  throw new Error(message);
}

function Safe(): React.ReactElement {
  return <p>fine</p>;
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(staleChunkRecovery, 'tryRecoverFromChunkError').mockReturnValue(false);
    vi.spyOn(errorReporting, 'captureClientException').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('renders children normally when nothing throws', () => {
    const renderer = TestRenderer.create(<ErrorBoundary><Safe /></ErrorBoundary>);
    expect(renderer.root.findByType('p').props.children).toBe('fine');
  });

  it('shows the manual "Something went wrong" + Reload UI for an ordinary application error', () => {
    const renderer = TestRenderer.create(
      <ErrorBoundary><Bomb message="Objects are not valid as a React child" /></ErrorBoundary>
    );
    expect(renderer.root.findByType('h1').props.children).toBe('Something went wrong.');
    expect(renderer.root.findByType('button').props.children).toBe('Reload');
    expect(staleChunkRecovery.tryRecoverFromChunkError).toHaveBeenCalled();
  });

  it('logs the error via console.error for a genuine (non-chunk) failure', () => {
    TestRenderer.create(<ErrorBoundary><Bomb message="boom" /></ErrorBoundary>);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('reports the error to Sentry via captureClientException, with only safe context', () => {
    TestRenderer.create(<ErrorBoundary><Bomb message="boom" /></ErrorBoundary>);
    expect(errorReporting.captureClientException).toHaveBeenCalledTimes(1);
    const [reportedError, context] = (errorReporting.captureClientException as any).mock.calls[0];
    expect(reportedError).toBeInstanceOf(Error);
    expect(reportedError.message).toBe('boom');
    expect(context).toEqual({ component: 'ErrorBoundary', errorCode: 'Error' });
  });

  it('still calls tryRecoverFromChunkError for a caught error, independent of Sentry reporting', () => {
    TestRenderer.create(
      <ErrorBoundary><Bomb message="Failed to fetch dynamically imported module: https://x/y.js" /></ErrorBoundary>
    );
    expect(staleChunkRecovery.tryRecoverFromChunkError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Failed to fetch dynamically imported module: https://x/y.js' })
    );
    expect(errorReporting.captureClientException).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('the manual Reload button still calls window.location.reload()', () => {
    const reloadSpy = vi.fn();
    (globalThis as any).window.location.reload = reloadSpy;

    const renderer = TestRenderer.create(<ErrorBoundary><Bomb message="boom" /></ErrorBoundary>);
    act(() => {
      renderer.root.findByType('button').props.onClick();
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
