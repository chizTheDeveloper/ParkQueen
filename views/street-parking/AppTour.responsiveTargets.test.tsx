import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppTour } from './AppTour';

vi.hoisted(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
});

const visibleRect = { top: 100, left: 24, width: 48, height: 48, right: 72, bottom: 148 };
const hiddenRect = { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 };

function target(rect: typeof visibleRect) {
  return { getBoundingClientRect: () => rect };
}

describe('responsive app-tour targets', () => {
  beforeEach(() => {
    localStorage.clear();
    const visible = target(visibleRect);
    const hidden = target(hiddenRect);
    const listeners = new Map<string, Set<(...args: any[]) => void>>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        innerWidth: 375,
        innerHeight: 812,
        matchMedia: () => ({ matches: false }),
        addEventListener: (type: string, handler: (...args: any[]) => void) => {
          const set = listeners.get(type) ?? new Set();
          set.add(handler);
          listeners.set(type, set);
        },
        removeEventListener: (type: string, handler: (...args: any[]) => void) => listeners.get(type)?.delete(handler),
      },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        querySelector: (selector: string) => selector.includes('profile') ? hidden : visible,
        querySelectorAll: (selector: string) => selector.includes('profile') ? [hidden, visible] : [visible],
        activeElement: null,
      },
    });
    (globalThis as any).requestAnimationFrame = (callback: () => void) => { callback(); return 0; };
  });

  it('keeps a tour step when the first responsive duplicate is hidden but another is visible', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AppTour onDone={vi.fn()} />, {
        createNodeMock: () => ({ focus: vi.fn() }),
      });
    });
    const start = renderer!.root.findAllByType('button').find(button => button.children.includes('Start Tour'));
    expect(start).toBeDefined();
    act(() => start!.props.onClick());

    expect(renderer!.root.findByProps({ role: 'dialog' }).props['aria-label']).toBe('App tour, step 1 of 7');
  });
});
