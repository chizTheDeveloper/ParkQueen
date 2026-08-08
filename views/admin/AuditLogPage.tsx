import React, { useState, useEffect } from 'react';
import type { Timestamp } from 'firebase/firestore';
import { fetchAuditLogList } from '../../utils/adminReadService';
import { ClipboardList, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

type TargetTypeFilter = 'all' | 'user' | 'spot' | 'report' | 'segment' | 'suspension' | 'system';

type FsTs = { toDate(): Date };

interface AuditEntry {
  id: string;
  action: string;
  // Standard fields
  targetType?: string;
  targetId?: string;
  targetUserId?: string | null;
  adminId?: string;
  adminEmail?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: Timestamp;
  // Legacy fields
  adminUid?: string;
  performedAt?: Timestamp;
  finderId?: string | null;
  spotId?: string | null;
  targetUid?: string | null;
}

const fmtDateTime = (ts: FsTs | null | undefined) => {
  if (!ts?.toDate) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(ts.toDate());
};

const isLegacy = (e: AuditEntry) => !e.targetType && !e.adminId;

const actionBadgeClass = (action: string) => {
  if (action.startsWith('user.suspend'))    return 'bg-red-100 text-red-700';
  if (action.startsWith('user.'))           return 'bg-blue-100 text-blue-700';
  if (action.startsWith('spot.'))           return 'bg-green-100 text-green-700';
  if (action.startsWith('report.'))         return 'bg-amber-100 text-amber-700';
  if (action.startsWith('segment.'))        return 'bg-purple-100 text-purple-700';
  if (action.startsWith('suspension.'))     return 'bg-orange-100 text-orange-700';
  return 'bg-gray-100 text-gray-600';
};

const targetTypeBadgeClass = (type?: string) => {
  if (type === 'user')       return 'bg-blue-50 text-blue-600';
  if (type === 'spot')       return 'bg-green-50 text-green-600';
  if (type === 'report')     return 'bg-amber-50 text-amber-600';
  if (type === 'segment')    return 'bg-purple-50 text-purple-600';
  if (type === 'suspension') return 'bg-orange-50 text-orange-600';
  if (type === 'system')     return 'bg-gray-100 text-gray-500';
  return 'bg-gray-50 text-gray-400';
};

function MetadataPreview({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(data).filter(([, v]) => v != null);
  if (entries.length === 0) return null;
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
      >
        metadata {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div className="mt-1 bg-gray-50 border border-gray-100 rounded px-2 py-1.5 text-xs font-mono text-gray-500 space-y-0.5">
          {entries.map(([k, v]) => (
            <div key={k}><span className="text-gray-400">{k}:</span> {String(v)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

const TYPE_FILTERS: { label: string; value: TargetTypeFilter }[] = [
  { label: 'All',        value: 'all' },
  { label: 'User',       value: 'user' },
  { label: 'Spot',       value: 'spot' },
  { label: 'Report',     value: 'report' },
  { label: 'Segment',    value: 'segment' },
  { label: 'Suspension', value: 'suspension' },
  { label: 'System',     value: 'system' },
];

export const AuditLogPage = () => {
  const [entries, setEntries]   = useState<AuditEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filter, setFilter]     = useState<TargetTypeFilter>('all');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditLogList();
      setEntries(data.entries as AuditEntry[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = filter === 'all'
    ? entries
    : filter === 'system'
      ? entries.filter(e => !e.targetType || e.targetType === 'system')
      : entries.filter(e => e.targetType === filter);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList size={24} className="text-indigo-500" />
          <h1 className="text-3xl font-bold text-gray-800">Admin Audit Log</h1>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              filter === f.value
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        {!loading && (
          <span className="ml-auto self-center text-xs text-gray-400 text-right leading-tight">
            {visible.length} of {entries.length} entries
            <br />
            <span className="text-gray-300">Most recent 80 standard + 20 legacy</span>
          </span>
        )}
      </div>

      {loading && (
        <div className="text-sm text-gray-400 py-12 text-center">Loading audit log…</div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No audit entries for this filter.</p>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase border-b border-gray-100">
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">User UID</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Reason / Note</th>
                <th className="px-4 py-3 whitespace-nowrap">When</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(entry => (
                <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50 align-top">
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${actionBadgeClass(entry.action)}`}>
                      {entry.action}
                    </span>
                    {isLegacy(entry) && (
                      <span className="ml-1 text-xs text-gray-400" title="Legacy schema">↩</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {entry.targetType && (
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded capitalize mb-1 ${targetTypeBadgeClass(entry.targetType)}`}>
                        {entry.targetType}
                      </span>
                    )}
                    {(entry.targetId ?? entry.spotId) && (
                      <p className="text-xs font-mono text-gray-400 truncate max-w-[120px]">
                        {(entry.targetId ?? entry.spotId)?.slice(0, 12)}…
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(entry.targetUserId ?? entry.finderId ?? entry.targetUid) ? (
                      <p className="text-xs font-mono text-gray-500 truncate max-w-[100px]">
                        {(entry.targetUserId ?? entry.finderId ?? entry.targetUid)?.slice(0, 10)}…
                      </p>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-mono text-gray-500 truncate max-w-[100px]">
                      {(entry.adminId ?? entry.adminUid)?.slice(0, 10)}…
                    </p>
                    {entry.adminEmail && (
                      <p className="text-xs text-gray-400 truncate max-w-[120px]">{entry.adminEmail}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    {entry.reason
                      ? <p className="text-xs text-gray-600 line-clamp-2">{entry.reason}</p>
                      : <span className="text-gray-300 text-xs">—</span>}
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <MetadataPreview data={entry.metadata} />
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                    {fmtDateTime(entry.createdAt ?? entry.performedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
