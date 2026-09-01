import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingView } from './OnboardingView';

vi.hoisted(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
});

function installMotionPreference(matches: boolean) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: () => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    },
  });
}

function pingMarkers(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(node =>
    node.type === 'svg' && (node.props.style?.width === 44 || node.props.style?.width === 38),
  );
}

function advanceToSlideTwo(renderer: TestRenderer.ReactTestRenderer) {
  const getStarted = renderer.root.findAllByType('button')
    .find(button => button.children.includes('Get Started'));
  expect(getStarted).toBeDefined();
  act(() => getStarted!.props.onClick());
}

describe('onboarding screen 2 ping sequence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    installMotionPreference(false);
  });

  afterEach(() => vi.useRealTimers());

  it('shows the first ping promptly and completes the compact three-ping reveal', () => {
    const renderer = TestRenderer.create(<OnboardingView onComplete={vi.fn()} />);
    advanceToSlideTwo(renderer);

    act(() => { vi.advanceTimersByTime(300); });
    expect(pingMarkers(renderer)).toHaveLength(1);

    act(() => { vi.advanceTimersByTime(700); });
    expect(pingMarkers(renderer)).toHaveLength(3);
  });

  it('shows the complete static state when reduced motion is requested', () => {
    installMotionPreference(true);
    const renderer = TestRenderer.create(<OnboardingView onComplete={vi.fn()} />);
    advanceToSlideTwo(renderer);
    expect(pingMarkers(renderer)).toHaveLength(3);
  });
});
