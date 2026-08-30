import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ updateDoc: vi.fn(), doc: vi.fn(() => ({ path: 'preferences' })) }));

vi.hoisted(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
});

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: mocks.doc, updateDoc: mocks.updateDoc }));

import { NotificationsSettingsView } from './NotificationsSettingsView';

const render = (runtime: React.ComponentProps<typeof NotificationsSettingsView>['notificationRuntime']) =>
  TestRenderer.create(
    <NotificationsSettingsView
      user={{ id: 'me', notificationsEnabled: true, notificationRadius: 2 }}
      onBack={vi.fn()}
      notificationRuntime={runtime}
      onEnableNotifications={vi.fn()}
      onRecheckNotifications={vi.fn()}
    />,
  );

describe('NotificationsSettingsView runtime truthfulness', () => {
  beforeEach(() => {
    mocks.updateDoc.mockReset().mockResolvedValue(undefined);
    mocks.doc.mockClear();
  });

  it('does not show a preference-only default state as enabled', () => {
    const renderer = render({ capability: 'supported', permission: 'default', registration: 'not_registered' });
    const toggle = renderer.root.findByProps({ 'aria-label': 'Notifications' });
    expect(toggle.props['aria-checked']).toBe(false);
    expect(renderer.root.findAllByProps({ 'data-notification-action': 'enable' })).toHaveLength(1);
  });

  it('shows enabled only after granted registration succeeds', () => {
    const renderer = render({ capability: 'supported', permission: 'granted', registration: 'registered' });
    const toggle = renderer.root.findByProps({ 'aria-label': 'Notifications' });
    expect(toggle.props['aria-checked']).toBe(true);
  });

  it('provides denied recovery through Recheck rather than another Enable prompt', () => {
    const renderer = render({ capability: 'supported', permission: 'denied', registration: 'not_registered' });
    expect(renderer.root.findAllByProps({ 'data-notification-action': 'recheck' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-notification-action': 'enable' })).toHaveLength(0);
  });

  it('turning a working registration off preserves the existing preference write', async () => {
    const renderer = render({ capability: 'supported', permission: 'granted', registration: 'registered' });
    const toggle = renderer.root.findByProps({ 'aria-label': 'Notifications' });
    await act(async () => { await toggle.props.onClick(); });
    expect(mocks.updateDoc).toHaveBeenCalledWith({ path: 'preferences' }, { notificationsEnabled: false });
  });
});
