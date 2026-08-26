import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Plain Node environment — no DOM globals at all. i18n reads localStorage
// for the persisted language preference at MODULE LOAD time, so this must
// run before any import is evaluated (vi.hoisted runs before import hoisting).
vi.hoisted(() => {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => { store.set(k, String(v)); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => { store.clear(); },
    };
});

// ActivitiesView's fetchHistory() used to re-query BOTH `spots`
// (finderId==uid) and `spotFeedback` (userId==uid) from scratch on every
// "Load More" tap, even though the first fetch already retrieved the user's
// entire history and merely sliced 20 items off the front of it. Fixed by
// caching the merged, sorted history and paginating that cache client-side.
vi.mock('../firebase', () => ({ db: {} }));

const getDocsCalls: string[] = [];
const whereCalls: Array<{ field: string; op: string; value: any }> = [];
let spotsDocs: Array<{ id: string; data: () => any }> = [];
let feedbackDocs: Array<{ id: string; data: () => any }> = [];

vi.mock('firebase/firestore', () => ({
    collection: (_db: any, name: string) => ({ __name: name }),
    query: (base: any, ...clauses: any[]) => base,
    where: (field: string, op: string, value: any) => {
        whereCalls.push({ field, op, value });
        return () => { };
    },
    getDocs: async (q: any) => {
        getDocsCalls.push(q.__name);
        return { docs: q.__name === 'spots' ? spotsDocs : feedbackDocs };
    },
}));

import { ActivitiesView } from './ActivitiesView';

function spotDoc(id: string, ageMs: number) {
    return {
        id,
        data: () => ({
            finderId: 'me', status: 'available', address: `addr-${id}`,
            reportedAt: { toMillis: () => Date.now() - ageMs },
        }),
    };
}

async function renderAndLoad(user = { id: 'me' }) {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
        renderer = TestRenderer.create(React.createElement(ActivitiesView, { user, onBack: () => { } }));
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    return renderer!;
}

function tapLoadMore(renderer: TestRenderer.ReactTestRenderer) {
    const buttons = renderer.root.findAll(node => node.type === 'button');
    expect(buttons.length).toBe(2); // back button + Load More
    return act(async () => { buttons[1].props.onClick(); });
}

function itemAddresses(renderer: TestRenderer.ReactTestRenderer): string[] {
    return renderer.root.findAll(node => node.type === 'h3').map(n => n.props.children);
}

describe('ActivitiesView — avoids redundant re-fetch on Load More', () => {
    beforeEach(() => {
        getDocsCalls.length = 0;
        whereCalls.length = 0;
        // 25 finder spots (> PAGE_SIZE of 20), no feedback docs — enough to
        // require exactly one "Load More" tap.
        spotsDocs = Array.from({ length: 25 }, (_, i) => spotDoc(`s${i}`, i * 60_000));
        feedbackDocs = [];
    });

    it('fetches each collection exactly once even after tapping Load More', async () => {
        const renderer = await renderAndLoad();
        expect(getDocsCalls.filter(c => c === 'spots').length).toBe(1);
        expect(getDocsCalls.filter(c => c === 'spotFeedback').length).toBe(1);

        await tapLoadMore(renderer);

        expect(getDocsCalls.filter(c => c === 'spots').length).toBe(1);
        expect(getDocsCalls.filter(c => c === 'spotFeedback').length).toBe(1);
        act(() => renderer.unmount());
    });

    it('still filters by finderId == the current user (query predicate unchanged)', async () => {
        const renderer = await renderAndLoad({ id: 'me' });
        expect(whereCalls).toContainEqual({ field: 'finderId', op: '==', value: 'me' });
        expect(whereCalls).toContainEqual({ field: 'userId', op: '==', value: 'me' });
        act(() => renderer.unmount());
    });

    it('shows exactly PAGE_SIZE (20) items initially and reveals 20 more per Load More tap', async () => {
        const renderer = await renderAndLoad();
        expect(itemAddresses(renderer)).toHaveLength(20);

        await tapLoadMore(renderer);
        expect(itemAddresses(renderer)).toHaveLength(25); // only 5 remain, all revealed
        act(() => renderer.unmount());
    });

    it('preserves newest-first ordering across the Load More boundary, with no duplicate or dropped items', async () => {
        const renderer = await renderAndLoad();
        const firstPage = itemAddresses(renderer);
        await tapLoadMore(renderer);
        const fullList = itemAddresses(renderer);

        // Newest-first: index 0 must be the freshest spot (s0, age 0).
        expect(fullList[0]).toBe('addr-s0');
        expect(fullList[fullList.length - 1]).toBe('addr-s24');
        // Every item from the first page reappears at the same position.
        expect(fullList.slice(0, 20)).toEqual(firstPage);
        // No duplicates anywhere in the combined list.
        expect(new Set(fullList).size).toBe(fullList.length);
        act(() => renderer.unmount());
    });
});
