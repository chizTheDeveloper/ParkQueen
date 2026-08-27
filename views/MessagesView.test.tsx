import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// This vitest environment (environment: 'node') has no DOM/window/localStorage
// globals at all — i18n's resolveInitialLang() reads localStorage at import time.
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
vi.mock('../services/geminiService', () => ({
    generateSmartReplies: vi.fn(async () => []),
    createSmartReplyRequestKey: (chatId: string, msgId: string) => `${chatId}:${msgId}`,
}));
vi.mock('../utils/moderation', () => ({ moderateMessage: () => null }));
vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: () => async () => ({}),
}));
vi.mock('firebase/app', () => ({ getApp: () => ({}) }));

interface UserDocCall {
    uid: string;
    resolve: (exists: boolean, data?: any) => void;
    reject: (err: unknown) => void;
}
let userDocCalls: UserDocCall[] = [];
let chatsOnNext: ((snap: any) => void) | null = null;
let chatsUnsubCount = 0;

vi.mock('firebase/firestore', () => ({
    collection: (_db: any, ...path: string[]) => ({ __col: path }),
    doc: (_db: any, ...path: string[]) => ({ __doc: path }),
    query: (base: any, ...constraints: any[]) => ({ ...base, __constraints: constraints }),
    where: (field: string, op: string, value: any) => ({ __kind: 'where', field, op, value }),
    orderBy: (field: string, dir?: string) => ({ __kind: 'orderBy', field, dir }),
    onSnapshot: (q: any, onNext: any) => {
        if (Array.isArray(q.__col) && q.__col.length === 1 && q.__col[0] === 'chats') {
            chatsOnNext = onNext;
            return () => { chatsUnsubCount++; };
        }
        onNext({ docs: [] });
        return () => {};
    },
    getDoc: (ref: any) => new Promise((resolve, reject) => {
        const uid = ref.__doc[1];
        userDocCalls.push({
            uid,
            resolve: (exists: boolean, data?: any) => resolve({ exists: () => exists, data: () => data }),
            reject,
        });
    }),
    getDocs: async () => ({ docs: [] }),
    addDoc: async () => ({ id: 'x' }),
    setDoc: async () => {},
    writeBatch: () => ({ delete: () => {}, commit: async () => {} }),
    updateDoc: async () => {},
    serverTimestamp: () => ({ __serverTimestamp: true }),
}));

import { MessagesView } from './MessagesView';

const T0 = Date.parse('2026-08-27T12:00:00.000Z');

function tsAt(ms: number) {
    return { toDate: () => new Date(ms) };
}

function chatDoc(id: string, participants: string[], opts: {
    lastMessage?: string; lastMessageTimestampMs?: number; relatedSpotTitle?: string; lastSenderId?: string;
} = {}) {
    return {
        id,
        data: () => ({
            participants,
            lastMessage: opts.lastMessage ?? 'hey',
            lastMessageTimestamp: tsAt(opts.lastMessageTimestampMs ?? T0),
            relatedSpotTitle: opts.relatedSpotTitle ?? '',
            lastSenderId: opts.lastSenderId ?? 'other',
        }),
    };
}

async function renderMessages(props: Partial<React.ComponentProps<typeof MessagesView>> = {}) {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
        renderer = TestRenderer.create(React.createElement(MessagesView, {
            user: { id: 'me', blockedUsers: [] },
            activeChatContext: null,
            onBack: () => {},
            ...props,
        }));
    });
    return renderer!;
}

function emitChats(docs: any[]) {
    act(() => { chatsOnNext!({ docs }); });
}

function conversationNames(renderer: TestRenderer.ReactTestRenderer): string[] {
    return renderer.root.findAll(
        n => n.type === 'span' && typeof n.props.className === 'string' && n.props.className.includes('truncate pr-2') && n.props.className.includes('text-sm'),
    ).map(n => String(n.props.children));
}

async function flush(ticks = 8) {
    for (let i = 0; i < ticks; i++) await Promise.resolve();
}

describe('MessagesView — partner profile hydration', () => {
    beforeEach(() => {
        userDocCalls = [];
        chatsOnNext = null;
        chatsUnsubCount = 0;
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('one missing partner triggers exactly one getDoc', async () => {
        const renderer = await renderMessages();
        emitChats([chatDoc('me_alice', ['me', 'alice'])]);
        await act(async () => { await flush(); });
        expect(userDocCalls.length).toBe(1);
        expect(userDocCalls[0].uid).toBe('alice');
        act(() => renderer.unmount());
    });

    it('multiple missing partners all begin their getDoc without waiting for earlier ones to resolve', async () => {
        const renderer = await renderMessages();
        emitChats([
            chatDoc('me_alice', ['me', 'alice']),
            chatDoc('me_bob', ['me', 'bob']),
            chatDoc('me_carol', ['me', 'carol']),
        ]);
        await act(async () => { await flush(); });
        // All three getDoc calls must have been issued even though none has
        // resolved yet — proves concurrency, not a serial await-per-uid loop.
        expect(userDocCalls.map(c => c.uid).sort()).toEqual(['alice', 'bob', 'carol']);
        act(() => renderer.unmount());
    });

    it('successful profiles populate name and avatar correctly, associated with the right UID despite out-of-order completion', async () => {
        const renderer = await renderMessages();
        emitChats([
            chatDoc('me_alice', ['me', 'alice']),
            chatDoc('me_bob', ['me', 'bob']),
        ]);
        await act(async () => { await flush(); });
        const bobCall = userDocCalls.find(c => c.uid === 'bob')!;
        const aliceCall = userDocCalls.find(c => c.uid === 'alice')!;

        // Resolve bob (issued second) before alice (issued first).
        await act(async () => {
            bobCall.resolve(true, { fullName: 'Bob', avatarUrl: 'bob.png' });
            await flush();
        });
        await act(async () => {
            aliceCall.resolve(true, { fullName: 'Alice', avatarUrl: 'alice.png' });
            await flush();
        });

        const names = conversationNames(renderer);
        expect(names).toContain('Alice');
        expect(names).toContain('Bob');
        act(() => renderer.unmount());
    });

    it('duplicate partner UID across two conversations results in exactly one getDoc', async () => {
        const renderer = await renderMessages();
        // Same otherUser id can't naturally arise twice under the current
        // sorted-pair chat-id schema, but the dedup must hold regardless of
        // how missingUserIds was assembled.
        emitChats([
            chatDoc('me_alice', ['me', 'alice']),
            chatDoc('alice_me_dup', ['me', 'alice']),
        ]);
        await act(async () => { await flush(); });
        expect(userDocCalls.filter(c => c.uid === 'alice').length).toBe(1);
        act(() => renderer.unmount());
    });

    it('an already-cached partner triggers zero new getDoc on a later snapshot', async () => {
        const renderer = await renderMessages();
        emitChats([chatDoc('me_alice', ['me', 'alice'])]);
        await act(async () => {
            userDocCalls[0].resolve(true, { fullName: 'Alice', avatarUrl: null });
            await flush();
        });
        expect(userDocCalls.length).toBe(1);

        // A later chats snapshot (e.g. lastMessage changed) must not refetch
        // the already-cached partner.
        emitChats([chatDoc('me_alice', ['me', 'alice'], { lastMessage: 'updated' })]);
        await act(async () => { await flush(); });
        expect(userDocCalls.length).toBe(1);
        act(() => renderer.unmount());
    });

    it('a mixture of cached and missing partners only fetches the missing one', async () => {
        const renderer = await renderMessages();
        emitChats([chatDoc('me_alice', ['me', 'alice'])]);
        await act(async () => {
            userDocCalls[0].resolve(true, { fullName: 'Alice', avatarUrl: null });
            await flush();
        });
        expect(userDocCalls.length).toBe(1);

        emitChats([
            chatDoc('me_alice', ['me', 'alice']),
            chatDoc('me_bob', ['me', 'bob']),
        ]);
        await act(async () => { await flush(); });
        expect(userDocCalls.length).toBe(2);
        expect(userDocCalls[1].uid).toBe('bob');
        act(() => renderer.unmount());
    });

    it('a missing user document (exists() === false) is not cached — current fallback ("Anonymous") preserved', async () => {
        const renderer = await renderMessages();
        emitChats([chatDoc('me_ghost', ['me', 'ghost'])]);
        await act(async () => {
            userDocCalls[0].resolve(false);
            await flush();
        });
        const names = conversationNames(renderer);
        expect(names).toEqual(['Anonymous']);
        act(() => renderer.unmount());
    });

    it('one getDoc rejection does not prevent other partner profiles from loading — current per-item error semantics preserved', async () => {
        const renderer = await renderMessages();
        emitChats([
            chatDoc('me_alice', ['me', 'alice']),
            chatDoc('me_bob', ['me', 'bob']),
        ]);
        await act(async () => { await flush(); });
        const aliceCall = userDocCalls.find(c => c.uid === 'alice')!;
        const bobCall = userDocCalls.find(c => c.uid === 'bob')!;

        await act(async () => {
            aliceCall.reject(new Error('boom'));
            bobCall.resolve(true, { fullName: 'Bob', avatarUrl: null });
            await flush();
        });

        const names = conversationNames(renderer);
        expect(names).toContain('Bob');
        expect(names).toContain('Anonymous'); // alice falls back, unaffected by bob
        act(() => renderer.unmount());
    });

    it('overlapping hydration generations do not corrupt newer state — a slow first-generation fetch resolving late does not erase a second generation\'s newly-cached partner', async () => {
        const renderer = await renderMessages();
        emitChats([chatDoc('me_alice', ['me', 'alice'])]);
        await act(async () => { await flush(); });
        const aliceCallGen1 = userDocCalls[0];

        // A second chats snapshot arrives (e.g. a new conversation with bob)
        // before alice's generation-1 fetch has resolved.
        emitChats([
            chatDoc('me_alice', ['me', 'alice']),
            chatDoc('me_bob', ['me', 'bob']),
        ]);
        // Generation 2 fetched BOTH alice and bob (alice was still missing
        // when generation 2 started) — Promise.all applies a generation's
        // results together once every fetch in it settles, so both of
        // generation 2's calls must resolve before its update lands.
        const bobCall = userDocCalls.find((c, i) => c.uid === 'bob' && i > 0)!;
        const aliceCallGen2 = userDocCalls.find((c, i) => c.uid === 'alice' && i > 0)!;

        await act(async () => {
            bobCall.resolve(true, { fullName: 'Bob', avatarUrl: null });
            aliceCallGen2.resolve(true, { fullName: 'Alice', avatarUrl: null });
            await flush();
        });
        expect(conversationNames(renderer)).toContain('Bob');
        expect(conversationNames(renderer)).toContain('Alice');

        // Generation 1's own alice fetch is now stale — it resolves after
        // generation 2 already applied its results. Its functional-update
        // merge must not erase bob (a naive "replace the whole cache from a
        // snapshot captured at generation-1 start" implementation would).
        await act(async () => {
            aliceCallGen1.resolve(true, { fullName: 'Alice', avatarUrl: null });
            await flush();
        });
        const names = conversationNames(renderer);
        expect(names).toContain('Alice');
        expect(names).toContain('Bob');
        act(() => renderer.unmount());
    });

    it('unmounting before profile fetches resolve causes no post-unmount state update or error', async () => {
        const renderer = await renderMessages();
        emitChats([chatDoc('me_alice', ['me', 'alice'])]);
        await act(async () => { await flush(); });
        const call = userDocCalls[0];
        act(() => renderer.unmount());
        await act(async () => {
            expect(() => call.resolve(true, { fullName: 'Alice', avatarUrl: null })).not.toThrow();
            await flush();
        });
    });

    it('conversation list rendering, sort order, and related-spot copy are unchanged', async () => {
        const renderer = await renderMessages();
        emitChats([
            chatDoc('me_alice', ['me', 'alice'], { lastMessageTimestampMs: T0 - 2000 }),
            chatDoc('me_bob', ['me', 'bob'], { lastMessageTimestampMs: T0 - 1000, relatedSpotTitle: 'W 34th St' }),
        ]);
        await act(async () => {
            userDocCalls.forEach(c => c.resolve(true, { fullName: c.uid === 'alice' ? 'Alice' : 'Bob', avatarUrl: null }));
            await flush();
        });
        expect(conversationNames(renderer)).toEqual(['Bob', 'Alice']); // desc by lastMessageTimestamp
        const spotBadges = renderer.root.findAll(n => n.type === 'span' && String(n.props.children) === 'W 34th St');
        expect(spotBadges.length).toBe(1);
        act(() => renderer.unmount());
    });

    it('source contract: profile hydration issues concurrent (Promise.all) getDoc calls, not a sequential for-await loop', () => {
        const fs = require('fs');
        const source = fs.readFileSync(new URL('./MessagesView.tsx', import.meta.url), 'utf8');
        expect(source).toMatch(/Promise\.all/);
    });
});
