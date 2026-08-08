import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ReportsPage.tsx used to query `reports` directly (with NO limit()) plus a
// per-uid getDoc enrichment loop, authorized only by firestore.rules'
// token-only isAdmin() check. It now goes exclusively through
// fetchReportsList (adminReadView callable, requireCurrentAdmin-gated,
// cursor-paginated server-side, looped client-side to reconstruct the exact
// old "every matching report" result).
const mockFetchReportsList = vi.fn();
vi.mock('../../utils/adminReadService', () => ({
  fetchReportsList: (...args: any[]) => mockFetchReportsList(...args),
}));

const mockCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => mockCallable),
}));
vi.mock('firebase/app', () => ({ getApp: vi.fn(() => ({})) }));

import { ReportsPage } from './ReportsPage';

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

const reportsFixture = {
  reports: [
    { id: 'r1', reporterId: 'u1', reportedUserId: 'u2', type: 'spam', reason: 'Distinctive Test Reason', status: 'pending', createdAt: { toDate: () => new Date() } },
  ],
  userMap: { u1: { fullName: 'Reporter One' }, u2: { fullName: 'Reported One' } },
};

describe('ReportsPage — migrated to adminReadView', () => {
  beforeEach(() => {
    mockFetchReportsList.mockReset();
    mockCallable.mockReset();
  });

  it('AC-7/AC-8: loads through reportsList with the default "pending" filter, preserving displayed reason/status', async () => {
    mockFetchReportsList.mockResolvedValue(reportsFixture);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ReportsPage />); });
    await flush();

    expect(mockFetchReportsList).toHaveBeenCalledWith('pending');
    const markup = JSON.stringify(renderer!.toJSON());
    expect(markup).toContain('Distinctive Test Reason');
    act(() => renderer!.unmount());
  });

  it('AC-8: switching the status filter re-fetches with the new filter value', async () => {
    mockFetchReportsList.mockResolvedValue({ reports: [], userMap: {} });
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ReportsPage />); });
    await flush();
    expect(mockFetchReportsList).toHaveBeenLastCalledWith('pending');

    const allFilterButton = renderer!.root.findAll(
      node => node.type === 'button' && typeof node.props.onClick === 'function',
    ).find(node => textOf(node).trim() === 'All');
    expect(allFilterButton).toBeTruthy();
    await act(async () => { allFilterButton!.props.onClick(); });
    await flush();

    expect(mockFetchReportsList).toHaveBeenLastCalledWith('all');
    act(() => renderer!.unmount());
  });

  it('AC-12: renders a sanitized error, not raw Firebase internals, on callable rejection', async () => {
    mockFetchReportsList.mockRejectedValue(Object.assign(new Error('Admin only.'), { code: 'permission-denied' }));
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ReportsPage />); });
    await flush();

    const markup = JSON.stringify(renderer!.toJSON());
    expect(markup).toContain('Admin only.');
    expect(markup).not.toMatch(/FirebaseError|functions\/permission-denied|at Object\.|\.js:\d+/);
    act(() => renderer!.unmount());
  });

  it('AC-6: renders the empty-result message when no reports match', async () => {
    mockFetchReportsList.mockResolvedValue({ reports: [], userMap: {} });
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ReportsPage />); });
    await flush();

    expect(textOf(renderer!.root)).toContain('No pending reports.');
    act(() => renderer!.unmount());
  });

  it('AC-13: the refresh button re-invokes fetchReportsList', async () => {
    mockFetchReportsList.mockResolvedValue(reportsFixture);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ReportsPage />); });
    await flush();
    expect(mockFetchReportsList).toHaveBeenCalledTimes(1);

    const refreshButton = renderer!.root.findAll(
      node => node.type === 'button' && typeof node.props.onClick === 'function',
    ).find(node => textOf(node).includes('Refresh'));
    expect(refreshButton).toBeTruthy();
    await act(async () => { refreshButton!.props.onClick(); });
    await flush();

    expect(mockFetchReportsList).toHaveBeenCalledTimes(2);
    act(() => renderer!.unmount());
  });
});
