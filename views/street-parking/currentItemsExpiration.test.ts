import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal window/document polyfill — usePingPhaseClock listens for
// focus/visibilitychange to resume its clock after a suspended tab, and this
// vitest environment has no DOM globals at all (not even jsdom).
vi.hoisted(() => {
    const listeners = new Map<string, Set<() => void>>();
    const eventTarget = {
        addEventListener: (type: string, listener: () => void) => {
            const handlers = listeners.get(type) ?? new Set();
            handlers.add(listener);
            listeners.set(type, handlers);
        },
        removeEventListener: (type: string, listener: () => void) => listeners.get(type)?.delete(listener),
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: eventTarget });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { ...eventTarget, visibilityState: 'visible' } });
});

import { usePingPhaseClock } from './usePingPhaseClock';
import { derivePingLifecycle } from '../../utils/pingLifecycle';

/**
 * Mirrors StreetParkingView.tsx's `currentItems` derivation exactly:
 *   const nowMs = usePingPhaseClock(radiusFilteredItems);
 *   const currentItems = radiusFilteredItems.filter(item => !derivePingLifecycle(item, nowMs, viewerId).expired);
 *
 * This proves — independent of any map/Firestore rendering — that a spot
 * already disappears from the rendered candidate set at its expiresAt
 * boundary, driven only by a locally self-rescheduling timer
 * (createPingPhaseClock), with zero Firestore snapshot activity involved.
 */
function useCurrentItems(items: any[], viewerId?: string) {
    const nowMs = usePingPhaseClock(items);
    return items.filter(item => !derivePingLifecycle(item, nowMs, viewerId).expired);
}

function Harness({ items, onResult }: { items: any[]; onResult: (ids: string[]) => void }) {
    const current = useCurrentItems(items);
    onResult(current.map(i => i.id));
    return null;
}

function spot(id: string, expiresAtMs: number, status: 'available' | 'occupied' = 'available') {
    return { id, status, reportedAt: { toMillis: () => 0 }, expiresAt: { toMillis: () => expiresAtMs } };
}

const T0 = Date.parse('2026-08-25T12:00:00.000Z');

describe('currentItems expiration filtering (no Firestore snapshot activity required)', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('CASE 1: unexpired spot remains visible before expiresAt', () => {
        vi.setSystemTime(T0);
        let latest: string[] = [];
        act(() => {
            TestRenderer.create(React.createElement(Harness, { items: [spot('A', T0 + 60_000)], onResult: r => { latest = r; } }));
        });
        expect(latest).toEqual(['A']);
    });

    it('CASE 2: spot disappears once wall-clock crosses expiresAt, with zero snapshot/prop activity — only the timer fires', () => {
        vi.setSystemTime(T0);
        let latest: string[] = [];
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(React.createElement(Harness, { items: [spot('A', T0 + 1_000)], onResult: r => { latest = r; } }));
        });
        expect(latest).toEqual(['A']);

        act(() => { vi.advanceTimersByTime(1_000); }); // no new props, no re-render trigger except the internal clock
        expect(latest).toEqual([]);
        act(() => renderer!.unmount());
    });

    it('CASE 3: two spots with different expirations — first disappears, second remains, then second disappears', () => {
        vi.setSystemTime(T0);
        let latest: string[] = [];
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(React.createElement(Harness, {
                items: [spot('A', T0 + 1_000), spot('B', T0 + 3_000)],
                onResult: r => { latest = r; },
            }));
        });
        expect(latest.sort()).toEqual(['A', 'B']);

        act(() => { vi.advanceTimersByTime(1_000); });
        expect(latest).toEqual(['B']);

        act(() => { vi.advanceTimersByTime(2_000); });
        expect(latest).toEqual([]);
        act(() => renderer!.unmount());
    });

    it('CASE 4: candidate-set update introduces an earlier expiration — timer reschedules to the new, earlier boundary', () => {
        vi.setSystemTime(T0);
        let latest: string[] = [];
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(React.createElement(Harness, { items: [spot('A', T0 + 10_000)], onResult: r => { latest = r; } }));
        });

        act(() => {
            renderer!.update(React.createElement(Harness, { items: [spot('A', T0 + 10_000), spot('B', T0 + 500)], onResult: r => { latest = r; } }));
        });

        act(() => { vi.advanceTimersByTime(500); });
        expect(latest).toEqual(['A']); // B (the newly-introduced earlier boundary) is gone; A remains
        act(() => renderer!.unmount());
    });

    it('CASE 5: candidate-set update removes the earliest-expiring spot — timer reschedules to the next one', () => {
        vi.setSystemTime(T0);
        let latest: string[] = [];
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(React.createElement(Harness, {
                items: [spot('A', T0 + 1_000), spot('B', T0 + 3_000)],
                onResult: r => { latest = r; },
            }));
        });

        // Region promotion (or any prop update) removes A before it ever fires.
        act(() => {
            renderer!.update(React.createElement(Harness, { items: [spot('B', T0 + 3_000)], onResult: r => { latest = r; } }));
        });

        act(() => { vi.advanceTimersByTime(3_000); });
        expect(latest).toEqual([]); // B's boundary still fires correctly after the rescheduling
        act(() => renderer!.unmount());
    });

    it('CASE 6: an already-expired candidate is excluded immediately, before any timer tick', () => {
        vi.setSystemTime(T0);
        let latest: string[] = [];
        act(() => {
            TestRenderer.create(React.createElement(Harness, { items: [spot('A', T0 - 1)], onResult: r => { latest = r; } }));
        });
        expect(latest).toEqual([]);
    });

    it('CASE 7: unmount cancels the pending timer cleanly (no error, no further ticks)', () => {
        vi.setSystemTime(T0);
        let renderCount = 0;
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(React.createElement(Harness, {
                items: [spot('A', T0 + 1_000)],
                onResult: () => { renderCount++; },
            }));
        });
        const countAtUnmount = renderCount;

        expect(() => act(() => renderer!.unmount())).not.toThrow();
        act(() => { vi.advanceTimersByTime(5_000); });
        expect(renderCount).toBe(countAtUnmount); // no post-unmount onResult calls
    });

    it('CASE 10 (source contract): this expiration layer never imports firebase/firestore — a firing timer cannot cause a Firestore re-subscription', () => {
        const fs = require('node:fs');
        for (const file of ['usePingPhaseClock.ts', '../../utils/pingLifecycle.ts']) {
            const abs = new URL(file, import.meta.url);
            const source = fs.readFileSync(abs, 'utf8');
            expect(source).not.toMatch(/firebase\/firestore/);
        }
    });

    it('source contract: StreetParkingView.tsx actually derives currentItems via this exact usePingPhaseClock + derivePingLifecycle composition, so the behavioral tests above track production, not a parallel reimplementation', () => {
        const fs = require('node:fs');
        const source = fs.readFileSync(new URL('../StreetParkingView.tsx', import.meta.url), 'utf8');

        // Same source, same live data feed (radiusFilteredItems), driving the clock.
        expect(source).toMatch(/usePingPhaseClock\(\s*spotData\.radiusFilteredItems\s*\)/);
        // Same filter predicate this suite exercises via useCurrentItems() above.
        expect(source).toMatch(/spotData\.radiusFilteredItems\.filter\(\s*item\s*=>\s*!derivePingLifecycle\(\s*item,\s*nowMs,\s*user\?\.id\s*\)\.expired\s*\)/);
    });
});
