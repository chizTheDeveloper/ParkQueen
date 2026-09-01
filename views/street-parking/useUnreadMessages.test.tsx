import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    clear: () => store.clear(),
  };
  (globalThis as any).window = new EventTarget();
});

let snapshotHandler: ((snapshot: any) => void) | undefined;

vi.mock('../../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  onSnapshot: (_query: unknown, handler: (snapshot: any) => void) => {
    snapshotHandler = handler;
    return () => {};
  },
}));

import { notifyChatRead, useUnreadMessages } from './useUnreadMessages';

function Harness() {
  const count = useUnreadMessages('me');
  return <span>{count}</span>;
}

describe('useUnreadMessages', () => {
  beforeEach(() => {
    localStorage.clear();
    snapshotHandler = undefined;
  });

  it('recomputes immediately when the active chat is marked read locally', () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<Harness />); });
    const timestamp = { toMillis: () => 100 };
    act(() => snapshotHandler?.({ docs: [{ id: 'chat-1', data: () => ({ lastMessageTimestamp: timestamp, lastSenderId: 'other' }) }] }));
    expect(renderer!.root.findByType('span').children).toEqual(['1']);

    localStorage.setItem('lastReadChat_chat-1', '101');
    act(() => notifyChatRead());
    expect(renderer!.root.findByType('span').children).toEqual(['0']);
    act(() => renderer!.unmount());
  });
});
