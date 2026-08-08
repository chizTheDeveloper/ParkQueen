import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// PingsPage.tsx used to query `spots` directly (active/claimed/recent had NO
// limit(); 'all' had limit(100)) plus a per-finder getDoc enrichment loop,
// authorized only by firestore.rules' token-only isAdmin() check. It now
// goes exclusively through fetchPingsList (adminReadView callable,
// requireCurrentAdmin-gated, cursor-paginated server-side for the three
// previously-unbounded filters, looped client-side to reconstruct the exact
// old complete result).
const mockFetchPingsList = vi.fn();
vi.mock('../../utils/adminReadService', () => ({
  fetchPingsList: (...args: any[]) => mockFetchPingsList(...args),
}));

const mockCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => mockCallable),
}));
vi.mock('firebase/app', () => ({ getApp: vi.fn(() => ({})) }));

import { PingsPage } from './PingsPage';

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

function textOf(instance: TestRenderer.ReactTestInstance): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') { parts.push(node); return; }
    const children = (node as any)?.children;
    if (Array.isArray(children)) children.forEach(walk);
  };
  walk(instance);
  return parts.join('');
}

const pingsFixture = {
  pings: [
    { id: 'p1', lat: 40.7, lng: -74.0, status: 'available', address: 'Distinctive Ping Address', reportedAt: { toDate: () => new Date() }, expiresAt: { toDate: () => new Date(Date.now() + 60000) } },
  ],
  userMap: {},
};

describe('PingsPage — migrated to adminReadView', () => {
  beforeEach(() => {
    mockFetchPingsList.mockReset();
    mockCallable.mockReset();
  });

  it('AC-10: loads through pingsList with the default "active" filter', async () => {
    mockFetchPingsList.mockResolvedValue(pingsFixture);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<PingsPage />); });
    await flush();

    expect(mockFetchPingsList).toHaveBeenCalledWith('active');
    expect(textOf(renderer!.root)).toContain('Distinctive Ping Address');
    act(() => renderer!.unmount());
  });

  it('AC-8: switching the filter re-fetches with the new filter value', async () => {
    mockFetchPingsList.mockResolvedValue({ pings: [], userMap: {} });
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<PingsPage />); });
    await flush();
    expect(mockFetchPingsList).toHaveBeenLastCalledWith('active');

    const allFilterButton = renderer!.root.findAll(
      node => node.type === 'button' && typeof node.props.onClick === 'function',
    ).find(node => textOf(node).trim() === 'All');
    expect(allFilterButton).toBeTruthy();
    await act(async () => { allFilterButton!.props.onClick(); });
    await flush();

    expect(mockFetchPingsList).toHaveBeenLastCalledWith('all');
    act(() => renderer!.unmount());
  });

  it('AC-6: renders the empty-result message for the active filter', async () => {
    mockFetchPingsList.mockResolvedValue({ pings: [], userMap: {} });
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<PingsPage />); });
    await flush();

    expect(textOf(renderer!.root)).toContain('No active parking pings right now.');
    act(() => renderer!.unmount());
  });

  it('AC-12: renders a sanitized error, not raw Firebase internals, on callable rejection', async () => {
    mockFetchPingsList.mockRejectedValue(Object.assign(new Error('Admin only.'), { code: 'permission-denied' }));
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<PingsPage />); });
    await flush();

    const markup = JSON.stringify(renderer!.toJSON());
    expect(markup).toContain('Admin only.');
    expect(markup).not.toMatch(/FirebaseError|functions\/permission-denied|at Object\.|\.js:\d+/);
    act(() => renderer!.unmount());
  });

  it('AC-13: the refresh button re-invokes fetchPingsList', async () => {
    mockFetchPingsList.mockResolvedValue(pingsFixture);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<PingsPage />); });
    await flush();
    expect(mockFetchPingsList).toHaveBeenCalledTimes(1);

    const refreshButton = renderer!.root.findAll(
      node => node.type === 'button' && typeof node.props.onClick === 'function',
    ).find(node => textOf(node).includes('Refresh'));
    expect(refreshButton).toBeTruthy();
    await act(async () => { refreshButton!.props.onClick(); });
    await flush();

    expect(mockFetchPingsList).toHaveBeenCalledTimes(2);
    act(() => renderer!.unmount());
  });
});
