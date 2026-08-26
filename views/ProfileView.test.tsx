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
const queryLog: Array<{ name: string; constraints: any[] }> = [];

vi.mock('firebase/firestore', () => ({
    doc: (..._args: any[]) => ({}),
    setDoc: async () => { },
    serverTimestamp: () => ({}),
    onSnapshot: () => () => { },
    collection: (_db: any, name: string) => ({ __name: name }),
    query: (base: any, ...constraints: any[]) => ({ __name: base.__name, __constraints: constraints }),
    where: (field: string, op: string, value: any) => ({ __kind: 'where', field, op, value }),
    orderBy: (field: string, direction?: string) => ({ __kind: 'orderBy', field, direction: direction ?? 'asc' }),
    limit: (n: number) => ({ __kind: 'limit', n }),
    getDocs: async (q: any) => {
        getDocsCalls.push(q.__name);
        queryLog.push({ name: q.__name, constraints: q.__constraints ?? [] });
        return { docs: q.__name === 'spots' ? spotsDocs : feedbackDocs };
    },
}));

import { ProfileView } from './ProfileView';

function spotDoc(id: string, ts: number, overrides: any = {}) {
    return { id, data: () => ({ finderId: 'me', status: 'available', address: `spot-${id}`, reportedAt: { toMillis: () => ts }, ...overrides }) };
}

function feedbackDoc(id: string, ts: number, outcome: string = 'success') {
    return { id, data: () => ({ userId: 'me', outcome, address: `fb-${id}`, createdAt: { toMillis: () => ts } }) };
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
    return renderer.root.findAll(
        node => node.type === 'span' && typeof node.props.className === 'string' && node.props.className.includes('text-[22px]'),
    ).map(n => String(n.props.children));
}

function pingsSharedQualifier(renderer: TestRenderer.ReactTestRenderer): string | undefined {
    const nodes = renderer.root.findAll(
        node => node.type === 'span' && typeof node.props.className === 'string' && node.props.className.includes('text-[9px]'),
    );
    return nodes[0] ? String(nodes[0].props.children) : undefined;
}

function activityAddresses(renderer: TestRenderer.ReactTestRenderer): string[] {
    return renderer.root.findAll(
        node => node.type === 'span' && typeof node.props.className === 'string' && node.props.className.includes('font-normal'),
    )
        .map(n => (Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children)))
        .filter(s => s.includes('spot-') || s.includes('fb-'));
}

function queryFor(name: string) {
    return queryLog.find(q => q.name === name)?.constraints ?? [];
}

describe('ProfileView — impact card sourcing', () => {
    beforeEach(() => {
        getDocsCalls.length = 0;
        queryLog.length = 0;
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

    it('CASE 6: Successful handoffs still reads trustStats.handoffsCompleted', async () => {
        spotsDocs = [spotDoc('a', Date.now()), spotDoc('b', Date.now())];
        const renderer = await renderProfile({ id: 'me', trustStats: { handoffsCompleted: 11 }, impactStats: { pingsShared: 1 } });
        const [, successfulHandoffs] = impactNumbers(renderer);
        expect(successfulHandoffs).toBe('11');
        act(() => renderer.unmount());
    });

    it('CASE 7 / 13: Spots found counts every success-outcome feedback doc, not just the newest 3 (proves the shared allFeedback read is NOT bounded)', async () => {
        const now = Date.now();
        feedbackDocs = [
            feedbackDoc('old1', now - 10 * 86400000, 'success'),
            feedbackDoc('old2', now - 9 * 86400000, 'success'),
            feedbackDoc('new1', now - 3000, 'success'),
            feedbackDoc('new2', now - 2000, 'failed'),
            feedbackDoc('new3', now - 1000, 'success'),
        ];
        const renderer = await renderProfile({ id: 'me', impactStats: { pingsShared: 0 } });
        const numbers = impactNumbers(renderer);
        // 4 total success docs (old1, old2, new1, new3) — including two OLDER
        // than the newest-3 window that RecentActivity itself displays.
        expect(numbers[2]).toBe('4');
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

    it('does not introduce any additional Firestore query — still exactly one spots read and one spotFeedback read', async () => {
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

        expect(call).not.toMatch(/allSpots|recentSpots/);
        expect(call).toMatch(/deriveImpactCounts\(allFeedback,\s*user\.trustStats\?\.handoffsCompleted\s*\?\?\s*0,\s*user\.impactStats\?\.pingsShared\s*\?\?\s*0\)/);
    });
});

describe('ProfileView — RecentActivity bounded spots query', () => {
    beforeEach(() => {
        getDocsCalls.length = 0;
        queryLog.length = 0;
        spotsDocs = [];
        feedbackDocs = [];
    });

    it('1: spots query has exact shape — finderId ==, orderBy reportedAt desc, limit 3', async () => {
        await renderProfile({ id: 'me' });
        const constraints = queryFor('spots');
        expect(constraints).toEqual([
            { __kind: 'where', field: 'finderId', op: '==', value: 'me' },
            { __kind: 'orderBy', field: 'reportedAt', direction: 'desc' },
            { __kind: 'limit', n: 3 },
        ]);
    });

    it('2: spotFeedback query is NOT bounded — still userId == only, no orderBy/limit (shared with Spots found, see CASE 7/13 above)', async () => {
        await renderProfile({ id: 'me' });
        const constraints = queryFor('spotFeedback');
        expect(constraints).toEqual([
            { __kind: 'where', field: 'userId', op: '==', value: 'me' },
        ]);
    });

    it('3: no outcome filter added to the spotFeedback query', async () => {
        await renderProfile({ id: 'me' });
        const constraints = queryFor('spotFeedback');
        expect(constraints.some((c: any) => c.field === 'outcome')).toBe(false);
    });

    it('4: newest 3 all from spots', async () => {
        const now = Date.now();
        spotsDocs = [spotDoc('a', now - 1000), spotDoc('b', now - 2000), spotDoc('c', now - 3000)];
        feedbackDocs = [feedbackDoc('old', now - 999999)];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · spot-a', ' · spot-b', ' · spot-c']);
        act(() => renderer.unmount());
    });

    it('5: newest 3 all from feedback', async () => {
        const now = Date.now();
        feedbackDocs = [feedbackDoc('x', now - 1000), feedbackDoc('y', now - 2000), feedbackDoc('z', now - 3000)];
        spotsDocs = [spotDoc('old', now - 999999)];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · fb-x', ' · fb-y', ' · fb-z']);
        act(() => renderer.unmount());
    });

    it('6: mixed 2 spots + 1 feedback', async () => {
        const now = Date.now();
        spotsDocs = [spotDoc('a', now - 1000), spotDoc('b', now - 3000)];
        feedbackDocs = [feedbackDoc('x', now - 2000)];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · spot-a', ' · fb-x', ' · spot-b']);
        act(() => renderer.unmount());
    });

    it('7: mixed 1 spot + 2 feedback', async () => {
        const now = Date.now();
        spotsDocs = [spotDoc('a', now - 2000)];
        feedbackDocs = [feedbackDoc('x', now - 1000), feedbackDoc('y', now - 3000)];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · fb-x', ' · spot-a', ' · fb-y']);
        act(() => renderer.unmount());
    });

    it('8: one source empty', async () => {
        const now = Date.now();
        spotsDocs = [];
        feedbackDocs = [feedbackDoc('x', now - 1000), feedbackDoc('y', now - 2000)];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · fb-x', ' · fb-y']);
        act(() => renderer.unmount());
    });

    it('9: fewer than 3 total across both sources', async () => {
        const now = Date.now();
        spotsDocs = [spotDoc('a', now - 1000)];
        feedbackDocs = [];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · spot-a']);
        act(() => renderer.unmount());
    });

    it('10: an exact timestamp tie preserves current spot-before-feedback ordering (stable sort, spots pushed first)', async () => {
        const now = Date.now();
        spotsDocs = [spotDoc('a', now)];
        feedbackDocs = [feedbackDoc('x', now)];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · spot-a', ' · fb-x']);
        act(() => renderer.unmount());
    });

    it('11: a 4th, older spot cannot affect the global top 3 (server-side limit(3) already excludes it, proven safe by the top-K-of-union argument)', async () => {
        const now = Date.now();
        spotsDocs = [spotDoc('a', now - 1000), spotDoc('b', now - 2000), spotDoc('c', now - 3000)]; // the mock only ever returns what the "query" would have limited to
        feedbackDocs = [];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toHaveLength(3);
        act(() => renderer.unmount());
    });

    it('12: failure-outcome feedback still appears in RecentActivity', async () => {
        const now = Date.now();
        feedbackDocs = [feedbackDoc('x', now - 1000, 'failed')];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · fb-x']);
        act(() => renderer.unmount());
    });
});
