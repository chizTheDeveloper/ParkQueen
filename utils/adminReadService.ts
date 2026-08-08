import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

// Client wrapper for the requireCurrentAdmin-gated adminReadView callable
// (functions/index.js, view logic in functions/adminReadViews.js). Replaces
// the Admin Dashboard's former direct Firestore reads of users, reports,
// adminAuditLog, parkingSessions, parseFailures, and spots (admin branch) —
// all previously authorized only by firestore.rules' token-only isAdmin()
// check, which a stale admin token (demoted/deleted/disabled after the token
// was minted) could still pass. See firestore.rules for the corresponding
// removed read permissions.

async function callAdminReadView<T>(view: string, params: Record<string, unknown> = {}): Promise<T> {
  const fn = httpsCallable(getFunctions(getApp(), 'us-central1'), 'adminReadView');
  const res = await fn({ view, params });
  return res.data as T;
}

interface UsersListPage {
  users: Record<string, any>[];
  nextCursor: string | null;
  done: boolean;
}

// Loops the paginated usersList view until done, assembling the full list —
// preserves UsersPage.tsx's existing client-side search/filter UX exactly
// (mirrors the adminBackfillStreetIntelligence pagination pattern already
// established for the backfill callable).
export async function fetchAllUsers(): Promise<Record<string, any>[]> {
  const all: Record<string, any>[] = [];
  let cursor: string | null = null;
  let done = false;
  while (!done) {
    const page = await callAdminReadView<UsersListPage>('usersList', { cursor, limit: 200 });
    all.push(...page.users);
    cursor = page.nextCursor;
    done = page.done;
  }
  return all;
}

export function fetchUserDetail(uid: string): Promise<{
  trustEvents: Record<string, any>[];
  session: Record<string, any> | null;
  recentPings: Record<string, any>[];
  reportsAgainst: Record<string, any>[];
  reportsFiled: Record<string, any>[];
  auditEntries: Record<string, any>[];
  errors: Record<string, boolean>;
}> {
  return callAdminReadView('userDetail', { uid });
}

export function fetchReportsList(status: 'pending' | 'reviewed' | 'dismissed' | 'all'): Promise<{
  reports: Record<string, any>[];
  userMap: Record<string, { fullName?: string; username?: string; email?: string }>;
}> {
  return callAdminReadView('reportsList', { status });
}

export function fetchAuditLogList(): Promise<{ entries: Record<string, any>[] }> {
  return callAdminReadView('auditLogList');
}

export function fetchPingsList(filter: 'active' | 'claimed' | 'recent' | 'all'): Promise<{
  pings: Record<string, any>[];
  userMap: Record<string, { fullName?: string; username?: string; email?: string }>;
}> {
  return callAdminReadView('pingsList', { filter });
}

export function fetchParseFailuresList(): Promise<{ failures: Record<string, any>[] }> {
  return callAdminReadView('parseFailuresList');
}

export function fetchDashboardCounts(): Promise<{
  totalUsers: number;
  activePings: number;
  activeSessions: number;
  parseFailures: number;
  needsReview: number;
  reports: number;
  recentUsers: Record<string, any>[];
}> {
  return callAdminReadView('dashboardCounts');
}
