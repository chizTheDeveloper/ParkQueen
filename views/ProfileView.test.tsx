import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Plain Node environment — i18n reads localStorage at module load time.
vi.hoisted(() => {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => { store.clear(); },
    };
});

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/storage', () => ({
    getStorage: () => ({}),
    ref: () => ({}),
    uploadBytes: async () => ({}),
}));

let spotsDocs: Array<{ id: string; data: () => any }> = [];
let feedbackDocs: Array<{ id: string; data: () => any }> = [];
const getDocsCalls: string[] = [];

vi.mock('firebase/firestore', () => ({
    doc: (..._args: any[]) => ({}),
    setDoc: async () => { },
    serverTimestamp: () => ({}),
    onSnapshot: () => () => { },
    collection: (_db: any, name: string) => ({ __name: name }),
    query: (base: any) => base,
    where: () => () => { },
    getDocs: async (q: any) => {
        getDocsCalls.push(q.__name);
        return { docs: q.__name === 'spots' ? spotsDocs : feedbackDocs };
    },
}));

import { ProfileView } from './ProfileView';

function occupiedSpot(id: string) {
    return { id, data: () => ({ finderId: 'me', status: 'occupied', address: `addr-${id}`, reportedAt: { toMillis: () => Date.now() } }) };
}

async function renderProfile(user: any) {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
        renderer = TestRenderer.create(React.createElement(ProfileView, { user, onBack: () => { }, setView: () => { } }));
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    return renderer!;
}

function impactNumbers(renderer: TestRenderer.ReactTestRenderer): string[] {
    // The three impact figures are the only text nodes with this exact class combination.
    return renderer.root.findAll(
        node => node.type === 'span' && typeof node.props.className === 'string' && node.props.className.includes('text-[22px]'),
    ).map(n => String(n.props.children));
}

// The tracking-boundary qualifier ("Since Aug 2026") is the only text node
// rendered with this fingerprint — distinct from the "Pings shared" label
// itself (text-[10px]).
function pingsSharedQualifier(renderer: TestRenderer.ReactTestRenderer): string | undefined {
    const nodes = renderer.root.findAll(
        node => node.type === 'span' && typeof node.props.className === 'string' && node.props.className.includes('text-[9px]'),
    );
    return nodes[0] ? String(nodes[0].props.children) : undefined;
}

function activityAddresses(renderer: TestRenderer.ReactTestRenderer): string[] {
    // These spans render as [" · ", item.address] (a JSX children array), not
    // a single string — join before matching.
    return renderer.root.findAll(
        node => node.type === 'span' && typeof node.props.className === 'string' && node.props.className.includes('font-normal'),
    )
        .map(n => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children)))
        .filter(s => s.includes('addr-'));
}

describe('ProfileView — impact card sourcing', () => {
    beforeEach(() => {
        getDocsCalls.length = 0;
        spotsDocs = [];
        feedbackDocs = [];
    });

    it('CASE 1: Pings shared reads user.impactStats.pingsShared', async () => {
        const renderer = await renderProfile({ id: 'me', impactStats: { pingsShared: 9 } });
        const [pingsShared] = impactNumbers(renderer);
        expect(pingsShared).toBe('9');
        act(() => renderer.unmount());
    });

    it('CASE 2: missing impactStats renders Pings shared as 0 (card shown via another nonzero metric)', async () => {
        // hasImpact requires at least one nonzero metric to render the card at
        // all — trustStats supplies that here so pingsShared: 0 is observable.
        const renderer = await renderProfile({ id: 'me', trustStats: { handoffsCompleted: 1 } }); // no impactStats at all
        const [pingsShared] = impactNumbers(renderer);
        expect(pingsShared).toBe('0');
        act(() => renderer.unmount());
    });

    it('CASE 3: impactStats present but missing pingsShared renders 0 (card shown via another nonzero metric)', async () => {
        const renderer = await renderProfile({ id: 'me', trustStats: { handoffsCompleted: 1 }, impactStats: { someFutureCounter: 3 } });
        const [pingsShared] = impactNumbers(renderer);
        expect(pingsShared).toBe('0');
        act(() => renderer.unmount());
    });

    it('CASE 4: a large ephemeral spots count does not affect Pings shared — it is not derived from spots', async () => {
        spotsDocs = [occupiedSpot('a'), occupiedSpot('b'), occupiedSpot('c')];
        const renderer = await renderProfile({ id: 'me', impactStats: { pingsShared: 2 } });
        const [pingsShared] = impactNumbers(renderer);
        expect(pingsShared).toBe('2'); // not 3 (spots.length)
        act(() => renderer.unmount());
    });

    it('CASE 5: removing/cleaning spot fixtures cannot decrease the displayed Pings shared value', async () => {
        spotsDocs = []; // all ephemeral spots already cleaned up
        const renderer = await renderProfile({ id: 'me', impactStats: { pingsShared: 42 } });
        const [pingsShared] = impactNumbers(renderer);
        expect(pingsShared).toBe('42');
        act(() => renderer.unmount());
    });

    it('CASE 6: Successful handoffs still reads trustStats.handoffsCompleted', async () => {
        spotsDocs = [occupiedSpot('a'), occupiedSpot('b')]; // would claim 2 via status, durable says 11
        const renderer = await renderProfile({ id: 'me', trustStats: { handoffsCompleted: 11 }, impactStats: { pingsShared: 1 } });
        const [, successfulHandoffs] = impactNumbers(renderer);
        expect(successfulHandoffs).toBe('11');
        act(() => renderer.unmount());
    });

    it('CASE 7: Spots found remains unchanged — derived from spotFeedback outcome===success', async () => {
        feedbackDocs = [
            { id: 'f1', data: () => ({ outcome: 'success', createdAt: { toMillis: () => Date.now() } }) },
            { id: 'f2', data: () => ({ outcome: 'failed', createdAt: { toMillis: () => Date.now() } }) },
        ];
        const renderer = await renderProfile({ id: 'me', impactStats: { pingsShared: 0 } });
        const numbers = impactNumbers(renderer);
        expect(numbers[2]).toBe('1');
        act(() => renderer.unmount());
    });

    it('CASE 8: RecentActivity remains unaffected by the Pings shared source change', async () => {
        spotsDocs = [occupiedSpot('a')];
        const renderer = await renderProfile({ id: 'me', impactStats: { pingsShared: 0 } });
        expect(activityAddresses(renderer)).toEqual([' · addr-a']);
        act(() => renderer.unmount());
    });

    it('CASE 9/10: the tracking-boundary qualifier is rendered and distinct from the bare "Pings shared" label', async () => {
        const renderer = await renderProfile({ id: 'me', impactStats: { pingsShared: 5 } });
        const qualifier = pingsSharedQualifier(renderer);
        expect(qualifier).toBeDefined();
        expect(qualifier).toMatch(/2026/);
        expect(qualifier).not.toBe('Pings shared');
        act(() => renderer.unmount());
    });

    it('CASE 11: does not introduce any additional Firestore query — still exactly one spots read and one spotFeedback read', async () => {
        await renderProfile({ id: 'me', impactStats: { pingsShared: 5 }, trustStats: { handoffsCompleted: 5 } });
        expect(getDocsCalls.filter(c => c === 'spots').length).toBe(1);
        expect(getDocsCalls.filter(c => c === 'spotFeedback').length).toBe(1);
    });

    it('source contract: deriveImpactCounts is called with the durable impactStats.pingsShared value, not spots.length', () => {
        const fs = require('fs');
        const source = fs.readFileSync(new URL('./ProfileView.tsx', import.meta.url), 'utf8');
        const callStart = source.indexOf('const counts = deriveImpactCounts(');
        const callEnd = source.indexOf(';', callStart);
        const call = source.slice(callStart, callEnd);

        expect(call).not.toMatch(/allSpots/);
        expect(call).toMatch(/deriveImpactCounts\(allFeedback,\s*user\.trustStats\?\.handoffsCompleted\s*\?\?\s*0,\s*user\.impactStats\?\.pingsShared\s*\?\?\s*0\)/);
    });
});
