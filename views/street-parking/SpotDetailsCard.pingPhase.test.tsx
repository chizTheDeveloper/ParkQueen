import React, { useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    Object.defineProperty(globalThis, 'window', { configurable: true, value: eventTarget });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { ...eventTarget, visibilityState: 'visible' } });
});

import { setLang } from '../../i18n';
import { SpotDetailsCard } from './SpotDetailsCard';
import { usePingPhaseClock } from './usePingPhaseClock';

const scheduledAt = Date.parse('2026-08-03T16:00:00.000Z');
const selectedItem = {
    id: 'scheduled-ping',
    lat: 40.82,
    lng: -73.91,
    type: 'free' as const,
    status: 'available' as const,
    title: 'Nearby street',
    finderId: 'finder',
    finderName: 'Alex',
    pingMode: 'later' as const,
    reportedAt: { toMillis: () => scheduledAt },
    expiresAt: { toMillis: () => scheduledAt + 30 * 60_000 },
};

const renderCard = (nowMs: number) => renderToStaticMarkup(
    <SpotDetailsCard
        selectedItem={selectedItem}
        freeSpots={[selectedItem] as any}
        user={{ id: 'viewer' }}
        userLocation={[-73.92, 40.81]}
        spotAddress=""
        onHeadingThere={vi.fn()}
        onScheduledClaim={vi.fn()}
        onEditSpot={vi.fn()}
        onDeletePing={vi.fn()}
        onArrival={vi.fn()}
        onCancelByFinder={vi.fn()}
        onCancelByClaimer={vi.fn()}
        onDriverArrived={vi.fn()}
        onMessageUser={vi.fn()}
        interestError={null}
        estDriveMinutes={4}
        isWithinArrivalRange={false}
        maxEtaMinutes={7}
        nowMs={nowMs}
    />
);

const ClockedCard = ({ ping, onRender }: { ping: typeof selectedItem; onRender?: () => void }) => {
    const items = useMemo(() => [ping], [ping]);
    const nowMs = usePingPhaseClock(items);
    onRender?.();
    return <SpotDetailsCard
        selectedItem={ping} freeSpots={items as any} user={{ id: 'viewer' }} userLocation={[-73.92, 40.81]}
        spotAddress="" onHeadingThere={vi.fn()} onScheduledClaim={vi.fn()} onEditSpot={vi.fn()} onDeletePing={vi.fn()}
        onArrival={vi.fn()} onCancelByFinder={vi.fn()} onCancelByClaimer={vi.fn()} onDriverArrived={vi.fn()}
        onMessageUser={vi.fn()} interestError={null} estDriveMinutes={4} isWithinArrivalRange={false}
        maxEtaMinutes={7} nowMs={nowMs}
    />;
};

describe('open scheduled Ping card transition', () => {
    beforeEach(() => setLang('en'));
    afterEach(() => vi.useRealTimers());

    it('updates the same mounted open card at the clock boundary without a snapshot', () => {
        vi.useFakeTimers();
        vi.setSystemTime(scheduledAt - 1_000);
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => { renderer = TestRenderer.create(<ClockedCard ping={selectedItem} />); });
        expect(JSON.stringify(renderer!.toJSON())).toContain('Claim for');

        act(() => { vi.advanceTimersByTime(1_000); });
        const liveMarkup = JSON.stringify(renderer!.toJSON());
        expect(liveMarkup).toContain("I\'m heading there");
        expect(liveMarkup).toContain('Leaving now');
        expect(liveMarkup).not.toContain('Claim for');
        act(() => renderer!.unmount());
    });

    it('cleans the old selected-Ping timer when the open card is rescheduled', () => {
        vi.useFakeTimers();
        vi.setSystemTime(scheduledAt - 1_000);
        let renders = 0;
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => { renderer = TestRenderer.create(<ClockedCard ping={selectedItem} onRender={() => renders++} />); });
        const rescheduled = {
            ...selectedItem,
            reportedAt: { toMillis: () => scheduledAt + 10_000 },
            expiresAt: { toMillis: () => scheduledAt + 40 * 60_000 },
        };
        act(() => renderer!.update(<ClockedCard ping={rescheduled} onRender={() => renders++} />));
        const rendersAfterReschedule = renders;

        act(() => { vi.advanceTimersByTime(1_000); });
        expect(renders).toBe(rendersAfterReschedule);
        expect(JSON.stringify(renderer!.toJSON())).toContain('Claim for');
        act(() => renderer!.unmount());
    });

    it('renders scheduled presentation immediately before the boundary', () => {
        const markup = renderCard(scheduledAt - 1);

        expect(markup).toContain('Soon');
        expect(markup).toContain('Leaving at');
        expect(markup).toContain('Claim for');
        expect(markup).not.toContain("I&#x27;m heading there");
    });

    it('renders normal live presentation at the exact boundary with the same Ping object', () => {
        const markup = renderCard(scheduledAt);

        expect(markup).toContain('Free');
        expect(markup).toContain('Leaving now');
        expect(markup).toContain("I&#x27;m heading there");
        expect(markup).not.toContain('Claim for');
    });

    it('uses the same phase behavior in Spanish', () => {
        setLang('es');
        const before = renderCard(scheduledAt - 1);
        const atBoundary = renderCard(scheduledAt);

        expect(before).toContain('Reclamar para las');
        expect(atBoundary).toContain('Libre');
        expect(atBoundary).toContain('Voy para allá');
    });

    it('preserves the committed scheduled-claim flow across departure', () => {
        const claimed = {
            ...selectedItem,
            status: 'interested',
            claimState: 'committed',
            interestedUserId: 'viewer',
        };
        const renderClaimed = (nowMs: number) => renderToStaticMarkup(
            <SpotDetailsCard
                selectedItem={claimed}
                freeSpots={[claimed] as any}
                user={{ id: 'viewer' }}
                userLocation={[-73.92, 40.81]}
                spotAddress=""
                onHeadingThere={vi.fn()}
                onScheduledClaim={vi.fn()}
                onCommitToHeading={vi.fn()}
                onEditSpot={vi.fn()}
                onDeletePing={vi.fn()}
                onArrival={vi.fn()}
                onCancelByFinder={vi.fn()}
                onCancelByClaimer={vi.fn()}
                onDriverArrived={vi.fn()}
                onMessageUser={vi.fn()}
                interestError={null}
                estDriveMinutes={4}
                isWithinArrivalRange={false}
                maxEtaMinutes={7}
                nowMs={nowMs}
            />
        );

        const before = renderClaimed(scheduledAt - 1);
        const after = renderClaimed(scheduledAt + 1);
        expect(before).toContain('You claimed this spot');
        expect(after).toContain('You claimed this spot');
        expect(after).toContain("I&#x27;m heading there");
    });

    it('transitions the owner card to live language without ever showing a claim CTA', () => {
        const renderOwner = (nowMs: number) => renderToStaticMarkup(
            <SpotDetailsCard
                selectedItem={selectedItem}
                freeSpots={[selectedItem] as any}
                user={{ id: 'finder' }}
                userLocation={[-73.92, 40.81]}
                spotAddress="East 204th Street"
                onHeadingThere={vi.fn()} onScheduledClaim={vi.fn()} onEditSpot={vi.fn()} onDeletePing={vi.fn()}
                onArrival={vi.fn()} onCancelByFinder={vi.fn()} onCancelByClaimer={vi.fn()} onDriverArrived={vi.fn()}
                onMessageUser={vi.fn()} interestError={null} estDriveMinutes={4} isWithinArrivalRange={false}
                maxEtaMinutes={7} nowMs={nowMs}
            />
        );

        const before = renderOwner(scheduledAt - 1);
        const live = renderOwner(scheduledAt);
        expect(before).toContain('Scheduled');
        expect(live).toContain('Available now');
        expect(live).toContain('Leaving now');
        expect(before).not.toContain('Claim for');
        expect(live).not.toContain("I&#x27;m heading there");
    });

    it('does not show an immediate claim CTA to a third party for a claimed Ping', () => {
        const claimed = { ...selectedItem, status: 'interested', claimState: 'committed', interestedUserId: 'claimer' };
        const markup = renderToStaticMarkup(
            <SpotDetailsCard
                selectedItem={claimed} freeSpots={[claimed] as any} user={{ id: 'other' }} userLocation={[-73.92, 40.81]}
                spotAddress="" onHeadingThere={vi.fn()} onScheduledClaim={vi.fn()} onEditSpot={vi.fn()} onDeletePing={vi.fn()}
                onArrival={vi.fn()} onCancelByFinder={vi.fn()} onCancelByClaimer={vi.fn()} onDriverArrived={vi.fn()}
                onMessageUser={vi.fn()} interestError={null} estDriveMinutes={4} isWithinArrivalRange={false}
                maxEtaMinutes={7} nowMs={scheduledAt + 1}
            />
        );
        expect(markup).not.toContain('Claim for');
        expect(markup).not.toContain("I&#x27;m heading there");
    });
});
