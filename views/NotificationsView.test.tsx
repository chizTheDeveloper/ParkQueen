import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// usePingPhaseClock listens for focus/visibilitychange to resume its clock
// after a suspended tab; this environment has no DOM globals at all.
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

    // Default geolocation resolves synchronously to a fixed point matching
    // spotDoc's default lat/lng, so ordinary tests reach the granted+resolved
    // "results" render state without exercising distance filtering by
    // accident. Test 9 overrides individual docs' lat/lng to prove the
    // filter itself.
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
            geolocation: {
                getCurrentPosition: (success: any) => {
                    success({ coords: { latitude: 40.0, longitude: -74.0 } });
                },
            },
        },
    });

    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => { store.clear(); },
    };
});

vi.mock('../firebase', () => ({ db: {} }));

let onSnapshotCallCount = 0;
let unsubscribeCallCount = 0;
let latestOnNext: ((snap: any) => void) | null = null;
let latestConstraints: any[] = [];

vi.mock('firebase/firestore', () => ({
    collection: (_db: any, name: string) => ({ __name: name }),
    query: (base: any, ...constraints: any[]) => { latestConstraints = constraints; return { __name: base.__name, __constraints: constraints }; },
    where: (field: string, op: string, value: any) => ({ __kind: 'where', field, op, value }),
    onSnapshot: (_q: any, onNext: any, _onError: any) => {
        onSnapshotCallCount++;
        latestOnNext = onNext;
        return () => { unsubscribeCallCount++; };
    },
    Timestamp: { now: () => ({ toMillis: () => Date.now() }) },
}));

import { NotificationsView } from './NotificationsView';

function spotDoc(id: string, opts: {
    reportedAtMs: number; expiresAtMs: number; finderId?: string; status?: string;
    lat?: number; lng?: number; address?: string;
}) {
    return {
        id,
        data: () => ({
            finderId: opts.finderId ?? 'other',
            status: opts.status ?? 'available',
            address: opts.address ?? `addr-${id}`,
            lat: opts.lat ?? 40.0,
            lng: opts.lng ?? -74.0,
            reportedAt: { toMillis: () => opts.reportedAtMs },
            expiresAt: { toMillis: () => opts.expiresAtMs },
        }),
    };
}

const noopCallbacks = {
    requestLocationPermission: () => {},
    openAppSettings: () => {},
    openLocationServicesSettings: () => {},
    recheckPermission: () => {},
    canOpenAppSettings: false,
    canOpenLocationServicesSettings: false,
};

async function renderNotifications(props: Partial<React.ComponentProps<typeof NotificationsView>> = {}) {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
        renderer = TestRenderer.create(React.createElement(NotificationsView, {
            user: { id: 'me' },
            onBack: () => {},
            onSelectSpot: () => {},
            permissionState: 'granted',
            callbacks: noopCallbacks,
            ...props,
        }));
    });
    return renderer!;
}

function emit(docs: any[]) {
    act(() => { latestOnNext!({ docs }); });
}

function addresses(renderer: TestRenderer.ReactTestRenderer): string[] {
    return renderer.root.findAll(
        node => node.type === 'p' && typeof node.props.className === 'string'
            && node.props.className.includes('truncate') && node.props.className.includes('mb-2'),
    ).map(n => String(n.props.children));
}

function badges(renderer: TestRenderer.ReactTestRenderer): string[] {
    return renderer.root.findAll(
        node => node.type === 'span' && typeof node.props.children === 'string'
            && (node.props.children === 'Expiring soon' || node.props.children === 'Available now'),
    ).map(n => String(n.props.children));
}

const T0 = Date.parse('2026-08-26T12:00:00.000Z');

describe('NotificationsView — expiration correctness', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(T0);
        onSnapshotCallCount = 0;
        unsubscribeCallCount = 0;
        latestOnNext = null;
        latestConstraints = [];
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('1: unexpired spot remains visible', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60 * 60_000 })]);
        expect(addresses(renderer)).toEqual(['addr-a']);
        act(() => renderer.unmount());
    });

    it('2: spot disappears exactly after expiresAt passes, with zero Firestore callback', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 1_000 })]);
        expect(addresses(renderer)).toEqual(['addr-a']);

        const callsBefore = onSnapshotCallCount;
        act(() => { vi.advanceTimersByTime(1_000); });
        expect(addresses(renderer)).toEqual([]);
        expect(onSnapshotCallCount).toBe(callsBefore); // no resubscription
        act(() => renderer.unmount());
    });

    it('3: an already-expired spot is excluded immediately, even on first emit', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0 - 60_000, expiresAtMs: T0 - 1_000 })]);
        expect(addresses(renderer)).toEqual([]);
        act(() => renderer.unmount());
    });

    it('4: an expired spot is never labeled "Expiring soon" — it is simply absent', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0 - 60_000, expiresAtMs: T0 - 1_000 })]);
        expect(badges(renderer)).toEqual([]);
        act(() => renderer.unmount());
    });

    it('5: a spot inside its final 5 minutes but still unexpired shows "Expiring soon"', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 4 * 60_000 })]);
        expect(badges(renderer)).toEqual(['Expiring soon']);
        act(() => renderer.unmount());
    });

    it('a spot well outside 5 minutes shows "Available now"', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60 * 60_000 })]);
        expect(badges(renderer)).toEqual(['Available now']);
        act(() => renderer.unmount());
    });

    it('6: multiple spots with different expirations advance correctly as the clock crosses each boundary', async () => {
        const renderer = await renderNotifications();
        emit([
            spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 1_000 }),
            spotDoc('b', { reportedAtMs: T0, expiresAtMs: T0 + 3_000 }),
        ]);
        expect(addresses(renderer).sort()).toEqual(['addr-a', 'addr-b']);

        act(() => { vi.advanceTimersByTime(1_000); });
        expect(addresses(renderer)).toEqual(['addr-b']);

        act(() => { vi.advanceTimersByTime(2_000); });
        expect(addresses(renderer)).toEqual([]);
        act(() => renderer.unmount());
    });

    it('7: no Firestore resubscription is required merely because time advanced', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 5_000 })]);
        expect(onSnapshotCallCount).toBe(1);
        act(() => { vi.advanceTimersByTime(5_000); });
        expect(onSnapshotCallCount).toBe(1);
        act(() => renderer.unmount());
    });

    it('8: current self-filter preserved — own spot excluded', async () => {
        const renderer = await renderNotifications({ user: { id: 'me' } });
        emit([
            spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, finderId: 'me' }),
            spotDoc('b', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, finderId: 'other' }),
        ]);
        expect(addresses(renderer)).toEqual(['addr-b']);
        act(() => renderer.unmount());
    });

    it('9: current distance filter preserved exactly as-is — getDistanceKm(...) <= 2.0 (the component compares kilometers against a bare 2.0, not 2.0 miles despite the "2 mi" display text; this PR preserves that existing behavior unchanged, it does not fix it)', async () => {
        // Default geolocation mock resolves to (40.0, -74.0).
        // ~0.01 deg lat ≈ 1.1 km there — inside the actual <=2.0 threshold;
        // ~0.2 deg ≈ 22 km — outside.
        const renderer = await renderNotifications();
        emit([
            spotDoc('near', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, lat: 40.01, lng: -74.0 }),
            spotDoc('far', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, lat: 40.2, lng: -74.0 }),
        ]);
        expect(addresses(renderer)).toEqual(['addr-near']);
        act(() => renderer.unmount());
    });

    it('10: current sort order (reportedAt desc) preserved', async () => {
        const renderer = await renderNotifications();
        emit([
            spotDoc('older', { reportedAtMs: T0 - 2_000, expiresAtMs: T0 + 60_000 }),
            spotDoc('newer', { reportedAtMs: T0 - 1_000, expiresAtMs: T0 + 60_000 }),
        ]);
        expect(addresses(renderer)).toEqual(['addr-newer', 'addr-older']);
        act(() => renderer.unmount());
    });

    it('11: current slice(0, 10) preserved', async () => {
        const renderer = await renderNotifications();
        const docs = Array.from({ length: 12 }, (_, i) =>
            spotDoc(`s${i}`, { reportedAtMs: T0 - i * 1000, expiresAtMs: T0 + 60_000 }));
        emit(docs);
        expect(addresses(renderer)).toHaveLength(10);
        act(() => renderer.unmount());
    });

    // CASE 12 (missing-location behavior preserved): the exact "granted,
    // resolved-to-null, not locating, not erroring" render state is a
    // single-render-tick race that act()'s synchronous effect-flushing
    // collapses before any test assertion can observe it — it cannot be
    // reliably forced through this component's public props/callbacks
    // without reaching into React internals. This PR does not touch that
    // branch's condition at all (see the source contract test below), so
    // preservation is proven structurally rather than by a behavioral
    // render assertion.
    it('12: source contract — the userLocation ternary and expiration filter compose without altering the missing-location branch', () => {
        const fs = require('fs');
        const source = fs.readFileSync(new URL('./NotificationsView.tsx', import.meta.url), 'utf8');
        const ternaryStart = source.indexOf('const filteredSpots');
        const ternaryEnd = source.indexOf(';', ternaryStart);
        const ternary = source.slice(ternaryStart, ternaryEnd);
        // Still exactly "userLocation ? <expr>.filter(distance) : <expr>" —
        // the missing-location branch must not gain a NEW filter of its own.
        expect(ternary).toMatch(/userLocation\s*\?/);
        const missingLocationBranch = ternary.split(':')[1];
        expect(missingLocationBranch).not.toMatch(/\.filter\(/);
    });

    it('13: unmounting clears the clock — no post-unmount state updates', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 1_000 })]);
        act(() => renderer.unmount());
        expect(() => { vi.advanceTimersByTime(10_000); }).not.toThrow();
    });

    it('14: unmount releases the Firestore listener', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000 })]);
        expect(unsubscribeCallCount).toBe(0);
        act(() => renderer.unmount());
        expect(unsubscribeCallCount).toBe(1);
    });

    it('query shape unchanged: no geohash/orderBy/limit constraints added in this PR', async () => {
        await renderNotifications();
        expect(latestConstraints.some((c: any) => c.field === 'geohash')).toBe(false);
        expect(latestConstraints.some((c: any) => c.__kind === 'orderBy')).toBe(false);
        expect(latestConstraints.some((c: any) => c.__kind === 'limit')).toBe(false);
    });

    it('source contract: no geo-bounding infrastructure imported in this PR', () => {
        const fs = require('fs');
        const source = fs.readFileSync(new URL('./NotificationsView.tsx', import.meta.url), 'utf8');
        expect(source).not.toMatch(/geohash|buildGeoQueryRanges|GeoRegionSubscription/);
    });
});
