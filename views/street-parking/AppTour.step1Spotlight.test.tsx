import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppTour } from './AppTour';

// Step 1 points at the nav's central Ping button. That button's layout box is not
// what the user sees: it also covers the "Ping" text label, and its round face is
// absolutely positioned ~25px above the box. Measuring the button produced a 89x90
// oval centred 24px below the circle, spilling into the bottom nav. The fix is a
// `data-tour-spotlight` anchor on the round face; these tests pin that behaviour
// and pin that every other step still uses the plain anchor.

vi.hoisted(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
});

const VW = 390;
const VH = 844;

// Real geometry measured from the rendered nav at 390x844.
const PING_BUTTON = { top: 759, left: 161, width: 69, height: 70, right: 230, bottom: 829 };
const PING_CORE = { top: 740, left: 165, width: 60, height: 60, right: 225, bottom: 800 };
const NAV_SURFACE_TOP = 750;
const NEARBY_ITEM = { left: 92, right: 161, centre: 126 };
const MESSAGES_ITEM = { left: 229, right: 298, centre: 263 };
// A generic header target: wide, near the top, no spotlight anchor.
const SEARCH_BAR = { top: 16, left: 16, width: 355, height: 54, right: 371, bottom: 70 };

const asTarget = (rect: { top: number; left: number; width: number; height: number }) => ({
  getBoundingClientRect: () => rect,
});

function mountTour(opts: { spotlightAnchor: boolean }) {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      innerWidth: VW,
      innerHeight: VH,
      matchMedia: () => ({ matches: false }),
      addEventListener: (type: string, handler: (...args: any[]) => void) => {
        const set = listeners.get(type) ?? new Set();
        set.add(handler);
        listeners.set(type, set);
      },
      removeEventListener: (type: string, handler: (...args: any[]) => void) => listeners.get(type)?.delete(handler),
    },
  });

  const resolve = (selector: string) => {
    if (selector.includes('data-tour-spotlight')) {
      // Only the Ping step opts into a precise anchor.
      return opts.spotlightAnchor && selector.includes('share-spot') ? [asTarget(PING_CORE)] : [];
    }
    if (selector.includes('share-spot')) return [asTarget(PING_BUTTON)];
    return [asTarget(SEARCH_BAR)];
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      querySelector: (selector: string) => resolve(selector)[0] ?? null,
      querySelectorAll: (selector: string) => resolve(selector),
      activeElement: null,
    },
  });
  (globalThis as any).requestAnimationFrame = (callback: () => void) => { callback(); return 0; };

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<AppTour onDone={vi.fn()} />, { createNodeMock: () => ({ focus: vi.fn() }) });
  });
  const start = renderer.root.findAllByType('button').find(b => b.children.includes('Start Tour'));
  act(() => start!.props.onClick());
  return renderer;
}

/** The spotlight is the aria-hidden fixed layer carrying the 9999px scrim shadow. */
function spotlight(renderer: TestRenderer.ReactTestRenderer) {
  const node = renderer.root.findAll(n =>
    n.type === 'div' && typeof n.props.style?.boxShadow === 'string' && n.props.style.boxShadow.includes('9999px'))[0];
  const s = node.props.style;
  return { top: s.top as number, left: s.left as number, width: s.width as number, height: s.height as number };
}

function card(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByProps({ role: 'dialog' }).props.style;
}

describe('app tour — step 1 spotlight on the central Ping control', () => {
  beforeEach(() => localStorage.clear());

  it('measures the round Ping face, not the button box that carries the label', () => {
    const ring = spotlight(mountTour({ spotlightAnchor: true }));
    const ringCentreY = ring.top + ring.height / 2;
    const coreCentreY = PING_CORE.top + PING_CORE.height / 2;

    // Centred on what the user sees, not 24px below it.
    expect(ringCentreY).toBe(coreCentreY);
    expect(ring.left + ring.width / 2).toBe(PING_CORE.left + PING_CORE.width / 2);
    // Would be 90 tall if it were still measuring the button box.
    expect(ring.height).toBeLessThan(PING_BUTTON.height + 20);
  });

  it('is circular with modest padding and excludes the decorative outer glow', () => {
    const ring = spotlight(mountTour({ spotlightAnchor: true }));
    expect(ring.width).toBe(ring.height);
    const pad = (ring.width - PING_CORE.width) / 2;
    expect(pad).toBeGreaterThanOrEqual(6);
    expect(pad).toBeLessThanOrEqual(10);
  });

  it('does not cover the neighbouring nav items', () => {
    const ring = spotlight(mountTour({ spotlightAnchor: true }));
    expect(ring.left).toBeGreaterThan(NEARBY_ITEM.centre);
    expect(ring.left + ring.width).toBeLessThan(MESSAGES_ITEM.centre);
  });

  it('places the card above the nav with a 16-20px gap and no overlap', () => {
    const renderer = mountTour({ spotlightAnchor: true });
    const ring = spotlight(renderer);
    const style = card(renderer);

    // Anchored from the viewport bottom, i.e. above the target.
    expect(style.top).toBeUndefined();
    const cardBottomFromTop = VH - (style.bottom as number);
    const gap = ring.top - cardBottomFromTop;
    expect(gap).toBeGreaterThanOrEqual(16);
    expect(gap).toBeLessThanOrEqual(20);
    expect(cardBottomFromTop).toBeLessThan(ring.top);
    expect(cardBottomFromTop).toBeLessThan(NAV_SURFACE_TOP);
  });

  it('derives placement from measured geometry, not a hardcoded screen height', () => {
    const tall = spotlight(mountTour({ spotlightAnchor: true }));
    expect(tall.top).toBe(PING_CORE.top - 8);
  });

  it('falls back to the plain tour anchor when no spotlight anchor is rendered', () => {
    // Desktop: the nav (and its spotlight anchor) is display:none, so the wide
    // desktop CTA is measured instead and keeps the original padding.
    const ring = spotlight(mountTour({ spotlightAnchor: false }));
    expect(ring.width).toBe(PING_BUTTON.width + 20);
    expect(ring.height).toBe(PING_BUTTON.height + 20);
    expect(ring.width).not.toBe(ring.height);
  });
});

describe('app tour — steps 2-7 keep their existing placement strategy', () => {
  beforeEach(() => localStorage.clear());

  it('uses 10px padding, a free aspect ratio and a 14px card gap', () => {
    const renderer = mountTour({ spotlightAnchor: true });
    act(() => {
      renderer.root.findAllByType('button').find(b => b.children.includes('Next'))!.props.onClick();
    });

    const ring = spotlight(renderer);
    expect(ring.width).toBe(SEARCH_BAR.width + 20);
    expect(ring.height).toBe(SEARCH_BAR.height + 20);
    expect(ring.width).not.toBe(ring.height);

    // Target sits in the top half, so the card goes below it with the original gap.
    const style = card(renderer);
    expect(style.bottom).toBeUndefined();
    expect(style.top).toBe(ring.top + ring.height + 14);
  });
});
