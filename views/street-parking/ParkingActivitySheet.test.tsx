import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGeoQueryRanges } from './geoQuery';

// BottomSheet needs window/requestAnimationFrame; this vitest environment
// (environment: 'node') has none of these globals at all.
vi.hoisted(() => {
    const listeners = new Map<string, Set<(e: any) => void>>();
    const eventTarget = {
        addEventListener: (type: string, listener: (e: any) => void) => {
            const handlers = listeners.get(type) ?? new Set();
            handlers.add(listener);
            listeners.set(type, handlers);
        },
        removeEventListener: (type: string, listener: (e: any) => void) => listeners.get(type)?.delete(listener),
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: eventTarget });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { ...eventTarget, visibilityState: 'visible' } });
    (globalThis as any).requestAnimationFrame = (cb: () => void) => { cb(); return 0; };
    (globalThis as any).cancelAnimationFrame = () => {};

    // i18n's resolveInitialLang() reads localStorage at module import time.
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => { store.clear(); },
    };
});

vi.mock('../../firebase', () => ({ db: {} }));

interface PendingCall {
    constraints: any[];
    resolve: (docs: any[]) => void;
    reject: (err: unknown) => void;
}
let pendingCalls: PendingCall[] = [];
// When set, every getDocs call auto-resolves immediately with these docs —
// the common case. Set to null to take manual control (async-safety /
// partial-failure tests) via `pendingCalls`.
let broadcastDocs: any[] | null = [];

vi.mock('firebase/firestore', () => ({
    collection: (_db: any, name: string) => ({ __name: name }),
    query: (base: any, ...constraints: any[]) => ({ __name: base.__name, __constraints: constraints }),
    where: (field: string, op: string, value: any) => ({ __kind: 'where', field, op, value }),
    orderBy: (field: string) => ({ __kind: 'orderBy', field }),
    getDocs: (q: any) => new Promise((resolve, reject) => {
        const call: PendingCall = {
            constraints: q.__constraints,
            resolve: (docs: any[]) => resolve({ docs }),
            reject,
        };
        pendingCalls.push(call);
        if (broadcastDocs !== null) call.resolve(broadcastDocs);
    }),
    Timestamp: { now: () => ({ toMillis: () => Date.now() }) },
}));

import { ParkingActivitySheet } from './ParkingActivitySheet';

function spotDoc(id: string, opts: {
    reportedAtMs: number; expiresAtMs: number; status?: string; lat?: number; lng?: number; interestedUserId?: string;
}) {
    return {
        id,
        data: () => ({
            status: opts.status ?? 'available',
            lat: opts.lat ?? 40.0,
            lng: opts.lng ?? -74.0,
            reportedAt: { toMillis: () => opts.reportedAtMs },
            expiresAt: { toMillis: () => opts.expiresAtMs },
            interestedUserId: opts.interestedUserId,
        }),
    };
}

const T0 = Date.parse('2026-08-27T12:00:00.000Z');
const CENTER_LAT = 40.0;
const CENTER_LNG = -74.0;
const KM_PER_MILE = 1.609344;
const EARTH_RADIUS_KM = 6371;

// Same exact (non-approximated) inverse-haversine trick used for
// NotificationsView's distance-unit fixtures: for a pure north-south offset
// (lng held constant), haversine reduces to distanceKm = R * dLatRadians
// exactly.
function latOffsetForMiles(miles: number): number {
    const km = miles * KM_PER_MILE;
    return CENTER_LAT + (km / EARTH_RADIUS_KM) * (180 / Math.PI);
}

const destinationAt = (lat: number, lng: number, name = 'Times Square') => ({
    name, fullName: `${name}, NY`, center: [lng, lat] as [number, number],
});

async function renderSheet(props: Partial<React.ComponentProps<typeof ParkingActivitySheet>> = {}) {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
        renderer = TestRenderer.create(React.createElement(ParkingActivitySheet, {
            destination: destinationAt(CENTER_LAT, CENTER_LNG),
            onExplore: () => {},
            onDismiss: () => {},
            nowMs: T0,
            ...props,
        }));
    });
    return renderer!;
}

function text(renderer: TestRenderer.ReactTestRenderer): string {
    return renderer.root.findAll(n => n.type === 'p').map(n => String(n.props.children)).join(' | ');
}

function statValue(renderer: TestRenderer.ReactTestRenderer, label: string): string | null {
    const rows = renderer.root.findAll(n => n.type === 'div' && typeof n.props.className === 'string' && n.props.className.includes('justify-between'));
    for (const row of rows) {
        const spans = row.findAll(n => n.type === 'span');
        if (spans.length >= 2 && String(spans[0].props.children) === label) {
            return String(spans[1].props.children);
        }
    }
    return null;
}

describe('ParkingActivitySheet — geo-bound fetch', () => {
    beforeEach(() => {
        pendingCalls = [];
        broadcastDocs = [];
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    describe('baseline behavior preserved', () => {
        it('counts an unclaimed live spot as an active ping', async () => {
            broadcastDocs = [spotDoc('a', { reportedAtMs: T0 - 60_000, expiresAtMs: T0 + 60 * 60_000 })];
            const renderer = await renderSheet();
            expect(statValue(renderer, 'Active Pings')).toBe('1');
            act(() => renderer.unmount());
        });

        it('counts a scheduled ("leaving later") spot separately from active pings', async () => {
            broadcastDocs = [spotDoc('a', { reportedAtMs: T0 + 5 * 60_000, expiresAtMs: T0 + 60 * 60_000 })];
            const renderer = await renderSheet();
            expect(statValue(renderer, 'Active Pings')).toBe('0');
            expect(statValue(renderer, 'Leaving later')).toBe('1');
            act(() => renderer.unmount());
        });

        it('an expired spot (per derivePingLifecycle at the given nowMs) is excluded from both counts', async () => {
            broadcastDocs = [spotDoc('a', { reportedAtMs: T0 - 120_000, expiresAtMs: T0 - 60_000 })];
            const renderer = await renderSheet();
            expect(statValue(renderer, 'Active Pings')).toBeNull();
            expect(text(renderer)).toContain('No parking activity near');
            act(() => renderer.unmount());
        });

        it('an occupied-status spot is excluded (existing client-side guard preserved)', async () => {
            broadcastDocs = [spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, status: 'occupied' })];
            const renderer = await renderSheet();
            expect(text(renderer)).toContain('No parking activity near');
            act(() => renderer.unmount());
        });

        it('a spot with no self/blocked-user filtering applied — every visible spot counts (no user prop exists on this component)', async () => {
            broadcastDocs = [
                spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000 }),
                spotDoc('b', { reportedAtMs: T0, expiresAtMs: T0 + 60_000 }),
            ];
            const renderer = await renderSheet();
            expect(statValue(renderer, 'Active Pings')).toBe('2');
            act(() => renderer.unmount());
        });

        it('empty state shows when there is no qualifying activity', async () => {
            broadcastDocs = [];
            const renderer = await renderSheet();
            expect(text(renderer)).toContain('No parking activity near');
            act(() => renderer.unmount());
        });

        it('a query failure falls back to the existing empty-looking error path, not a crash', async () => {
            broadcastDocs = null;
            const renderer = await renderSheet();
            await act(async () => {
                pendingCalls.forEach(c => c.reject(new Error('boom')));
                for (let i = 0; i < 8; i++) await Promise.resolve();
            });
            expect(text(renderer)).toContain('No parking activity near');
            act(() => renderer.unmount());
        });

        it('refetches when destination changes', async () => {
            broadcastDocs = [spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000 })];
            const renderer = await renderSheet({ destination: destinationAt(40.0, -74.0) });
            const callsAfterFirst = pendingCalls.length;
            expect(callsAfterFirst).toBeGreaterThan(0);

            broadcastDocs = [];
            await act(async () => {
                renderer.update(React.createElement(ParkingActivitySheet, {
                    destination: destinationAt(41.0, -73.0),
                    onExplore: () => {}, onDismiss: () => {}, nowMs: T0,
                }));
                for (let i = 0; i < 8; i++) await Promise.resolve();
            });
            expect(pendingCalls.length).toBeGreaterThan(callsAfterFirst);
            expect(text(renderer)).toContain('No parking activity near');
            act(() => renderer.unmount());
        });
    });

    describe('geo-bound query architecture', () => {
        it('issues one getDocs per geohash range from buildGeoQueryRanges(lat, lng, 1mi) for the destination', async () => {
            const expectedRanges = [...buildGeoQueryRanges(CENTER_LAT, CENTER_LNG, 1)].sort((a, b) => a.start.localeCompare(b.start));
            const renderer = await renderSheet();

            expect(pendingCalls.length).toBe(expectedRanges.length);
            const actualRanges = pendingCalls.map(c => {
                const gte = c.constraints.find((x: any) => x.field === 'geohash' && x.op === '>=');
                const lte = c.constraints.find((x: any) => x.field === 'geohash' && x.op === '<=');
                return { start: gte.value, end: lte.value };
            }).sort((a, b) => a.start.localeCompare(b.start));
            expect(actualRanges).toEqual(expectedRanges);
            act(() => renderer.unmount());
        });

        it('each per-range query preserves status/expiresAt filters and adds geohash bounds + orderBy(geohash), with no limit', async () => {
            const renderer = await renderSheet();
            expect(pendingCalls.length).toBeGreaterThan(0);
            pendingCalls.forEach(c => {
                expect(c.constraints.some((x: any) =>
                    x.field === 'status' && x.op === 'in' && JSON.stringify(x.value) === JSON.stringify(['available', 'interested']),
                )).toBe(true);
                expect(c.constraints.some((x: any) => x.field === 'expiresAt' && x.op === '>')).toBe(true);
                expect(c.constraints.some((x: any) => x.field === 'geohash' && x.op === '>=')).toBe(true);
                expect(c.constraints.some((x: any) => x.field === 'geohash' && x.op === '<=')).toBe(true);
                expect(c.constraints.some((x: any) => x.__kind === 'orderBy' && x.field === 'geohash')).toBe(true);
                expect(c.constraints.some((x: any) => x.__kind === 'limit')).toBe(false);
            });
            act(() => renderer.unmount());
        });

        it('every range in one fetch shares the exact same expiresAt Timestamp — not recomputed per range', async () => {
            const renderer = await renderSheet();
            const timestamps = pendingCalls.map(c => c.constraints.find((x: any) => x.field === 'expiresAt')?.value);
            expect(timestamps.length).toBeGreaterThan(0);
            expect(new Set(timestamps).size).toBe(1);
            act(() => renderer.unmount());
        });

        it('a document returned by two overlapping ranges is counted exactly once', async () => {
            broadcastDocs = null;
            const renderer = await renderSheet();
            const dup = spotDoc('dup', { reportedAtMs: T0, expiresAtMs: T0 + 60_000 });
            await act(async () => {
                pendingCalls.forEach(c => c.resolve([dup]));
                for (let i = 0; i < 8; i++) await Promise.resolve();
            });
            expect(statValue(renderer, 'Active Pings')).toBe('1');
            act(() => renderer.unmount());
        });

        it('a geohash false-positive (returned by a range but outside the true 1-mile radius) is excluded by the exact-distance filter', async () => {
            broadcastDocs = [spotDoc('far', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, lat: latOffsetForMiles(2.0), lng: CENTER_LNG })];
            const renderer = await renderSheet();
            expect(text(renderer)).toContain('No parking activity near');
            act(() => renderer.unmount());
        });

        it('a spot just inside the true 1-mile radius is retained', async () => {
            broadcastDocs = [spotDoc('near', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, lat: latOffsetForMiles(0.9), lng: CENTER_LNG })];
            const renderer = await renderSheet();
            expect(statValue(renderer, 'Active Pings')).toBe('1');
            act(() => renderer.unmount());
        });

        it('source contract: the old bare/citywide query is replaced by geo-bounded per-range queries', () => {
            const fs = require('fs');
            const source = fs.readFileSync(new URL('./ParkingActivitySheet.tsx', import.meta.url), 'utf8');
            expect(source).toMatch(/buildGeoQueryRanges/);
            expect(source).toMatch(/geohash/);
        });
    });

    describe('async safety', () => {
        it('a stale in-flight fetch for a previous destination cannot overwrite the current destination\'s results', async () => {
            broadcastDocs = null;
            const renderer = await renderSheet({ destination: destinationAt(40.0, -74.0) });
            const callsForA = [...pendingCalls];
            expect(callsForA.length).toBeGreaterThan(0);

            await act(async () => {
                renderer.update(React.createElement(ParkingActivitySheet, {
                    destination: destinationAt(41.0, -73.0),
                    onExplore: () => {}, onDismiss: () => {}, nowMs: T0,
                }));
            });
            const callsForB = pendingCalls.slice(callsForA.length);
            expect(callsForB.length).toBeGreaterThan(0);

            const spotB = spotDoc('b', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, lat: 41.0, lng: -73.0 });
            await act(async () => {
                callsForB.forEach(c => c.resolve([spotB]));
                for (let i = 0; i < 8; i++) await Promise.resolve();
            });
            expect(statValue(renderer, 'Active Pings')).toBe('1');

            const spotA = spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000 });
            await act(async () => {
                callsForA.forEach(c => c.resolve([spotA]));
                for (let i = 0; i < 8; i++) await Promise.resolve();
            });
            // Late A result must not overwrite B's already-displayed results.
            expect(statValue(renderer, 'Active Pings')).toBe('1');
            act(() => renderer.unmount());
        });

        it('unmounting before the fetch resolves causes no post-unmount state update or error', async () => {
            broadcastDocs = null;
            const renderer = await renderSheet();
            const calls = [...pendingCalls];
            act(() => renderer.unmount());
            await act(async () => {
                expect(() => calls.forEach(c => c.resolve([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000 })]))).not.toThrow();
                await Promise.resolve();
            });
        });
    });

    describe('partial range failure', () => {
        it('one range query rejecting fails the whole fetch — no partial result is shown as if it were complete', async () => {
            broadcastDocs = null;
            const renderer = await renderSheet();
            const calls = [...pendingCalls];
            expect(calls.length).toBeGreaterThan(1);

            await act(async () => {
                calls[0].resolve([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000 })]);
                calls[1].reject(new Error('range failed'));
                calls.slice(2).forEach(c => c.resolve([]));
                for (let i = 0; i < 8; i++) await Promise.resolve();
            });
            expect(text(renderer)).toContain('No parking activity near');
            act(() => renderer.unmount());
        });
    });
});
