import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ParseFailuresPage.tsx used to query `parseFailures` directly
// (orderBy('count','desc'), limit(100)), authorized only by
// firestore.rules' token-only isAdmin() check. It now goes exclusively
// through fetchParseFailuresList (adminReadView callable,
// requireCurrentAdmin-gated) with the same limit(100), preserved server-side.
const mockFetchParseFailuresList = vi.fn();
vi.mock('../../utils/adminReadService', () => ({
  fetchParseFailuresList: (...args: any[]) => mockFetchParseFailuresList(...args),
}));

const mockCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => mockCallable),
}));
vi.mock('firebase/app', () => ({ getApp: vi.fn(() => ({})) }));

import { ParseFailuresPage } from './ParseFailuresPage';

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

const failuresFixture = {
  failures: [
    { id: 'f1', rawSignText: 'Distinctive Sign Text', parserVersion: '1.0', count: 3, firstSeenAt: null, lastSeenAt: null, resolvedAt: null },
  ],
};

describe('ParseFailuresPage — migrated to adminReadView', () => {
  beforeEach(() => {
    mockFetchParseFailuresList.mockReset();
    mockCallable.mockReset();
  });

  it('AC-11: loads through parseFailuresList and renders the fetched failure', async () => {
    mockFetchParseFailuresList.mockResolvedValue(failuresFixture);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ParseFailuresPage />); });
    await flush();

    expect(mockFetchParseFailuresList).toHaveBeenCalledTimes(1);
    expect(textOf(renderer!.root)).toContain('Distinctive Sign Text');
    act(() => renderer!.unmount());
  });

  it('AC-6: renders the empty-result message for the default "unresolved" filter', async () => {
    mockFetchParseFailuresList.mockResolvedValue({ failures: [] });
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ParseFailuresPage />); });
    await flush();

    expect(textOf(renderer!.root)).toContain('No unresolved parse failures.');
    act(() => renderer!.unmount());
  });

  it('AC-12: renders a sanitized error, not raw Firebase internals, on callable rejection (this page previously had no error handling at all)', async () => {
    mockFetchParseFailuresList.mockRejectedValue(Object.assign(new Error('Admin only.'), { code: 'permission-denied' }));
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ParseFailuresPage />); });
    await flush();

    const markup = JSON.stringify(renderer!.toJSON());
    expect(markup).toContain('Admin only.');
    expect(markup).not.toMatch(/FirebaseError|functions\/permission-denied|at Object\.|\.js:\d+/);
    act(() => renderer!.unmount());
  });

  it('AC-13: the refresh button (icon-only, title="Refresh") re-invokes fetchParseFailuresList', async () => {
    mockFetchParseFailuresList.mockResolvedValue(failuresFixture);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<ParseFailuresPage />); });
    await flush();
    expect(mockFetchParseFailuresList).toHaveBeenCalledTimes(1);

    const refreshButton = renderer!.root.findAll(
      node => node.type === 'button' && node.props.title === 'Refresh',
    )[0];
    expect(refreshButton).toBeTruthy();
    await act(async () => { refreshButton.props.onClick(); });
    await flush();

    expect(mockFetchParseFailuresList).toHaveBeenCalledTimes(2);
    act(() => renderer!.unmount());
  });
});
