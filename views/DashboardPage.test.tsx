import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// DashboardPage.tsx used to read users/spots/parkingSessions/parseFailures/
// streetSegments/reports directly via getCountFromServer + onSnapshot,
// authorized only by firestore.rules' token-only isAdmin() check. It now
// goes exclusively through fetchDashboardCounts (adminReadView callable,
// requireCurrentAdmin-gated). Mocking the service boundary (rather than
// firebase/functions directly) tests the actual interaction this component
// depends on post-migration.
const mockFetchDashboardCounts = vi.fn();
vi.mock('../utils/adminReadService', () => ({
  fetchDashboardCounts: (...args: any[]) => mockFetchDashboardCounts(...args),
}));

import { DashboardPage } from './DashboardPage';

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const baseCounts = {
  totalUsers: 42, activePings: 3, activeSessions: 1,
  parseFailures: 0, needsReview: 0, reports: 2, recentUsers: [],
};

describe('DashboardPage — migrated to adminReadView', () => {
  beforeEach(() => { mockFetchDashboardCounts.mockReset(); });

  it('AC-1: loads counts through the hardened callable-backed service on mount, not direct Firestore', async () => {
    mockFetchDashboardCounts.mockResolvedValue(baseCounts);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<DashboardPage onNavigate={() => {}} />); });
    await flush();

    expect(mockFetchDashboardCounts).toHaveBeenCalledTimes(1);
    const markup = JSON.stringify(renderer!.toJSON());
    expect(markup).toContain('42'); // totalUsers rendered
    act(() => renderer!.unmount());
  });

  it('AC-2: renders a sanitized error message, not raw Firebase/internal error details, on callable rejection', async () => {
    mockFetchDashboardCounts.mockRejectedValue(
      Object.assign(new Error('Admin only.'), { code: 'permission-denied' }),
    );
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<DashboardPage onNavigate={() => {}} />); });
    await flush();

    const markup = JSON.stringify(renderer!.toJSON());
    expect(markup).toContain('Admin only.');
    expect(markup).not.toMatch(/FirebaseError|functions\/permission-denied|at Object\.|\.js:\d+/);
    act(() => renderer!.unmount());
  });

  it('AC-13: the refresh button re-invokes the service (loading/refresh behavior remains functional without onSnapshot)', async () => {
    mockFetchDashboardCounts.mockResolvedValue(baseCounts);
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<DashboardPage onNavigate={() => {}} />); });
    await flush();
    expect(mockFetchDashboardCounts).toHaveBeenCalledTimes(1);

    const refreshButton = renderer!.root.findAll(
      node => node.type === 'button' && typeof node.props.onClick === 'function',
    )[0];
    await act(async () => { refreshButton.props.onClick(); });
    await flush();

    expect(mockFetchDashboardCounts).toHaveBeenCalledTimes(2);
    act(() => renderer!.unmount());
  });
});
