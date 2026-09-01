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
let spotsFoundCount: number | 'reject' = 0;
const getDocsCalls: string[] = [];
const queryLog: Array<{ name: string; constraints: any[] }> = [];
const countQueryLog: Array<{ name: string; constraints: any[] }> = [];

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
    getCountFromServer: async (q: any) => {
        countQueryLog.push({ name: q.__name, constraints: q.__constraints ?? [] });
        if (spotsFoundCount === 'reject') throw new Error('aggregation failed');
        return { data: () => ({ count: spotsFoundCount }) };
    },
}));

import { ProfileView } from './ProfileView';

function spotDoc(id: string, ts: number, overrides: any = {}) {
    return { id, data: () => ({ finderId: 'me', status: 'available', address: `spot-${id}`, reportedAt: { toMillis: () => ts }, ...overrides }) };
}

function feedbackDoc(id: string, ts: number, outcome: string = 'success') {
    return { id, data: () => ({ userId: 'me', outcome, address: `fb-${id}`, createdAt: { toMillis: () => ts } }) };
}

async function renderProfile(user: any, navCounts: { unreadMessagesCount?: number; pendingUpdatesCount?: number } = {}) {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
        renderer = TestRenderer.create(React.createElement(ProfileView, { user, onBack: () => { }, setView: () => { }, ...navCounts }));
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

describe('ProfileView — mobile primary navigation', () => {
    it('keeps Profile selected on its primary root', async () => {
        const renderer = await renderProfile({ id: 'me' }, { unreadMessagesCount: 2, pendingUpdatesCount: 3 });
        const nav = renderer.root.findByProps({ 'aria-label': 'Primary navigation' });
        expect(nav.findByProps({ 'aria-label': 'Profile' }).props['aria-current']).toBe('page');
        expect(nav.findByProps({ 'aria-label': 'Messages, 2 unread' })).toBeDefined();
        expect(nav.findByProps({ 'aria-label': 'Nearby Activity, 3 new' })).toBeDefined();
        act(() => renderer.unmount());
    });

    it('removes the primary navigation while the Crowns dialog is open', async () => {
        const renderer = await renderProfile({ id: 'me' });
        const info = renderer.root.findByProps({ 'aria-label': 'What are crowns?' });
        act(() => info.props.onClick());
        expect(renderer.root.findAllByProps({ 'aria-label': 'Primary navigation' })).toHaveLength(0);
        expect(renderer.root.findByProps({ role: 'dialog' })).toBeDefined();
        act(() => renderer.unmount());
    });
});

describe('ProfileView — impact card sourcing', () => {
    beforeEach(() => {
        getDocsCalls.length = 0;
        queryLog.length = 0;
        countQueryLog.length = 0;
        spotsDocs = [];
        feedbackDocs = [];
        spotsFoundCount = 0;
    });

    it('CASE 1: Pings shared reads user.impactStats.pingsShared', async () => {
        const renderer = await renderProfile({ id: 'me', impactStats: { pingsShared: 9 } });
        const [pingsShared] = impactNumbers(renderer);
        expect(pingsShared).toBe('9');
        act(() => renderer.unmount());
    });

    it('CASE 2: missing impactStats renders Pings shared as 0 (card shown via another nonzero metric)', async () => {
        const renderer = await renderProfile({ id: 'me', trustStats: { handoffsCompleted: 1 } });
        const [pingsShared] = impactNumbers(renderer);
        expect(pingsShared).toBe('0');
        act(() => renderer.unmount());
    });

    it('CASE 6: Successful handoffs still reads trustStats.handoffsCompleted', async () => {
        const renderer = await renderProfile({ id: 'me', trustStats: { handoffsCompleted: 11 }, impactStats: { pingsShared: 1 } });
        const [, successfulHandoffs] = impactNumbers(renderer);
        expect(successfulHandoffs).toBe('11');
        act(() => renderer.unmount());
    });

    it('20 / 21: Spots found displays the aggregation number exactly, including a count larger than 3', async () => {
        spotsFoundCount = 42;
        const renderer = await renderProfile({ id: 'me' });
        const numbers = impactNumbers(renderer);
        expect(numbers[2]).toBe('42');
        act(() => renderer.unmount());
    });

    it('22: a zero Spots found count displays 0 correctly', async () => {
        spotsFoundCount = 0;
        const renderer = await renderProfile({ id: 'me', trustStats: { handoffsCompleted: 1 } });
        const numbers = impactNumbers(renderer);
        expect(numbers[2]).toBe('0');
        act(() => renderer.unmount());
    });

    it('9/10: the tracking-boundary qualifier is rendered and distinct from the bare "Pings shared" label', async () => {
        const renderer = await renderProfile({ id: 'me', impactStats: { pingsShared: 5 } });
        const qualifier = pingsSharedQualifier(renderer);
        expect(qualifier).toBeDefined();
        expect(qualifier).toMatch(/2026/);
        expect(qualifier).not.toBe('Pings shared');
        act(() => renderer.unmount());
    });

    it('does not introduce any additional Firestore query — exactly one spots read, one feedback read, one count aggregation', async () => {
        await renderProfile({ id: 'me', impactStats: { pingsShared: 5 }, trustStats: { handoffsCompleted: 5 } });
        expect(getDocsCalls.filter(c => c === 'spots').length).toBe(1);
        expect(getDocsCalls.filter(c => c === 'spotFeedback').length).toBe(1);
        expect(countQueryLog.length).toBe(1);
    });

    it('source contract: deriveImpactCounts is called with the aggregation-sourced spotsFound, not a feedback array', async () => {
        const fs = require('fs');
        const source = fs.readFileSync(new URL('./ProfileView.tsx', import.meta.url), 'utf8');
        const callStart = source.indexOf('const counts = deriveImpactCounts(');
        const callEnd = source.indexOf(');', callStart);
        const call = source.slice(callStart, callEnd);

        expect(call).not.toMatch(/allFeedback|recentFeedback\.filter/);
        expect(call).toMatch(/spotsFound/);
    });
});

describe('ProfileView — RecentActivity bounded queries', () => {
    beforeEach(() => {
        getDocsCalls.length = 0;
        queryLog.length = 0;
        countQueryLog.length = 0;
        spotsDocs = [];
        feedbackDocs = [];
        spotsFoundCount = 0;
    });

    it('1: spots query — finderId ==, orderBy reportedAt desc, limit 3', async () => {
        await renderProfile({ id: 'me' });
        expect(queryFor('spots')).toEqual([
            { __kind: 'where', field: 'finderId', op: '==', value: 'me' },
            { __kind: 'orderBy', field: 'reportedAt', direction: 'desc' },
            { __kind: 'limit', n: 3 },
        ]);
    });

    it('2: feedback query (RecentActivity source) — userId ==, orderBy createdAt desc, limit 3', async () => {
        await renderProfile({ id: 'me' });
        expect(queryFor('spotFeedback')).toEqual([
            { __kind: 'where', field: 'userId', op: '==', value: 'me' },
            { __kind: 'orderBy', field: 'createdAt', direction: 'desc' },
            { __kind: 'limit', n: 3 },
        ]);
    });

    it('3: the RecentActivity feedback query has no outcome filter', async () => {
        await renderProfile({ id: 'me' });
        expect(queryFor('spotFeedback').some((c: any) => c.field === 'outcome')).toBe(false);
    });

    it('4: the Spots found count query — userId == and outcome == success, no orderBy, no limit', async () => {
        await renderProfile({ id: 'me' });
        expect(countQueryLog[0].constraints).toEqual([
            { __kind: 'where', field: 'userId', op: '==', value: 'me' },
            { __kind: 'where', field: 'outcome', op: '==', value: 'success' },
        ]);
    });

    it('5: the count query has no limit(3)', async () => {
        await renderProfile({ id: 'me' });
        expect(countQueryLog[0].constraints.some((c: any) => c.__kind === 'limit')).toBe(false);
    });

    it('6: the count query has no createdAt orderBy', async () => {
        await renderProfile({ id: 'me' });
        expect(countQueryLog[0].constraints.some((c: any) => c.__kind === 'orderBy')).toBe(false);
    });

    it('7: 5+ historical feedback docs with successes older than the newest-3 window — Spots found still returns the full aggregation count', async () => {
        // The mock's spotsDocs/feedbackDocs represent what a real bounded
        // query would already have limited server-side; the aggregation is
        // deliberately configured independently and larger than 3 to prove
        // it is NOT derived from whatever RecentActivity happens to fetch.
        const now = Date.now();
        feedbackDocs = [feedbackDoc('new1', now - 1000), feedbackDoc('new2', now - 2000), feedbackDoc('new3', now - 3000)];
        spotsFoundCount = 7; // 2 older successes exist beyond the newest-3 window
        const renderer = await renderProfile({ id: 'me' });
        const numbers = impactNumbers(renderer);
        expect(numbers[2]).toBe('7');
        act(() => renderer.unmount());
    });

    it('8: failure feedback can still appear in RecentActivity', async () => {
        const now = Date.now();
        feedbackDocs = [feedbackDoc('x', now - 1000, 'failed')];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · fb-x']);
        act(() => renderer.unmount());
    });

    it('9: failure feedback does not contribute to Spots found (count is independent, aggregation-only)', async () => {
        const now = Date.now();
        feedbackDocs = [feedbackDoc('x', now - 1000, 'failed')];
        spotsFoundCount = 0;
        // hasImpact requires at least one nonzero metric to render the card
        // at all — trustStats supplies that here so spotsFound: 0 is observable.
        const renderer = await renderProfile({ id: 'me', trustStats: { handoffsCompleted: 1 } });
        const numbers = impactNumbers(renderer);
        expect(numbers[2]).toBe('0');
        act(() => renderer.unmount());
    });

    it('10: RecentActivity contains only the newest 3 across both sources', async () => {
        const now = Date.now();
        spotsDocs = [spotDoc('a', now - 1000), spotDoc('b', now - 2000)];
        feedbackDocs = [feedbackDoc('x', now - 3000), feedbackDoc('y', now - 4000)];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · spot-a', ' · spot-b', ' · fb-x']);
        act(() => renderer.unmount());
    });

    it('11: mixed ordering — newest combined top 3 remains correct', async () => {
        const now = Date.now();
        spotsDocs = [spotDoc('a', now - 2000)];
        feedbackDocs = [feedbackDoc('x', now - 1000), feedbackDoc('y', now - 3000)];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · fb-x', ' · spot-a', ' · fb-y']);
        act(() => renderer.unmount());
    });

    it('12: an exact timestamp tie preserves spot-before-feedback ordering', async () => {
        const now = Date.now();
        spotsDocs = [spotDoc('a', now)];
        feedbackDocs = [feedbackDoc('x', now)];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · spot-a', ' · fb-x']);
        act(() => renderer.unmount());
    });

    it('13: one source empty', async () => {
        const now = Date.now();
        feedbackDocs = [feedbackDoc('x', now - 1000)];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · fb-x']);
        act(() => renderer.unmount());
    });

    it('14: both sources fewer than 3 total', async () => {
        const now = Date.now();
        spotsDocs = [spotDoc('a', now - 1000)];
        const renderer = await renderProfile({ id: 'me' });
        expect(activityAddresses(renderer)).toEqual([' · spot-a']);
        act(() => renderer.unmount());
    });

    it('15/16/17: a rejected count aggregation does not show a fake zero, does not fall back to the recent-feedback success count, and reaches the existing Profile error state', async () => {
        feedbackDocs = [feedbackDoc('x', Date.now(), 'success')]; // would wrongly suggest "1" if used as a fallback
        spotsFoundCount = 'reject';
        const renderer = await renderProfile({ id: 'me' });
        // hasImpact requires impactState === 'loaded'; on error it never
        // reaches 'loaded', so the whole impact card (and any number,
        // correct or not) never renders at all.
        expect(impactNumbers(renderer)).toEqual([]);
        act(() => renderer.unmount());
    });
});
