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

describe('ProfileView — Successful handoffs uses the durable trustStats counter', () => {
    beforeEach(() => {
        getDocsCalls.length = 0;
        spotsDocs = [];
        feedbackDocs = [];
    });

    it('displays trustStats.handoffsCompleted for Successful handoffs, ignoring spots.status', async () => {
        // Ephemeral spots claim 3 occupied handoffs; the durable counter says 11.
        // The durable value must win.
        spotsDocs = [occupiedSpot('a'), occupiedSpot('b'), occupiedSpot('c')];
        const renderer = await renderProfile({ id: 'me', trustStats: { handoffsCompleted: 11 } });

        const [pingsShared, successfulHandoffs] = impactNumbers(renderer);
        expect(successfulHandoffs).toBe('11');
        expect(pingsShared).toBe('3'); // pingsShared is still spots.length — unchanged behavior
        act(() => renderer.unmount());
    });

    it('an empty/zero spots snapshot does not zero out Successful handoffs — it is not derived from spots', async () => {
        spotsDocs = []; // no ephemeral spots remain (e.g. all cleaned up)
        const renderer = await renderProfile({ id: 'me', trustStats: { handoffsCompleted: 42 } });

        const [, successfulHandoffs] = impactNumbers(renderer);
        expect(successfulHandoffs).toBe('42');
        act(() => renderer.unmount());
    });

    it('missing trustStats renders Successful handoffs as 0 safely (no crash)', async () => {
        spotsDocs = [occupiedSpot('a')];
        const renderer = await renderProfile({ id: 'me' }); // no trustStats at all

        const [, successfulHandoffs] = impactNumbers(renderer);
        expect(successfulHandoffs).toBe('0');
        act(() => renderer.unmount());
    });

    it('Spots found (from spotFeedback) is unaffected by this change', async () => {
        feedbackDocs = [
            { id: 'f1', data: () => ({ outcome: 'success', createdAt: { toMillis: () => Date.now() } }) },
            { id: 'f2', data: () => ({ outcome: 'failed', createdAt: { toMillis: () => Date.now() } }) },
        ];
        const renderer = await renderProfile({ id: 'me', trustStats: { handoffsCompleted: 0 } });

        const numbers = impactNumbers(renderer);
        expect(numbers[2]).toBe('1'); // spotsFound: only the 'success' one
        act(() => renderer.unmount());
    });

    it('does not introduce any additional Firestore query — still exactly one spots read and one spotFeedback read', async () => {
        await renderProfile({ id: 'me', trustStats: { handoffsCompleted: 5 } });
        expect(getDocsCalls.filter(c => c === 'spots').length).toBe(1);
        expect(getDocsCalls.filter(c => c === 'spotFeedback').length).toBe(1);
    });

    it("source contract: deriveImpactCounts is called with the durable trustStats value, not a spots.status === 'occupied' filter", () => {
        const fs = require('fs');
        const source = fs.readFileSync(new URL('./ProfileView.tsx', import.meta.url), 'utf8');
        const callStart = source.indexOf('const counts = deriveImpactCounts(');
        const callEnd = source.indexOf(';', callStart);
        const call = source.slice(callStart, callEnd);

        expect(call).not.toMatch(/status/);
        expect(call).toMatch(/deriveImpactCounts\(allSpots,\s*allFeedback,\s*user\.trustStats\?\.handoffsCompleted\s*\?\?\s*0\)/);
    });
});
