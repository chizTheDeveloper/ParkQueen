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
interface CallableCall { name: string; payload: any }
let callableCalls: CallableCall[] = [];
// When null, every callable invocation resolves immediately with a generic
// success shape. Set to a function for a specific test to control
// resolution/rejection/pending timing (e.g. proving double-click safety, or
// error-path UX).
let callableImpl: ((name: string, payload: any) => Promise<any>) | null = null;

vi.mock('firebase/functions', () => ({
    getFunctions: () => ({}),
    httpsCallable: (_functions: any, name: string) => async (payload: any) => {
        callableCalls.push({ name, payload });
        if (callableImpl) return callableImpl(name, payload);
        return { data: { success: true } };
    },
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

interface MessagesSnapshotCall {
    constraints: any[];
    onNext: (snap: any) => void;
}
let messagesSnapshotCalls: MessagesSnapshotCall[] = [];
let messagesUnsubCount = 0;

interface OlderPageCall {
    constraints: any[];
    resolve: (docs: any[]) => void;
    reject: (err: unknown) => void;
}
let olderPageCalls: OlderPageCall[] = [];
// When null, every older-page getDocs call auto-resolves immediately with
// this doc array (default: empty). Set to null to take manual control.
let olderPageAutoDocs: any[] | null = [];

vi.mock('firebase/firestore', () => ({
    collection: (_db: any, ...path: string[]) => ({ __col: path }),
    doc: (_db: any, ...path: string[]) => ({ __doc: path }),
    query: (base: any, ...constraints: any[]) => ({ ...base, __constraints: constraints }),
    where: (field: string, op: string, value: any) => ({ __kind: 'where', field, op, value }),
    orderBy: (field: string, dir?: string) => ({ __kind: 'orderBy', field, dir }),
    limit: (n: number) => ({ __kind: 'limit', n }),
    startAfter: (cursor: any) => ({ __kind: 'startAfter', cursor }),
    onSnapshot: (q: any, onNext: any) => {
        if (Array.isArray(q.__col) && q.__col.length === 1 && q.__col[0] === 'chats') {
            chatsOnNext = onNext;
            return () => { chatsUnsubCount++; };
        }
        if (Array.isArray(q.__col) && q.__col.length === 3 && q.__col[0] === 'chats' && q.__col[2] === 'messages') {
            messagesSnapshotCalls.push({ constraints: q.__constraints, onNext });
            return () => { messagesUnsubCount++; };
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
    getDocs: (q: any) => new Promise((resolve, reject) => {
        const call: OlderPageCall = {
            constraints: q.__constraints,
            resolve: (docs: any[]) => resolve({ docs }),
            reject,
        };
        olderPageCalls.push(call);
        if (olderPageAutoDocs !== null) call.resolve(olderPageAutoDocs);
    }),
    addDoc: async () => ({ id: 'x' }),
    setDoc: async () => {},
    writeBatch: () => ({ delete: () => {}, commit: async () => {} }),
    updateDoc: async () => {},
    serverTimestamp: () => ({ __serverTimestamp: true }),
}));

const { reportCriticalActionFailure } = vi.hoisted(() => ({ reportCriticalActionFailure: vi.fn() }));
vi.mock('../utils/errorReporting', () => ({ reportCriticalActionFailure }));

import { MessagesView } from './MessagesView';
import { t } from '../i18n';

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

// Shared mock for every ref in the tree — messagesEndRef only ever calls
// scrollIntoView() on it, messagesContainerRef only ever reads/writes
// scrollTop/scrollHeight on it. Using one object for both is safe because
// the two operations never interact.
let scrollMock: { scrollIntoView: ReturnType<typeof vi.fn>; scrollTop: number; scrollHeight: number };
function resetScrollMock() {
    scrollMock = { scrollIntoView: vi.fn(), scrollTop: 0, scrollHeight: 0 };
}
function createNodeMock() {
    return scrollMock;
}

async function renderMessages(props: Partial<React.ComponentProps<typeof MessagesView>> = {}) {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
        renderer = TestRenderer.create(React.createElement(MessagesView, {
            user: { id: 'me', blockedUsers: [] },
            activeChatContext: null,
            onBack: () => {},
            ...props,
        }), { createNodeMock });
    });
    return renderer!;
}

function emitChats(docs: any[]) {
    act(() => { chatsOnNext!({ docs }); });
}

function messageDoc(id: string, opts: { senderId: string; text: string; ms: number }) {
    return {
        id,
        data: () => ({ senderId: opts.senderId, text: opts.text, timestamp: tsAt(opts.ms) }),
    };
}

/** Emits a messages-listener snapshot with explicit docChanges — docsNewestFirst
 * represents the full current result set (only read by the component on the
 * very first snapshot, to capture the historical pagination cursor). */
function emitMessages(callIndex: number, docsNewestFirst: any[], changes: Array<{ type: 'added' | 'modified' | 'removed'; doc: any }>) {
    const call = messagesSnapshotCalls[callIndex];
    act(() => { call.onNext({ docs: docsNewestFirst, docChanges: () => changes }); });
}

function added(docs: any[]) { return docs.map(doc => ({ type: 'added' as const, doc })); }

function messageBubbleTexts(renderer: TestRenderer.ReactTestRenderer): string[] {
    return renderer.root.findAll(
        n => n.type === 'p' && n.props.className === 'text-sm',
    ).map(n => String(n.props.children));
}

function loadEarlierButton(renderer: TestRenderer.ReactTestRenderer) {
    return renderer.root.findAll(n => n.type === 'button' && n.props['aria-label'] === 'Load earlier messages')[0];
}
function loadEarlierVisible(renderer: TestRenderer.ReactTestRenderer): boolean {
    return loadEarlierButton(renderer) !== undefined;
}
function clickLoadEarlier(renderer: TestRenderer.ReactTestRenderer) {
    act(() => { loadEarlierButton(renderer).props.onClick(); });
}

function conversationNames(renderer: TestRenderer.ReactTestRenderer): string[] {
    return renderer.root.findAll(
        n => n.type === 'span' && typeof n.props.className === 'string' && n.props.className.includes('truncate pr-2') && n.props.className.includes('text-sm'),
    ).map(n => String(n.props.children));
}

async function flush(ticks = 8) {
    for (let i = 0; i < ticks; i++) await Promise.resolve();
}

function clickButtonWithText(renderer: TestRenderer.ReactTestRenderer, text: string) {
    const btn = renderer.root.findAll(n => n.type === 'button' && n.props.children === text)[0];
    act(() => { btn.props.onClick(); });
}

function clickButtonWithAriaLabel(renderer: TestRenderer.ReactTestRenderer, label: string) {
    const btn = renderer.root.findAll(n => n.type === 'button' && n.props['aria-label'] === label)[0];
    act(() => { btn.props.onClick(); });
}

function conversationRowButtons(renderer: TestRenderer.ReactTestRenderer) {
    return renderer.root.findAll(
        n => n.type === 'button' && typeof n.props.className === 'string' && n.props.className.includes('rounded-2xl') && n.props.className.includes('p-3.5'),
    );
}
function openFirstConversation(renderer: TestRenderer.ReactTestRenderer) {
    act(() => { conversationRowButtons(renderer)[0].props.onClick(); });
}
function openConversationAt(renderer: TestRenderer.ReactTestRenderer, index: number) {
    act(() => { conversationRowButtons(renderer)[index].props.onClick(); });
}
function goBackToInbox(renderer: TestRenderer.ReactTestRenderer) {
    const btn = renderer.root.findAll(n => n.type === 'button' && n.props['aria-label'] === 'Back to inbox')[0];
    act(() => { btn.props.onClick(); });
}

function openDeleteConfirm(renderer: TestRenderer.ReactTestRenderer) {
    clickButtonWithAriaLabel(renderer, 'More options');
    clickButtonWithText(renderer, 'Delete Chat');
}

function isInConversationDetail(renderer: TestRenderer.ReactTestRenderer): boolean {
    return renderer.root.findAll(n => n.type === 'button' && n.props['aria-label'] === 'More options').length > 0;
}

function deleteConfirmDialogVisible(renderer: TestRenderer.ReactTestRenderer): boolean {
    return renderer.root.findAll(n => n.type === 'button' && n.props.children === 'Delete').length > 0;
}

function getMessageInput(renderer: TestRenderer.ReactTestRenderer) {
    return renderer.root.findByProps({ placeholder: t('messages.type_placeholder') });
}
function getSendButton(renderer: TestRenderer.ReactTestRenderer) {
    return getMessageInput(renderer).parent!.findByType('button');
}
async function typeAndSend(renderer: TestRenderer.ReactTestRenderer, text: string) {
    act(() => { getMessageInput(renderer).props.onChange({ target: { value: text } }); });
    await act(async () => {
        getSendButton(renderer).props.onClick();
        await flush();
    });
}

describe('MessagesView — partner profile hydration', () => {
    beforeEach(() => {
        userDocCalls = [];
        chatsOnNext = null;
        chatsUnsubCount = 0;
        callableCalls = [];
        callableImpl = null;
        messagesSnapshotCalls = [];
        messagesUnsubCount = 0;
        olderPageCalls = [];
        olderPageAutoDocs = [];
        resetScrollMock();
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

describe('MessagesView — delete conversation via server-mediated callable', () => {
    beforeEach(() => {
        userDocCalls = [];
        chatsOnNext = null;
        chatsUnsubCount = 0;
        callableCalls = [];
        callableImpl = null;
        messagesSnapshotCalls = [];
        messagesUnsubCount = 0;
        olderPageCalls = [];
        olderPageAutoDocs = [];
        resetScrollMock();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    async function renderInsideAConversation() {
        const renderer = await renderMessages();
        emitChats([chatDoc('me_alice', ['me', 'alice'])]);
        await act(async () => { await flush(); });
        openFirstConversation(renderer);
        return renderer;
    }

    it('clicking "Delete Chat" opens the confirmation dialog', async () => {
        const renderer = await renderInsideAConversation();
        openDeleteConfirm(renderer);
        expect(deleteConfirmDialogVisible(renderer)).toBe(true);
        act(() => renderer.unmount());
    });

    it('confirming invokes the deleteChat callable exactly once, with the exact selected chatId as payload', async () => {
        const renderer = await renderInsideAConversation();
        openDeleteConfirm(renderer);
        await act(async () => {
            clickButtonWithText(renderer, 'Delete');
            await flush();
        });
        expect(callableCalls.length).toBe(1);
        expect(callableCalls[0].name).toBe('deleteChat');
        expect(callableCalls[0].payload).toEqual({ chatId: 'me_alice' });
        act(() => renderer.unmount());
    });

    it('source contract: conversation deletion no longer enumerates or batch-deletes messages client-side — it is a single callable request, independent of message count', () => {
        const fs = require('fs');
        const source = fs.readFileSync(new URL('./MessagesView.tsx', import.meta.url), 'utf8');
        const fnStart = source.indexOf('const doDeleteChat');
        const fnEnd = source.indexOf('\n  };', fnStart);
        const body = source.slice(fnStart, fnEnd);
        expect(body).not.toMatch(/getDocs/);
        expect(body).not.toMatch(/writeBatch/);
        expect(body).not.toMatch(/batch\.delete/);
        expect(body).toMatch(/deleteChat/);
    });

    it('a successful deletion clears the active conversation, returning to the list view', async () => {
        const renderer = await renderInsideAConversation();
        expect(isInConversationDetail(renderer)).toBe(true);
        openDeleteConfirm(renderer);
        await act(async () => {
            clickButtonWithText(renderer, 'Delete');
            await flush();
        });
        expect(isInConversationDetail(renderer)).toBe(false);
        act(() => renderer.unmount());
    });

    it('a rejected deleteChat call preserves the existing failure UX — stays in the conversation, confirm dialog closes, controls usable again for retry', async () => {
        callableImpl = async () => { throw Object.assign(new Error('nope'), { code: 'permission-denied' }); };
        const renderer = await renderInsideAConversation();
        openDeleteConfirm(renderer);
        await act(async () => {
            clickButtonWithText(renderer, 'Delete');
            await flush();
        });
        expect(isInConversationDetail(renderer)).toBe(true);
        expect(deleteConfirmDialogVisible(renderer)).toBe(false);
        expect(renderer.root.findAll(n => n.type === 'p' && n.props.children === 'Failed to delete conversation.').length).toBe(1);

        // Controls usable again — can reopen the confirm dialog and retry.
        openDeleteConfirm(renderer);
        expect(deleteConfirmDialogVisible(renderer)).toBe(true);
        act(() => renderer.unmount());
    });

    it('a double-click on the confirm Delete button while the first request is still pending issues exactly one callable request', async () => {
        let releasePending: (() => void) | null = null;
        callableImpl = () => new Promise((resolve) => { releasePending = () => resolve({ data: { success: true } }); });

        const renderer = await renderInsideAConversation();
        openDeleteConfirm(renderer);

        const deleteBtn = () => renderer.root.findAll(n => n.type === 'button' && n.props.children === 'Delete')[0];
        act(() => { deleteBtn().props.onClick(); }); // first click — now pending
        // Visually disabled while pending...
        expect(deleteBtn().props.disabled).toBe(true);
        // ...and the code-level guard (not just the DOM disabled attribute,
        // which react-test-renderer doesn't itself enforce) rejects a second
        // click's onClick invoked directly while the first is still pending.
        act(() => { deleteBtn().props.onClick(); });

        expect(callableCalls.length).toBe(1);

        await act(async () => {
            releasePending!();
            await flush();
        });
        expect(callableCalls.length).toBe(1);
        act(() => renderer.unmount());
    });
});

describe('MessagesView — bounded message history pagination', () => {
    beforeEach(() => {
        userDocCalls = [];
        chatsOnNext = null;
        chatsUnsubCount = 0;
        callableCalls = [];
        callableImpl = null;
        messagesSnapshotCalls = [];
        messagesUnsubCount = 0;
        olderPageCalls = [];
        olderPageAutoDocs = [];
        resetScrollMock();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    async function openConversationLive() {
        const renderer = await renderMessages();
        emitChats([chatDoc('me_alice', ['me', 'alice'])]);
        await act(async () => { await flush(); });
        openFirstConversation(renderer);
        return renderer;
    }

    function msg(id: string, ms: number, senderId: string = 'alice') {
        return messageDoc(id, { senderId, text: id, ms });
    }

    // ─── Query shape ─────────────────────────────────────────────────────

    it('the live messages listener queries orderBy(timestamp desc) + limit(30), not the old unbounded ascending query', async () => {
        const renderer = await openConversationLive();
        expect(messagesSnapshotCalls.length).toBe(1);
        const constraints = messagesSnapshotCalls[0].constraints;
        expect(constraints.some((c: any) => c.__kind === 'orderBy' && c.field === 'timestamp' && c.dir === 'desc')).toBe(true);
        expect(constraints.some((c: any) => c.__kind === 'limit' && c.n === 30)).toBe(true);
        expect(constraints.some((c: any) => c.__kind === 'orderBy' && c.dir === 'asc')).toBe(false);
        act(() => renderer.unmount());
    });

    it('the initial snapshot is displayed in chronological ascending order regardless of the descending fetch order', async () => {
        const renderer = await openConversationLive();
        emitMessages(0, [msg('m3', T0 + 2000), msg('m2', T0 + 1000), msg('m1', T0)], added([msg('m1', T0), msg('m2', T0 + 1000), msg('m3', T0 + 2000)]));
        expect(messageBubbleTexts(renderer)).toEqual(['m1', 'm2', 'm3']);
        act(() => renderer.unmount());
    });

    it('fewer than 30 initial messages shows no Load earlier control', async () => {
        const renderer = await openConversationLive();
        const docs = [msg('m2', T0 + 1000), msg('m1', T0)];
        emitMessages(0, docs, added(docs));
        expect(loadEarlierVisible(renderer)).toBe(false);
        act(() => renderer.unmount());
    });

    it('exactly 30 initial messages makes the Load earlier control available', async () => {
        const renderer = await openConversationLive();
        const docs = Array.from({ length: 30 }, (_, i) => msg(`m${29 - i}`, T0 + (29 - i) * 1000)); // newest-first
        emitMessages(0, docs, added(docs));
        expect(loadEarlierVisible(renderer)).toBe(true);
        act(() => renderer.unmount());
    });

    // ─── Pagination ──────────────────────────────────────────────────────

    it('Load earlier issues a getDocs query with orderBy(timestamp desc) + startAfter(the actual oldest DocumentSnapshot) + limit(30)', async () => {
        const renderer = await openConversationLive();
        const oldest = msg('m1', T0);
        const docs = Array.from({ length: 30 }, (_, i) => (i === 29 ? oldest : msg(`m${29 - i}`, T0 + (29 - i) * 1000)));
        olderPageAutoDocs = null;
        emitMessages(0, docs, added(docs));

        clickLoadEarlier(renderer);
        expect(olderPageCalls.length).toBe(1);
        const constraints = olderPageCalls[0].constraints;
        expect(constraints.some((c: any) => c.__kind === 'orderBy' && c.field === 'timestamp' && c.dir === 'desc')).toBe(true);
        expect(constraints.some((c: any) => c.__kind === 'startAfter' && c.cursor === oldest)).toBe(true);
        expect(constraints.some((c: any) => c.__kind === 'limit' && c.n === 30)).toBe(true);
        act(() => renderer.unmount());
    });

    it('live window eviction never removes an already-loaded message — repeated evictions keep gapless retained history (K=3 conceptual walkthrough exactly as specified)', async () => {
        const renderer = await openConversationLive();

        // Initial live window (conceptually K=3): messages 1,2,3.
        const m1 = msg('m1', T0 - 3000), m2 = msg('m2', T0 - 2000), m3 = msg('m3', T0 - 1000);
        emitMessages(0, [m3, m2, m1], added([m1, m2, m3]));
        expect(messageBubbleTexts(renderer)).toEqual(['m1', 'm2', 'm3']);

        // Message 4 arrives — live query becomes 2,3,4 and emits removed(1).
        const m4 = msg('m4', T0);
        emitMessages(0, [m4, m3, m2], [{ type: 'added', doc: m4 }, { type: 'removed', doc: m1 }]);
        expect(messageBubbleTexts(renderer)).toEqual(['m1', 'm2', 'm3', 'm4']); // NOT ['m2','m3','m4']

        // The historical pagination cursor must still point at m1 (the
        // oldest of the ORIGINAL initial page) — never moved forward by
        // the eviction above. Older-page merge/dedup/cursor-advance
        // mechanics themselves are proven separately (with the real
        // MESSAGE_PAGE_SIZE=30 threshold, since hasMoreOlder only becomes
        // true at exactly 30 initial documents) by the dedicated
        // query-shape and retry tests above.

        // Message 5 arrives afterward — live query shifts again (evicting 2).
        const m5 = msg('m5', T0 + 1000);
        emitMessages(0, [m5, m4, m3], [{ type: 'added', doc: m5 }, { type: 'removed', doc: m2 }]);
        expect(messageBubbleTexts(renderer)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']); // still all five, gapless

        act(() => renderer.unmount());
    });

    it('fewer than 30 documents returned by an older page sets hasMoreOlder to false', async () => {
        const renderer = await openConversationLive();
        const docs = Array.from({ length: 30 }, (_, i) => msg(`m${29 - i}`, T0 + (29 - i) * 1000));
        olderPageAutoDocs = null;
        emitMessages(0, docs, added(docs));
        clickLoadEarlier(renderer);
        await act(async () => {
            olderPageCalls[0].resolve([msg('older1', T0 - 1000)]);
            await flush();
        });
        expect(loadEarlierVisible(renderer)).toBe(false);
        act(() => renderer.unmount());
    });

    it('an older-page failure preserves already-loaded messages and cursor, and retry remains possible', async () => {
        const renderer = await openConversationLive();
        const docs = Array.from({ length: 30 }, (_, i) => msg(`m${29 - i}`, T0 + (29 - i) * 1000));
        olderPageAutoDocs = null;
        emitMessages(0, docs, added(docs));
        const beforeTexts = messageBubbleTexts(renderer);

        clickLoadEarlier(renderer);
        await act(async () => {
            olderPageCalls[0].reject(new Error('boom'));
            await flush();
        });
        expect(messageBubbleTexts(renderer)).toEqual(beforeTexts); // unchanged
        expect(loadEarlierVisible(renderer)).toBe(true); // still available — retry possible
        expect(renderer.root.findAll(n => n.type === 'p' && n.props.children === 'Failed to load earlier messages.').length).toBe(1);

        // Retry succeeds normally.
        await act(async () => {
            clickLoadEarlier(renderer);
            olderPageCalls[1].resolve([msg('older1', T0 - 5000)]);
            await flush();
        });
        expect(messageBubbleTexts(renderer)).toContain('older1');
        act(() => renderer.unmount());
    });

    it('a second Load earlier click while the first is still pending issues only one older-page request', async () => {
        const renderer = await openConversationLive();
        const docs = Array.from({ length: 30 }, (_, i) => msg(`m${29 - i}`, T0 + (29 - i) * 1000));
        olderPageAutoDocs = null;
        emitMessages(0, docs, added(docs));

        olderPageAutoDocs = null;
        clickLoadEarlier(renderer); // first click — now pending
        expect(loadEarlierButton(renderer).props.disabled).toBe(true);
        // Code-level guard, invoked directly (react-test-renderer doesn't
        // itself enforce the disabled attribute).
        act(() => { loadEarlierButton(renderer)?.props.onClick(); });

        expect(olderPageCalls.length).toBe(1);
        await act(async () => {
            olderPageCalls[0].resolve([]);
            await flush();
        });
        expect(olderPageCalls.length).toBe(1);
        act(() => renderer.unmount());
    });

    // ─── modified events ─────────────────────────────────────────────────

    it('a modified change type updates the retained message content by ID', async () => {
        const renderer = await openConversationLive();
        const m1 = msg('m1', T0);
        emitMessages(0, [m1], added([m1]));
        expect(messageBubbleTexts(renderer)).toEqual(['m1']);

        const m1Edited = messageDoc('m1', { senderId: 'alice', text: 'm1-edited', ms: T0 });
        emitMessages(0, [m1Edited], [{ type: 'modified', doc: m1Edited }]);
        expect(messageBubbleTexts(renderer)).toEqual(['m1-edited']);
        act(() => renderer.unmount());
    });

    // ─── Whole-chat deletion ─────────────────────────────────────────────

    it('message removed events alone do not exit the conversation or clear retained history — only the chats listener disappearing does', async () => {
        const renderer = await openConversationLive();
        const m1 = msg('m1', T0);
        emitMessages(0, [m1], added([m1]));
        expect(isInConversationDetail(renderer)).toBe(true);

        // Server-mediated whole-chat deletion in progress: the messages
        // listener can emit removed() for real, already-loaded messages
        // before the conversations listener reports the parent chat gone.
        emitMessages(0, [], [{ type: 'removed', doc: m1 }]);
        expect(isInConversationDetail(renderer)).toBe(true);
        expect(messageBubbleTexts(renderer)).toEqual(['m1']); // NOT cleared

        // Now the chats listener reports the chat itself is gone.
        emitChats([]);
        await act(async () => { await flush(); });
        expect(isInConversationDetail(renderer)).toBe(false);
        act(() => renderer.unmount());
    });

    it('after whole-chat deletion exits the view, opening a different conversation starts with clean pagination state (no leaked history)', async () => {
        const renderer = await renderMessages();
        emitChats([chatDoc('me_alice', ['me', 'alice'])]);
        await act(async () => { await flush(); });
        openFirstConversation(renderer);
        const m1 = msg('m1', T0);
        emitMessages(0, [m1], added([m1]));
        expect(messageBubbleTexts(renderer)).toEqual(['m1']);

        emitChats([]); // alice's chat is gone
        await act(async () => { await flush(); });
        expect(isInConversationDetail(renderer)).toBe(false);

        emitChats([chatDoc('me_bob', ['me', 'bob'])]);
        await act(async () => { await flush(); });
        openFirstConversation(renderer);
        expect(messageBubbleTexts(renderer)).toEqual([]); // clean slate, not leaking alice's m1
        act(() => renderer.unmount());
    });

    // ─── Races ───────────────────────────────────────────────────────────

    it('switching conversations unsubscribes the previous messages listener, and a late callback from it cannot affect the newly active conversation', async () => {
        const renderer = await renderMessages();
        emitChats([
            chatDoc('me_alice', ['me', 'alice'], { lastMessageTimestampMs: T0 - 1000 }),
            chatDoc('me_bob', ['me', 'bob'], { lastMessageTimestampMs: T0 }),
        ]);
        await act(async () => { await flush(); });

        openConversationAt(renderer, 0); // bob (newest lastMessageTimestamp, sorts first)
        const bobMsgCall = messagesSnapshotCalls[0];
        expect(messagesUnsubCount).toBe(0);

        goBackToInbox(renderer);
        openConversationAt(renderer, 1); // alice
        expect(messagesUnsubCount).toBe(1); // bob's listener torn down on switch
        const mAlice = msg('a1', T0, 'alice');
        emitMessages(1, [mAlice], added([mAlice]));
        expect(messageBubbleTexts(renderer)).toEqual(['a1']);

        // A late callback from bob's already-unsubscribed listener must not
        // corrupt alice's display.
        const mBobLate = msg('b-late', T0 + 5000, 'bob');
        act(() => { bobMsgCall.onNext({ docs: [mBobLate], docChanges: () => added([mBobLate]) }); });
        expect(messageBubbleTexts(renderer)).toEqual(['a1']);

        act(() => renderer.unmount());
    });

    it('a late-resolving older-page request from a previous conversation does not mutate the newly active conversation\'s messages', async () => {
        const renderer = await renderMessages();
        emitChats([
            chatDoc('me_alice', ['me', 'alice'], { lastMessageTimestampMs: T0 - 1000 }),
            chatDoc('me_bob', ['me', 'bob'], { lastMessageTimestampMs: T0 }),
        ]);
        await act(async () => { await flush(); });

        openConversationAt(renderer, 0); // bob
        const docsB = Array.from({ length: 30 }, (_, i) => msg(`b${29 - i}`, T0 + (29 - i) * 1000, 'bob'));
        olderPageAutoDocs = null;
        emitMessages(0, docsB, added(docsB));
        clickLoadEarlier(renderer); // pending older-page request for bob
        const pendingBob = olderPageCalls[0];

        goBackToInbox(renderer);
        openConversationAt(renderer, 1); // alice
        const mAlice = msg('a1', T0, 'alice');
        emitMessages(1, [mAlice], added([mAlice]));
        expect(messageBubbleTexts(renderer)).toEqual(['a1']);

        // Bob's stale page resolves late — must not corrupt alice's display.
        await act(async () => {
            pendingBob.resolve([msg('late-bob', T0 - 100000, 'bob')]);
            await flush();
        });
        expect(messageBubbleTexts(renderer)).toEqual(['a1']);
        act(() => renderer.unmount());
    });

    it('unmounting while an older-page request is in flight causes no error or post-unmount state update', async () => {
        const renderer = await openConversationLive();
        const docs = Array.from({ length: 30 }, (_, i) => msg(`m${29 - i}`, T0 + (29 - i) * 1000));
        olderPageAutoDocs = null;
        emitMessages(0, docs, added(docs));
        clickLoadEarlier(renderer);
        const pending = olderPageCalls[0];
        act(() => renderer.unmount());
        await act(async () => {
            expect(() => pending.resolve([msg('late', T0 - 100000)])).not.toThrow();
            await flush();
        });
    });

    // ─── Scroll ──────────────────────────────────────────────────────────

    it('initial open scrolls to the newest message', async () => {
        const renderer = await openConversationLive();
        const m1 = msg('m1', T0);
        emitMessages(0, [m1], added([m1]));
        expect(scrollMock.scrollIntoView).toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    it('a new live message preserves the existing auto-scroll-to-bottom behavior', async () => {
        const renderer = await openConversationLive();
        const m1 = msg('m1', T0);
        emitMessages(0, [m1], added([m1]));
        scrollMock.scrollIntoView.mockClear();
        const m2 = msg('m2', T0 + 1000);
        emitMessages(0, [m2, m1], added([m2]));
        expect(scrollMock.scrollIntoView).toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    it('Load earlier does NOT trigger scroll-to-bottom (preserves the user\'s reading position)', async () => {
        const renderer = await openConversationLive();
        const docs = Array.from({ length: 30 }, (_, i) => msg(`m${29 - i}`, T0 + (29 - i) * 1000));
        olderPageAutoDocs = null;
        emitMessages(0, docs, added(docs));
        scrollMock.scrollIntoView.mockClear();

        clickLoadEarlier(renderer);
        await act(async () => {
            olderPageCalls[0].resolve([msg('older1', T0 - 5000)]);
            await flush();
        });
        expect(scrollMock.scrollIntoView).not.toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    // ─── Empty chat ──────────────────────────────────────────────────────

    it('an empty conversation shows no Load earlier control and normal empty rendering, unaffected by pagination', async () => {
        const renderer = await openConversationLive();
        emitMessages(0, [], []);
        expect(loadEarlierVisible(renderer)).toBe(false);
        expect(messageBubbleTexts(renderer)).toEqual([]);
        act(() => renderer.unmount());
    });

    // ─── Scroll-restore formula (pure function) ─────────────────────────

    it('computeRestoredScrollTop preserves the visual anchor: prevScrollTop + (newHeight - prevHeight)', async () => {
        const { computeRestoredScrollTop } = await import('./MessagesView');
        expect(computeRestoredScrollTop(100, 500, 800)).toBe(400);
        expect(computeRestoredScrollTop(0, 200, 200)).toBe(0);
    });
});

describe('MessagesView — critical-action failure reporting', () => {
    beforeEach(() => {
        userDocCalls = [];
        chatsOnNext = null;
        chatsUnsubCount = 0;
        callableCalls = [];
        callableImpl = null;
        messagesSnapshotCalls = [];
        messagesUnsubCount = 0;
        olderPageCalls = [];
        olderPageAutoDocs = [];
        reportCriticalActionFailure.mockClear();
        resetScrollMock();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    async function renderInsideAConversation() {
        const renderer = await renderMessages();
        emitChats([chatDoc('me_alice', ['me', 'alice'])]);
        await act(async () => { await flush(); });
        openFirstConversation(renderer);
        return renderer;
    }

    // ─── deleteChat ──────────────────────────────────────────────────────

    it('a rejected deleteChat call reports chat_delete exactly once, with no chat id or message content', async () => {
        const err = Object.assign(new Error('nope'), { code: 'permission-denied' });
        callableImpl = async () => { throw err; };
        const renderer = await renderInsideAConversation();
        openDeleteConfirm(renderer);
        await act(async () => {
            clickButtonWithText(renderer, 'Delete');
            await flush();
        });
        expect(reportCriticalActionFailure).toHaveBeenCalledTimes(1);
        const [action, error, context] = reportCriticalActionFailure.mock.calls[0];
        expect(action).toBe('chat_delete');
        expect(error).toBe(err);
        expect(context).toBeUndefined();
        act(() => renderer.unmount());
    });

    it('a successful deleteChat reports zero failures', async () => {
        const renderer = await renderInsideAConversation();
        openDeleteConfirm(renderer);
        await act(async () => {
            clickButtonWithText(renderer, 'Delete');
            await flush();
        });
        expect(reportCriticalActionFailure).not.toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    // ─── sendMessage ─────────────────────────────────────────────────────

    it('a genuinely unexpected sendMessage failure reports message_send exactly once, with only a safe error code — never message text', async () => {
        const err = Object.assign(new Error('internal'), { code: 'internal' });
        callableImpl = async () => { throw err; };
        const renderer = await renderInsideAConversation();

        await typeAndSend(renderer, 'a private message with secret content');

        expect(reportCriticalActionFailure).toHaveBeenCalledTimes(1);
        const [action, error, context] = reportCriticalActionFailure.mock.calls[0];
        expect(action).toBe('message_send');
        expect(error).toBe(err);
        expect(context).toEqual({ errorCode: 'internal' });
        act(() => renderer.unmount());
    });

    it('does NOT report an expected moderation rejection (functions/invalid-argument) — normal, already-diagnosed control flow', async () => {
        callableImpl = async () => { throw Object.assign(new Error('blocked'), { code: 'functions/invalid-argument' }); };
        const renderer = await renderInsideAConversation();

        await typeAndSend(renderer, 'hello');

        expect(reportCriticalActionFailure).not.toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    it('does NOT report an expected rate-limit rejection (functions/resource-exhausted)', async () => {
        callableImpl = async () => { throw Object.assign(new Error('slow down'), { code: 'functions/resource-exhausted' }); };
        const renderer = await renderInsideAConversation();

        await typeAndSend(renderer, 'hello');

        expect(reportCriticalActionFailure).not.toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    it('a successful send reports zero failures', async () => {
        const renderer = await renderInsideAConversation();

        await typeAndSend(renderer, 'hello');

        expect(reportCriticalActionFailure).not.toHaveBeenCalled();
        act(() => renderer.unmount());
    });

    it('user-facing failure behavior for sendMessage is unchanged: shows the existing toast, and the input keeps its text for retry', async () => {
        callableImpl = async () => { throw Object.assign(new Error('internal'), { code: 'internal' }); };
        const renderer = await renderInsideAConversation();

        await typeAndSend(renderer, 'hello');

        expect(renderer.root.findAll(n => n.type === 'p' && n.props.children === t('messages.toast_send_failed')).length).toBe(1);
        // Unlike the success path (which clears inputText), a failure must not
        // discard what the user typed — this is pre-existing behavior, unchanged.
        expect(getMessageInput(renderer).props.value).toBe('hello');
        act(() => renderer.unmount());
    });
});
