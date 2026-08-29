import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  const values = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();
  const eventTarget = {
    addEventListener: (type: string, listener: () => void) => {
      const handlers = listeners.get(type) ?? new Set();
      handlers.add(listener);
      listeners.set(type, handlers);
    },
    removeEventListener: (type: string, listener: () => void) => listeners.get(type)?.delete(listener),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { ...eventTarget, matchMedia: () => ({ matches: false }) },
  });
});

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/app', () => ({ getApp: vi.fn(() => ({})) }));

const { httpsCallableImpl } = vi.hoisted(() => ({ httpsCallableImpl: vi.fn() }));
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => httpsCallableImpl),
}));

const { getDoc } = vi.hoisted(() => ({ getDoc: vi.fn(async () => ({ exists: () => false })) }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, col, id) => ({ __col: col, __id: id })),
  getDoc,
}));

const { reportCriticalActionFailure } = vi.hoisted(() => ({ reportCriticalActionFailure: vi.fn() }));
vi.mock('../utils/errorReporting', () => ({ reportCriticalActionFailure }));

import { NameEntryView } from './NameEntryView';
import { t } from '../i18n';

async function typeAvailableUsernameAndSubmit(onComplete = vi.fn()) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<NameEntryView onComplete={onComplete} />);
  });

  const input = renderer.root.findByProps({ id: 'username-input' });
  await act(async () => { input.props.onChange({ target: { value: 'validname123' } }); });

  // Clear the 400ms debounce so the mocked getDoc-based availability check resolves.
  await act(async () => { await vi.advanceTimersByTimeAsync(400); });

  const button = renderer.root.findByProps({ type: 'button' });
  await act(async () => { button.props.onClick(); });

  return { renderer, button };
}

describe('NameEntryView — account_create critical-action failure reporting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reportCriticalActionFailure.mockClear();
    httpsCallableImpl.mockReset();
    getDoc.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('reports account_create exactly once for a genuinely unexpected callable failure, with only a safe error code — no username/phone/name', async () => {
    const err = Object.assign(new Error('internal'), { code: 'internal' });
    httpsCallableImpl.mockRejectedValue(err);

    await typeAvailableUsernameAndSubmit();

    expect(reportCriticalActionFailure).toHaveBeenCalledTimes(1);
    const [action, error, context] = reportCriticalActionFailure.mock.calls[0];
    expect(action).toBe('account_create');
    expect(error).toBe(err);
    expect(context).toEqual({ errorCode: 'internal' });
  });

  it('does NOT report for an expected already-exists rejection — that is normal, well-understood control flow, not a failure', async () => {
    httpsCallableImpl.mockRejectedValue(Object.assign(new Error('taken'), { code: 'functions/already-exists' }));

    await typeAvailableUsernameAndSubmit();

    expect(reportCriticalActionFailure).not.toHaveBeenCalled();
  });

  it('does NOT report for an expected cooldown rejection', async () => {
    httpsCallableImpl.mockRejectedValue(Object.assign(new Error('cooldown'), { code: 'functions/failed-precondition', details: 'Try again in 5 days.' }));

    await typeAvailableUsernameAndSubmit();

    expect(reportCriticalActionFailure).not.toHaveBeenCalled();
  });

  it('does NOT report for expected server-side moderation rejection', async () => {
    httpsCallableImpl.mockRejectedValue(Object.assign(new Error('not available'), { code: 'functions/invalid-argument', details: 'please choose another name' }));

    await typeAvailableUsernameAndSubmit();

    expect(reportCriticalActionFailure).not.toHaveBeenCalled();
  });

  it('does NOT report for functions/unauthenticated — has its own clear, actionable message', async () => {
    httpsCallableImpl.mockRejectedValue(Object.assign(new Error('nope'), { code: 'functions/unauthenticated' }));

    await typeAvailableUsernameAndSubmit();

    expect(reportCriticalActionFailure).not.toHaveBeenCalled();
  });

  it('reports zero failures on success, and calls onComplete as before', async () => {
    httpsCallableImpl.mockResolvedValue({ data: {} });
    const onComplete = vi.fn();

    await typeAvailableUsernameAndSubmit(onComplete);

    expect(reportCriticalActionFailure).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith('validname123');
  });

  it('user-facing failure behavior is unchanged: shows the existing network-error copy and re-enables the button for retry', async () => {
    httpsCallableImpl.mockRejectedValue(Object.assign(new Error('internal'), { code: 'internal' }));

    const { renderer, button } = await typeAvailableUsernameAndSubmit();

    expect(button.props.disabled).toBe(false);
    const markup = renderer.toJSON();
    expect(JSON.stringify(markup)).toContain(t('name_entry.error_network'));
  });
});
