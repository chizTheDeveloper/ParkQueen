import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// AuditLogPage.tsx used to fire two direct adminAuditLog queries
// (limit(80)/limit(20), merged/deduplicated client-side), authorized only by
// firestore.rules' token-only isAdmin() check. It now goes exclusively
// through fetchAuditLogList (adminReadView callable, requireCurrentAdmin
// -gated) — the merge/dedup logic moved server-side but the returned,
// already-ordered `entries` array is rendered exactly as before.
const mockFetchAuditLogList = vi.fn();
vi.mock('../../utils/adminReadService', () => ({
  fetchAuditLogList: (...args: any[]) => mockFetchAuditLogList(...args),
}));

import { AuditLogPage } from './AuditLogPage';

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

const entriesFixture = {
  entries: [
    { id: 'e1', action: 'user.suspend', targetType: 'user', adminId: 'admin1', createdAt: { toDate: () => new Date() } },
    { id: 'e2', action: 'segment.create', targetType: 'segment', adminId: 'admin1', createdAt: { toDate: () => new Date(Date.now() - 1000) } },
  ],
};

describe('AuditLogPage — migrated to adminReadView', () => {
  beforeEach(() => { mockFetchAuditLogList.mockReset(); });

  it('AC-9: loads through auditLogList and preserves the server-provided (already merged/ordered) entry order', async () => {
    mockFetchAuditLogList.mockResolvedValue(entriesFixture);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<AuditLogPage />); });
    await flush();

    expect(mockFetchAuditLogList).toHaveBeenCalledTimes(1);
    const text = textOf(renderer!.root);
    expect(text).toContain('user.suspend');
    expect(text).toContain('segment.create');
    expect(text.indexOf('user.suspend')).toBeLessThan(text.indexOf('segment.create'));
    act(() => renderer!.unmount());
  });

  it('AC-6: renders the empty-result message when there are no audit entries', async () => {
    mockFetchAuditLogList.mockResolvedValue({ entries: [] });
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<AuditLogPage />); });
    await flush();

    expect(textOf(renderer!.root)).toContain('No audit entries for this filter.');
    act(() => renderer!.unmount());
  });

  it('AC-12: renders a sanitized error, not raw Firebase internals, on callable rejection', async () => {
    mockFetchAuditLogList.mockRejectedValue(Object.assign(new Error('Admin only.'), { code: 'permission-denied' }));
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<AuditLogPage />); });
    await flush();

    const markup = JSON.stringify(renderer!.toJSON());
    expect(markup).toContain('Admin only.');
    expect(markup).not.toMatch(/FirebaseError|functions\/permission-denied|at Object\.|\.js:\d+/);
    act(() => renderer!.unmount());
  });

  it('AC-13: the refresh button re-invokes fetchAuditLogList', async () => {
    mockFetchAuditLogList.mockResolvedValue(entriesFixture);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<AuditLogPage />); });
    await flush();
    expect(mockFetchAuditLogList).toHaveBeenCalledTimes(1);

    const refreshButton = renderer!.root.findAll(
      node => node.type === 'button' && typeof node.props.onClick === 'function',
    ).find(node => textOf(node).includes('Refresh'));
    expect(refreshButton).toBeTruthy();
    await act(async () => { refreshButton!.props.onClick(); });
    await flush();

    expect(mockFetchAuditLogList).toHaveBeenCalledTimes(2);
    act(() => renderer!.unmount());
  });
});
