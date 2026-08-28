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
    const recoverSpy = vi.spyOn(staleChunkRecovery, 'tryRecoverFromChunkError').mockReturnValue(false);
    const renderer = TestRenderer.create(
      <ErrorBoundary><Bomb message="Objects are not valid as a React child" /></ErrorBoundary>
    );
    expect(renderer.root.findByType('h1').props.children).toBe('Something went wrong.');
    expect(renderer.root.findByType('button').props.children).toBe('Reload');
    expect(recoverSpy).toHaveBeenCalled();
  });

  it('logs the error via console.error for a genuine (non-chunk) failure', () => {
    vi.spyOn(staleChunkRecovery, 'tryRecoverFromChunkError').mockReturnValue(false);
    TestRenderer.create(<ErrorBoundary><Bomb message="boom" /></ErrorBoundary>);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('delegates to tryRecoverFromChunkError for a caught error, and still logs it', () => {
    const recoverSpy = vi.spyOn(staleChunkRecovery, 'tryRecoverFromChunkError').mockReturnValue(true);
    TestRenderer.create(
      <ErrorBoundary><Bomb message="Failed to fetch dynamically imported module: https://x/y.js" /></ErrorBoundary>
    );
    expect(recoverSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to fetch dynamically imported module: https://x/y.js' }));
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('the manual Reload button still calls window.location.reload()', () => {
    vi.spyOn(staleChunkRecovery, 'tryRecoverFromChunkError').mockReturnValue(false);
    const reloadSpy = vi.fn();
    (globalThis as any).window.location.reload = reloadSpy;

    const renderer = TestRenderer.create(<ErrorBoundary><Bomb message="boom" /></ErrorBoundary>);
    act(() => {
      renderer.root.findByType('button').props.onClick();
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
