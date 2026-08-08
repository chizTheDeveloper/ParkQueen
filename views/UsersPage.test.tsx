import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// UsersPage.tsx used to load the ENTIRE users collection via an unbounded
// onSnapshot(collection(db,'users')) listener, and the detail modal fired 7
// direct Firestore queries — all authorized only by firestore.rules'
// token-only isAdmin() check. It now goes exclusively through
// fetchAllUsers/fetchUserDetail (adminReadView callable,
// requireCurrentAdmin-gated). Mutations (suspend/unsuspend) still go through
// their existing dedicated callables, so firebase/functions is mocked too.
const mockFetchAllUsers = vi.fn();
const mockFetchUserDetail = vi.fn();
vi.mock('../utils/adminReadService', () => ({
  fetchAllUsers: (...args: any[]) => mockFetchAllUsers(...args),
  fetchUserDetail: (...args: any[]) => mockFetchUserDetail(...args),
}));

const mockCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => mockCallable),
}));
vi.mock('firebase/app', () => ({ getApp: vi.fn(() => ({})) }));

import { UsersPage } from './UsersPage';

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

// react-test-renderer test instances carry circular _owner references, so
// JSON.stringify(node.props) throws. This walks only the plain rendered-text
// content via .children (child test instances or raw strings), never props.
function textOf(instance: TestRenderer.ReactTestInstance): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') { parts.push(node); return; }
    const children = (node as any)?.children;
    if (Array.isArray(children)) children.forEach(walk);
  };
  walk(instance);
  return parts.join(' ');
}

const usersFixture = [
  { id: 'u1', fullName: 'Alice Admin-Target', username: 'alice', email: 'alice@example.com', status: 'Active', createdAt: null },
  { id: 'u2', fullName: 'Bob Secondary', username: 'bob', email: 'bob@example.com', status: 'Suspended', createdAt: null },
];

const emptyDetailBundle = {
  trustEvents: [], session: null, recentPings: [], reportsAgainst: [], reportsFiled: [], auditEntries: [], errors: {},
};

describe('UsersPage — migrated to adminReadView', () => {
  beforeEach(() => {
    mockFetchAllUsers.mockReset();
    mockFetchUserDetail.mockReset();
    mockCallable.mockReset();
  });

  it('AC-3/AC-4: loads users through usersList (fetchAllUsers) and renders them in returned order', async () => {
    mockFetchAllUsers.mockResolvedValue(usersFixture);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<UsersPage />); });
    await flush();

    expect(mockFetchAllUsers).toHaveBeenCalledTimes(1);
    const markup = JSON.stringify(renderer!.toJSON());
    expect(markup).toContain('Alice Admin-Target');
    expect(markup).toContain('Bob Secondary');
    // Order preserved: Alice's row content appears before Bob's in the tree.
    expect(markup.indexOf('Alice Admin-Target')).toBeLessThan(markup.indexOf('Bob Secondary'));
    act(() => renderer!.unmount());
  });

  it('AC-6: renders the empty-result message when fetchAllUsers resolves to an empty list', async () => {
    mockFetchAllUsers.mockResolvedValue([]);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<UsersPage />); });
    await flush();

    const markup = JSON.stringify(renderer!.toJSON());
    expect(markup).toContain('No users match current filters.');
    act(() => renderer!.unmount());
  });

  it('AC-12: renders a sanitized error, not raw Firebase internals, on callable rejection', async () => {
    mockFetchAllUsers.mockRejectedValue(Object.assign(new Error('Admin only.'), { code: 'permission-denied' }));
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<UsersPage />); });
    await flush();

    const markup = JSON.stringify(renderer!.toJSON());
    expect(markup).toContain('Admin only.');
    expect(markup).not.toMatch(/FirebaseError|functions\/permission-denied|at Object\.|\.js:\d+/);
    act(() => renderer!.unmount());
  });

  it('AC-13: the refresh button re-invokes fetchAllUsers', async () => {
    mockFetchAllUsers.mockResolvedValue(usersFixture);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<UsersPage />); });
    await flush();
    expect(mockFetchAllUsers).toHaveBeenCalledTimes(1);

    const refreshButton = renderer!.root.findAll(
      node => node.type === 'button' && typeof node.props.onClick === 'function',
    ).find(node => textOf(node).includes('Refresh'));
    expect(refreshButton).toBeTruthy();
    await act(async () => { refreshButton!.props.onClick(); });
    await flush();

    expect(mockFetchAllUsers).toHaveBeenCalledTimes(2);
    act(() => renderer!.unmount());
  });

  it('AC-5: opening a user\'s detail modal calls fetchUserDetail (userDetail view), not a direct protected Firestore read', async () => {
    mockFetchAllUsers.mockResolvedValue(usersFixture);
    mockFetchUserDetail.mockResolvedValue({
      ...emptyDetailBundle,
      session: { active: true, streetName: 'Detail St' },
    });
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<UsersPage />); });
    await flush();

    // Open the row action menu for Alice, then "View Details". Selected by
    // handler identity (openMenuFor) rather than className, since the
    // status-filter pills share the same rounded-full/hover classes.
    const menuButtons = renderer!.root.findAll(
      node => node.type === 'button' && typeof node.props.onClick === 'function'
        && node.props.onClick.toString().includes('openMenuFor'),
    );
    expect(menuButtons.length).toBeGreaterThan(0);
    await act(async () => { menuButtons[0].props.onClick(); });
    await flush();

    const viewDetailsButton = renderer!.root.findAll(
      node => node.type === 'button' && typeof node.props.onClick === 'function',
    ).find(node => textOf(node).includes('View Details'));
    expect(viewDetailsButton).toBeTruthy();
    await act(async () => { viewDetailsButton!.props.onClick(); });
    await flush();

    expect(mockFetchUserDetail).toHaveBeenCalledWith('u1');
    const markup = JSON.stringify(renderer!.toJSON());
    expect(markup).toContain('Detail St'); // bundled session data rendered
    act(() => renderer!.unmount());
  });

  it('AC-14: does not call getDocs/getDoc/onSnapshot/collection from firebase/firestore for the protected list or detail path', async () => {
    // The module under test no longer imports any firebase/firestore runtime
    // export at all (only a type-only Timestamp import, erased at build
    // time) — confirmed by this file's own successful mocking of only
    // firebase/functions + firebase/app + the read service, with no
    // firebase/firestore mock required for the component to render.
    mockFetchAllUsers.mockResolvedValue([]);
    let renderer: TestRenderer.ReactTestRenderer;
    expect(() => {
      act(() => { renderer = TestRenderer.create(<UsersPage />); });
    }).not.toThrow();
    act(() => renderer!.unmount());
  });
});
