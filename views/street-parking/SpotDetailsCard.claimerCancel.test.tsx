import React from 'react';
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

import { setLang, t } from '../../i18n';
import { SpotDetailsCard } from './SpotDetailsCard';

const scheduledAt = Date.parse('2026-08-03T16:00:00.000Z');

const committedItem = {
    id: 'scheduled-ping',
    lat: 40.82,
    lng: -73.91,
    type: 'free' as const,
    status: 'interested' as const,
    title: 'Nearby street',
    finderId: 'finder',
    finderName: 'Alex',
    pingMode: 'later' as const,
    reportedAt: { toMillis: () => scheduledAt },
    expiresAt: { toMillis: () => scheduledAt + 30 * 60_000 },
    claimState: 'committed' as const,
    interestedUserId: 'viewer',
};

const headingItem = {
    ...committedItem,
    id: 'live-ping',
    pingMode: 'now' as const,
    reportedAt: { toMillis: () => scheduledAt - 10_000 },
    claimState: undefined,
};

function renderCommitted({ cancelingClaim = false, interestError = null as string | null, onCancelByClaimer = vi.fn() } = {}) {
    return renderToStaticMarkup(
        <SpotDetailsCard
            selectedItem={committedItem}
            freeSpots={[committedItem] as any}
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
            onCancelByClaimer={onCancelByClaimer}
            cancelingClaim={cancelingClaim}
            onDriverArrived={vi.fn()}
            onMessageUser={vi.fn()}
            interestError={interestError}
            estDriveMinutes={4}
            isWithinArrivalRange={false}
            maxEtaMinutes={7}
            nowMs={scheduledAt + 1}
        />
    );
}

describe('claimant Cancel button — loading, error, and a11y state', () => {
    beforeEach(() => setLang('en'));
    afterEach(() => vi.useRealTimers());

    it('is enabled with the normal label when idle', () => {
        const markup = renderCommitted();
        expect(markup).toContain(t('scheduled_claim.cancel'));
        expect(markup).not.toContain('disabled=""');
    });

    it('disables the button, marks it busy, and swaps in a localized progress label while submitting', () => {
        const markup = renderCommitted({ cancelingClaim: true });
        expect(markup).toContain('disabled=""');
        expect(markup).toContain('aria-busy="true"');
        expect(markup).toContain(t('claim_flow.canceling'));
        expect(markup).not.toContain(`>${t('scheduled_claim.cancel')}<`);
    });

    it('shows the localized progress label in Spanish too', () => {
        setLang('es');
        const markup = renderCommitted({ cancelingClaim: true });
        expect(markup).toContain('Cancelando');
    });

    it('surfaces a visible retryable error near the button after a failed attempt', () => {
        const markup = renderCommitted({ interestError: "Couldn't cancel — please try again" });
        expect(markup).toContain('Couldn&#x27;t cancel — please try again');
        // Not stuck submitting — button remains actionable for retry.
        expect(markup).not.toContain('disabled=""');
    });

    it('renders the real claim_flow.cancel_error i18n string in English — and it never contains raw SDK/transaction wording', () => {
        const markup = renderCommitted({ interestError: t('claim_flow.cancel_error') });
        expect(markup).toContain('Couldn&#x27;t cancel');
        expect(markup).toContain('please try again');
        expect(markup.toLowerCase()).not.toMatch(/firestore|transaction|permission-denied|reads to be executed/);
    });

    it('renders the real claim_flow.cancel_error i18n string in Spanish — and it never contains raw SDK/transaction wording', () => {
        setLang('es');
        const markup = renderCommitted({ interestError: t('claim_flow.cancel_error') });
        expect(markup).toContain('No se pudo cancelar');
        expect(markup.toLowerCase()).not.toMatch(/firestore|transaction|permission-denied|reads to be executed/);
    });

    it('an idle (non-submitting) button still invokes onCancelByClaimer — sanity check for the disabled-state contract', () => {
        let renderer: TestRenderer.ReactTestRenderer;
        const onCancelByClaimer = vi.fn();
        act(() => {
            renderer = TestRenderer.create(
                <SpotDetailsCard
                    selectedItem={committedItem}
                    freeSpots={[committedItem] as any}
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
                    onCancelByClaimer={onCancelByClaimer}
                    cancelingClaim={false}
                    onDriverArrived={vi.fn()}
                    onMessageUser={vi.fn()}
                    interestError={null}
                    estDriveMinutes={4}
                    isWithinArrivalRange={false}
                    maxEtaMinutes={7}
                    nowMs={scheduledAt + 1}
                />
            );
        });
        const cancelButton = renderer!.root.findAll(
            (node) => node.type === 'button' && node.props.disabled === false
        )[0];
        act(() => { cancelButton.props.onClick?.(); });
        expect(onCancelByClaimer).toHaveBeenCalledWith('Changed my mind');
        act(() => renderer!.unmount());
    });

    it('the live-claim quick-reply cancel reasons also disable while submitting', () => {
        let renderer: TestRenderer.ReactTestRenderer;
        act(() => {
            renderer = TestRenderer.create(
                <SpotDetailsCard
                    selectedItem={headingItem}
                    freeSpots={[headingItem] as any}
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
                    cancelingClaim={false}
                    onDriverArrived={vi.fn()}
                    onMessageUser={vi.fn()}
                    interestError={null}
                    estDriveMinutes={4}
                    isWithinArrivalRange={false}
                    maxEtaMinutes={7}
                    nowMs={scheduledAt + 1}
                />
            );
        });
        const revealReasons = renderer!.root.findAll(
            (node) => node.type === 'button' && node.props.children === t('claim_flow.cancel')
        )[0];
        act(() => { revealReasons.props.onClick(); });
        act(() => { renderer!.update(
            <SpotDetailsCard
                selectedItem={headingItem}
                freeSpots={[headingItem] as any}
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
                cancelingClaim={true}
                onDriverArrived={vi.fn()}
                onMessageUser={vi.fn()}
                interestError={null}
                estDriveMinutes={4}
                isWithinArrivalRange={false}
                maxEtaMinutes={7}
                nowMs={scheduledAt + 1}
            />
        ); });
        const reasonButtons = renderer!.root.findAll(
            (node) => node.type === 'button' && node.props.disabled === true
        );
        expect(reasonButtons.length).toBeGreaterThan(0);
        act(() => renderer!.unmount());
    });
});
