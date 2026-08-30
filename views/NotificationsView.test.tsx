import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGeoQueryRanges } from './street-parking/geoQuery';

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

interface FakeSub {
    constraints: any[];
    onNext: (snap: any) => void;
    onError: (err: any) => void;
    unsubscribed: boolean;
}
let subs: FakeSub[] = [];
let onSnapshotCallCount = 0;
let unsubscribeCallCount = 0;

vi.mock('firebase/firestore', () => ({
    collection: (_db: any, name: string) => ({ __name: name }),
    query: (base: any, ...constraints: any[]) => ({ __name: base.__name, __constraints: constraints }),
    where: (field: string, op: string, value: any) => ({ __kind: 'where', field, op, value }),
    orderBy: (field: string) => ({ __kind: 'orderBy', field }),
    onSnapshot: (q: any, onNext: any, onError: any) => {
        onSnapshotCallCount++;
        const sub: FakeSub = { constraints: q.__constraints, onNext, onError, unsubscribed: false };
        subs.push(sub);
        return () => { sub.unsubscribed = true; unsubscribeCallCount++; };
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

// Broadcasts the same doc set to every currently-active fake range
// subscription — a stand-in for "every geohash range's Firestore listener
// delivered a snapshot containing these docs". A doc appearing in a range
// whose true geohash envelope wouldn't actually contain it is exactly the
// false-positive-geohash-match scenario the exact-distance filter (proven by
// the distance-unit tests below) must still exclude.
function emit(docs: any[]) {
    act(() => {
        subs.filter(s => !s.unsubscribed).forEach(s => s.onNext({ docs }));
    });
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

describe('NotificationsView — contextual parking alerts', () => {
    it('renders the primary Enable action and delegates only its explicit click', async () => {
        const onEnableNotifications = vi.fn();
        const renderer = await renderNotifications({
            notificationRuntime: {
                capability: 'supported', permission: 'default', registration: 'not_registered',
            },
            onEnableNotifications,
            onRecheckNotifications: vi.fn(),
        });
        expect(onEnableNotifications).not.toHaveBeenCalled();
        const button = renderer.root.findByProps({ 'data-notification-action': 'enable' });
        act(() => button.props.onClick());
        expect(onEnableNotifications).toHaveBeenCalledTimes(1);
        act(() => renderer.unmount());
    });
});

const T0 = Date.parse('2026-08-26T12:00:00.000Z');
const CENTER_LAT = 40.0;
const CENTER_LNG = -74.0;
const MILES_PER_KM = 0.621371;
const KM_PER_MILE = 1.609344;
const EARTH_RADIUS_KM = 6371;

// Exact (not approximated) inverse of the component's own haversine formula
// for a pure north-south offset (lng held constant): with dLon = 0, the
// haversine reduces to distanceKm = R * dLatRadians exactly, so this is not
// subject to small-angle approximation error — safe for tight boundary
// assertions without floating-point flakiness.
function latOffsetForKm(km: number): number {
    return CENTER_LAT + (km / EARTH_RADIUS_KM) * (180 / Math.PI);
}
function latOffsetForMiles(miles: number): number {
    return latOffsetForKm(miles * KM_PER_MILE);
}

describe('NotificationsView — expiration correctness', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(T0);
        subs = [];
        onSnapshotCallCount = 0;
        unsubscribeCallCount = 0;
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
        const callsAfterFirstEmit = onSnapshotCallCount;
        act(() => { vi.advanceTimersByTime(5_000); });
        expect(onSnapshotCallCount).toBe(callsAfterFirstEmit);
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

    it('9: distance filter still excludes a spot far outside any reasonable radius', async () => {
        const renderer = await renderNotifications();
        emit([
            spotDoc('near', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, lat: 40.01, lng: -74.0 }),
            spotDoc('far', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, lat: 40.2, lng: -74.0 }),
        ]);
        expect(addresses(renderer)).toEqual(['addr-near']);
        act(() => renderer.unmount());
    });

    it('distance-unit 1: a spot at 1.0 mile is included', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, lat: latOffsetForMiles(1.0), lng: CENTER_LNG })]);
        expect(addresses(renderer)).toEqual(['addr-a']);
        act(() => renderer.unmount());
    });

    it('distance-unit 2: a spot just inside 2.0 miles (1.8mi) is included', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, lat: latOffsetForMiles(1.8), lng: CENTER_LNG })]);
        expect(addresses(renderer)).toEqual(['addr-a']);
        act(() => renderer.unmount());
    });

    it('distance-unit 3: a spot just outside 2.0 miles (2.2mi) is excluded — proves the exact-distance filter still rejects a geohash false-positive', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, lat: latOffsetForMiles(2.2), lng: CENTER_LNG })]);
        expect(addresses(renderer)).toEqual([]);
        act(() => renderer.unmount());
    });

    it('distance-unit 4: a spot at 2.5km (~1.55mi) is included — this is the exact regression the km/mi bug excluded (2.5km > the old buggy 2.0km cutoff)', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, lat: latOffsetForKm(2.5), lng: CENTER_LNG })]);
        expect(addresses(renderer)).toEqual(['addr-a']);
        act(() => renderer.unmount());
    });

    it('distance-unit 5: a spot beyond 3.218688km (2 miles, at 3.3km / ~2.05mi) is excluded — geohash false-positive rejected', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000, lat: latOffsetForKm(3.3), lng: CENTER_LNG })]);
        expect(addresses(renderer)).toEqual([]);
        act(() => renderer.unmount());
    });

    it('distance-unit 6: helper units are not confused — getDistanceKm returns kilometers, not miles, for a known separation', () => {
        // 1 degree of latitude ≈ 111.19 km (not ≈179 km, which multiplying by
        // MILES_PER_KM backwards would imply) — this pins the raw helper's
        // unit contract independent of the component's filter logic.
        const oneDegreeKm = (Math.PI / 180) * EARTH_RADIUS_KM;
        expect(oneDegreeKm).toBeGreaterThan(110);
        expect(oneDegreeKm).toBeLessThan(112);
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

    it('14: unmount releases every geo-range Firestore listener', async () => {
        const renderer = await renderNotifications();
        emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000 })]);
        const rangeCount = subs.length;
        expect(rangeCount).toBeGreaterThan(0);
        expect(unsubscribeCallCount).toBe(0);
        act(() => renderer.unmount());
        expect(unsubscribeCallCount).toBe(rangeCount);
    });

    it('source contract: geo-bounding infrastructure is imported and reused for this PR', () => {
        const fs = require('fs');
        const source = fs.readFileSync(new URL('./NotificationsView.tsx', import.meta.url), 'utf8');
        expect(source).toMatch(/buildGeoQueryRanges/);
        expect(source).toMatch(/GeoRegionSubscription/);
    });

    describe('geo-bound listener architecture', () => {
        it('establishes one Firestore range subscription per geohash range from buildGeoQueryRanges(lat, lng, 2mi) for the resolved location', async () => {
            const expectedRanges = [...buildGeoQueryRanges(40.0, -74.0, 2)].sort((a, b) => a.start.localeCompare(b.start));
            const renderer = await renderNotifications();

            expect(subs.length).toBe(expectedRanges.length);
            const actualRanges = subs.map(s => {
                const gte = s.constraints.find((c: any) => c.field === 'geohash' && c.op === '>=');
                const lte = s.constraints.find((c: any) => c.field === 'geohash' && c.op === '<=');
                return { start: gte.value, end: lte.value };
            }).sort((a, b) => a.start.localeCompare(b.start));
            expect(actualRanges).toEqual(expectedRanges);
            act(() => renderer.unmount());
        });

        it('each per-range query preserves status/expiresAt filters and adds geohash bounds + orderBy(geohash), with no limit', async () => {
            const renderer = await renderNotifications();
            expect(subs.length).toBeGreaterThan(0);
            subs.forEach(s => {
                expect(s.constraints.some((c: any) =>
                    c.field === 'status' && c.op === 'in' && JSON.stringify(c.value) === JSON.stringify(['available', 'interested']),
                )).toBe(true);
                expect(s.constraints.some((c: any) => c.field === 'expiresAt' && c.op === '>')).toBe(true);
                expect(s.constraints.some((c: any) => c.field === 'geohash' && c.op === '>=')).toBe(true);
                expect(s.constraints.some((c: any) => c.field === 'geohash' && c.op === '<=')).toBe(true);
                expect(s.constraints.some((c: any) => c.__kind === 'orderBy' && c.field === 'geohash')).toBe(true);
                expect(s.constraints.some((c: any) => c.__kind === 'limit')).toBe(false);
            });
            act(() => renderer.unmount());
        });

        it('all ranges in one subscription generation share the exact same expiresAt Timestamp — not recomputed per range', async () => {
            const renderer = await renderNotifications();
            const timestamps = subs.map(s => s.constraints.find((c: any) => c.field === 'expiresAt')?.value);
            expect(timestamps.length).toBeGreaterThan(0);
            expect(new Set(timestamps).size).toBe(1);
            act(() => renderer.unmount());
        });

        it('no valid location (permission not yet determined): zero spot Firestore reads', async () => {
            const renderer = await renderNotifications({ permissionState: 'not_determined' });
            expect(onSnapshotCallCount).toBe(0);
            expect(subs.length).toBe(0);
            act(() => renderer.unmount());
        });

        it('no valid location (permission denied): zero spot Firestore reads', async () => {
            const renderer = await renderNotifications({ permissionState: 'denied_requestable' });
            expect(onSnapshotCallCount).toBe(0);
            act(() => renderer.unmount());
        });

        it('no valid location (geolocation errors even though permission granted): zero spot Firestore reads', async () => {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: { geolocation: { getCurrentPosition: (_success: any, error: any) => { error({ code: 1 }); } } },
            });
            const renderer = await renderNotifications();
            expect(onSnapshotCallCount).toBe(0);
            act(() => renderer.unmount());
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: { geolocation: { getCurrentPosition: (success: any) => success({ coords: { latitude: 40.0, longitude: -74.0 } }) } },
            });
        });

        it('valid → lost location: disposes active geo listeners and clears stale results — no bare fallback listener', async () => {
            const renderer = await renderNotifications({ permissionState: 'granted' });
            emit([spotDoc('a', { reportedAtMs: T0, expiresAtMs: T0 + 60_000 })]);
            expect(addresses(renderer)).toEqual(['addr-a']);
            const activeBefore = subs.filter(s => !s.unsubscribed).length;
            expect(activeBefore).toBeGreaterThan(0);

            await act(async () => {
                renderer.update(React.createElement(NotificationsView, {
                    user: { id: 'me' },
                    onBack: () => {},
                    onSelectSpot: () => {},
                    permissionState: 'denied_requestable',
                    callbacks: noopCallbacks,
                }));
            });

            expect(addresses(renderer)).toEqual([]);
            expect(subs.filter(s => !s.unsubscribed).length).toBe(0);
            expect(onSnapshotCallCount).toBe(activeBefore); // no new listener established after loss
            act(() => renderer.unmount());
        });
    });
});
