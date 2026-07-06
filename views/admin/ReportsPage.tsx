import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import {
  collection, query, where, orderBy, getDocs, doc, getDoc, Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { ShieldAlert, ChevronDown, ChevronUp, AlertCircle, RefreshCw } from 'lucide-react';

type StatusFilter = 'pending' | 'reviewed' | 'dismissed' | 'all';
type FsTs = { toDate(): Date };

interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  type: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  conversationId?: string;
  createdAt: Timestamp;
  reviewedAt?: Timestamp | null;
  reviewedBy?: string | null;
  adminNote?: string | null;
}

interface UserInfo {
  fullName?: string;
  username?: string;
  email?: string;
}

const statusBadgeClass = (status: string) => {
  if (status === 'pending')   return 'bg-amber-100 text-amber-700';
  if (status === 'reviewed')  return 'bg-green-100 text-green-700';
  if (status === 'dismissed') return 'bg-gray-100 text-gray-600';
  return 'bg-gray-100 text-gray-500';
};

const fmtDate = (ts: FsTs | null | undefined) => {
  if (!ts?.toDate) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(ts.toDate());
};

const displayName = (uid: string, userMap: Record<string, UserInfo>) => {
  const u = userMap[uid];
  if (!u) return uid.slice(0, 8) + '…';
  return u.fullName || u.username || u.email || uid.slice(0, 8) + '…';
};

function UserBlock({ label, uid, userMap }: { label: string; uid: string; userMap: Record<string, UserInfo> }) {
  const u = userMap[uid];
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      {u ? (
        <>
          <p className="text-sm font-medium text-gray-800">{u.fullName || u.username || '—'}</p>
          {u.username && <p className="text-xs text-gray-400">@{u.username}</p>}
          {u.email && <p className="text-xs text-gray-400">{u.email}</p>}
        </>
      ) : (
        <p className="text-xs font-mono text-gray-400">{uid}</p>
      )}
    </div>
  );
}

function ReportCard({
  report, userMap, onUpdated,
}: {
  report: Report;
  userMap: Record<string, UserInfo>;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [action, setAction]     = useState<'review' | 'dismiss' | null>(null);
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const callUpdateReport = async (status: 'reviewed' | 'dismissed' | 'pending', adminNote?: string) => {
    setSaving(true);
    setError(null);
    try {
      const fn = httpsCallable(getFunctions(getApp(), 'us-central1'), 'adminUpdateReport');
      await fn({ reportId: report.id, status, adminNote: adminNote ?? null });
      setAction(null);
      setNote('');
      onUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${report.status === 'pending' ? 'border-amber-200' : 'border-gray-200'}`}>
      <div className="p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${statusBadgeClass(report.status)}`}>
              {report.status}
            </span>
            <span className="text-xs text-gray-400 capitalize">{report.type}</span>
            <span className="text-xs text-gray-400 ml-auto shrink-0">{fmtDate(report.createdAt)}</span>
          </div>
          <p className="text-sm text-gray-700 font-medium line-clamp-2">{report.reason}</p>
          <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
            <span>
              <span className="text-gray-400">Reporter: </span>
              {displayName(report.reporterId, userMap)}
            </span>
            <span>
              <span className="text-gray-400">Reported: </span>
              {displayName(report.reportedUserId, userMap)}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="p-1 text-gray-400 hover:text-gray-600 shrink-0"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50/40 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Full Reason</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.reason}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <UserBlock label="Reporter"     uid={report.reporterId}     userMap={userMap} />
            <UserBlock label="Reported User" uid={report.reportedUserId} userMap={userMap} />
          </div>

          {report.conversationId && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Conversation ID</p>
              <p className="text-xs font-mono text-gray-500">{report.conversationId}</p>
            </div>
          )}

          {report.status !== 'pending' && (
            <div className={`rounded-lg p-3 border text-sm ${report.status === 'reviewed' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                {report.status === 'reviewed' ? 'Marked Reviewed' : 'Dismissed'}
              </p>
              <p className="text-xs text-gray-500">
                {fmtDate(report.reviewedAt)} · by {report.reviewedBy ? report.reviewedBy.slice(0, 8) + '…' : '—'}
              </p>
              {report.adminNote && <p className="text-sm text-gray-700 mt-1">{report.adminNote}</p>}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {action ? (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Admin Note <span className="font-normal text-gray-400">(optional)</span>
              </p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                placeholder="Optional note about this decision…"
                className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => callUpdateReport(action === 'review' ? 'reviewed' : 'dismissed', note)}
                  disabled={saving}
                  className={`px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 ${action === 'review' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-800'}`}
                >
                  {saving ? 'Saving…' : action === 'review' ? 'Mark Reviewed' : 'Dismiss'}
                </button>
                <button
                  onClick={() => { setAction(null); setNote(''); }}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {report.status === 'pending' && (
                <>
                  <button
                    onClick={() => setAction('review')}
                    className="px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200"
                  >
                    Mark Reviewed
                  </button>
                  <button
                    onClick={() => setAction('dismiss')}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    Dismiss
                  </button>
                </>
              )}
              {report.status !== 'pending' && (
                <button
                  onClick={() => callUpdateReport('pending')}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 disabled:opacity-50"
                >
                  {saving ? 'Reopening…' : 'Reopen'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'Pending',   value: 'pending' },
  { label: 'Reviewed',  value: 'reviewed' },
  { label: 'Dismissed', value: 'dismissed' },
  { label: 'All',       value: 'all' },
];

export const ReportsPage = () => {
  const [filter, setFilter]   = useState<StatusFilter>('pending');
  const [reports, setReports] = useState<Report[]>([]);
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = async (f: StatusFilter = filter) => {
    setLoading(true);
    setError(null);
    try {
      const q = f === 'all'
        ? query(collection(db, 'reports'), orderBy('createdAt', 'desc'))
        : query(collection(db, 'reports'), where('status', '==', f), orderBy('createdAt', 'desc'));

      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Report, 'id'>) }));
      setReports(docs);

      const uids = [...new Set(docs.flatMap(r => [r.reporterId, r.reportedUserId]))];
      const results = await Promise.allSettled(uids.map(uid => getDoc(doc(db, 'users', uid))));
      const map: Record<string, UserInfo> = {};
      results.forEach((res, i) => {
        if (res.status === 'fulfilled' && res.value.exists()) {
          map[uids[i]] = res.value.data() as UserInfo;
        }
      });
      setUserMap(map);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filter); }, [filter]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <ShieldAlert size={24} className="text-orange-500" />
          <h1 className="text-3xl font-bold text-gray-800">Trust &amp; Safety Reports</h1>
        </div>
        <button
          onClick={() => load(filter)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              filter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-sm text-gray-400 py-12 text-center">Loading reports…</div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <ShieldAlert size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No {filter === 'all' ? '' : filter + ' '}reports.</p>
        </div>
      )}

      {!loading && !error && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map(r => (
            <ReportCard
              key={r.id}
              report={r}
              userMap={userMap}
              onUpdated={() => load(filter)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
