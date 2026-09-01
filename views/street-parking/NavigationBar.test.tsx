import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppView } from '../../types';
import { NavigationBar } from './NavigationBar';

vi.hoisted(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
});

describe('mobile primary navigation', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the four approved destinations reachable in their approved order', () => {
    const setView = vi.fn();
    const renderer = TestRenderer.create(
      <NavigationBar
        currentView={AppView.MAP}
        setView={setView}
        unreadMessagesCount={2}
        pendingUpdatesCount={3}
      />,
    );

    const nav = renderer.root.findByProps({ 'aria-label': 'Primary navigation' });
    const buttons = nav.findAllByType('button');
    expect(buttons.map(button => button.props['aria-label'])).toEqual([
      'Map',
      'Nearby Activity, 3 new',
      'Messages, 2 unread',
      'Profile',
    ]);

    const expectedViews = [
      AppView.MAP,
      AppView.NOTIFICATIONS,
      AppView.MESSAGES,
      AppView.PROFILE,
    ];
    buttons.forEach((button, index) => act(() => button.props.onClick()));
    expect(setView.mock.calls.map(([view]) => view)).toEqual(expectedViews);
  });

  it('exposes one clear current destination and preserves notification badges', () => {
    const renderer = TestRenderer.create(
      <NavigationBar
        currentView={AppView.MESSAGES}
        setView={vi.fn()}
        unreadMessagesCount={2}
        pendingUpdatesCount={3}
      />,
    );

    const nav = renderer.root.findByProps({ 'aria-label': 'Primary navigation' });
    const buttons = nav.findAllByType('button');
    expect(buttons.filter(button => button.props['aria-current'] === 'page').map(button => button.props['aria-label']))
      .toEqual(['Messages, 2 unread']);
    expect(renderer.root.findByProps({ 'data-nav-badge': 'activity' }).children).toEqual(['3']);
    expect(renderer.root.findByProps({ 'data-nav-badge': 'messages' }).children).toEqual(['2']);
  });

  it('announces singular counts and caps large visual/accessibility counts consistently', () => {
    const renderer = TestRenderer.create(
      <NavigationBar
        currentView={AppView.MAP}
        setView={vi.fn()}
        unreadMessagesCount={1}
        pendingUpdatesCount={100}
      />,
    );
    const nav = renderer.root.findByProps({ 'aria-label': 'Primary navigation' });
    expect(nav.findByProps({ 'aria-label': 'Messages, 1 unread' })).toBeDefined();
    expect(nav.findByProps({ 'aria-label': 'Nearby Activity, 99+ new' })).toBeDefined();
    expect(renderer.root.findByProps({ 'data-nav-badge': 'activity' }).children).toEqual(['99+']);
  });
});
