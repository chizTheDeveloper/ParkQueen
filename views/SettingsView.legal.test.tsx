import React from 'react';
import TestRenderer from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    },
  });
});

vi.mock('../hooks/useFocusOnMount', () => ({ useFocusOnMount: vi.fn() }));
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), updateDoc: vi.fn() }));
vi.mock('firebase/functions', () => ({ getFunctions: vi.fn(), httpsCallable: vi.fn() }));
vi.mock('firebase/app', () => ({ getApp: vi.fn() }));

import { SettingsView } from './SettingsView';

describe('SettingsView legal links', () => {
  it('uses the reachable same-origin canonical legal routes', () => {
    const renderer = TestRenderer.create(
      <SettingsView
        user={{}}
        setView={vi.fn()}
        onBack={vi.fn()}
        onLogout={vi.fn()}
        onDeleteAccount={vi.fn()}
        theme="dark"
        toggleTheme={vi.fn()}
      />,
    );
    const links = renderer.root.findAll(node => node.type === 'a').map(node => node.props.href);
    expect(links).toEqual(['/privacy', '/terms']);
  });
});
