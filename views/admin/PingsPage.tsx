import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import {
  collection, query, where, orderBy, limit, getDocs, doc, getDoc, Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { MapPin, ChevronDown, ChevronUp, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';

type PingFilter = 'active' | 'claimed' | 'recent' | 'all';

interface Ping {
  id: string;
  lat: number;
  lng: number;
  status: string;
  address?: string;
  reportedAt: any;
  expiresAt: any;
  finderId?: string;
  finderName?: string;
  finderTitle?: string;
  interestedUserId?: string;
  interestedUserName?: string;
  etaMinutes?: number | null;
  interestExpiresAt?: any;
  holdRequestStatus?: string | null;
  geohash?: string;
}

interface UserInfo {
  fullName?: string;
  username?: string;
  email?: string;
}

const fmtDate = (ts: any) => {
  if (!ts?.toDate) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(ts.toDate());
};

const timeUntil = (ts: any): string => {
  if (!ts?.toDate) return '—';
  const ms = ts.toDate().getTime() - Date.now();
  if (ms < 0) return 'Expired';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
};

const statusBadgeClass = (status: string) => {
  if (status === 'interested') return 'bg-blue-100 text-blue-700';
  if (status === 'occupied')   return 'bg-gray-200 text-gray-600';
  return 'bg-green-100 text-green-700';
};

const statusLabel = (status: string) => {
  if (status === 'interested') return 'Claimed';
  if (status === 'occupied')   return 'Occupied';
  return 'Available';
};

function RemovePanel({ ping, onRemoved }: { ping: Ping; onRemoved: () => void }) {
  const [reason, setReason]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleRemove = async () => {
    setSaving(true);
    setError(null);
    try {
      const fn = httpsCallable(getFunctions(getApp(), 'us-central1'), 'adminDeleteSpot');
      await fn({ spotId: ping.id, reason: reason.trim() || null });
      onRemoved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Removal failed');
    } finally {
      setSaving(false);
    }
  };

  if (!confirmed) {
    return (
      <button
        onClick={() => setConfirmed(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200"
      >
        <Trash2 size={13} />
        Remove Ping
      </button>
    );
  }

  return (
    <div className="mt-3 border-t border-red-100 pt-3 space-y-2">
      <p className="text-xs font-semibold text-red-700">Confirm removal</p>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        rows={2}
        placeholder="Optional reason (stored in audit log)…"
        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
      />
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs">
          <AlertCircle size={13} /> {error}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleRemove}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Removing…' : 'Confirm Remove'}
        </button>
        <button
          onClick={() => { setConfirmed(false); setReason(''); setError(null); }}
          className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function PingCard({ ping, userMap, onRemoved }: { ping: Ping; userMap: Record<string, UserInfo>; onRemoved: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const finder = ping.finderId ? userMap[ping.finderId] : null;
  const finderDisplay = finder
    ? (finder.fullName || finder.username || ping.finderName || ping.finderId?.slice(0, 8) + '…')
    : (ping.finderName || ping.finderId?.slice(0, 8) + '…' || '—');

  const isExpired = ping.expiresAt?.toDate?.().getTime() < Date.now();

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${isExpired ? 'border-gray-200 opacity-70' : ping.status === 'interested' ? 'border-blue-200' : 'border-green-200'}`}>
      <div className="p-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadgeClass(ping.status)}`}>
              {statusLabel(ping.status)}
            </span>
            {!isExpired && (
              <span className="text-xs text-gray-400">{timeUntil(ping.expiresAt)}</span>
            )}
            {isExpired && <span className="text-xs text-red-400 font-medium">Expired</span>}
            <span className="text-xs text-gray-400 ml-auto shrink-0">{fmtDate(ping.reportedAt)}</span>
          </div>
          <p className="text-sm font-medium text-gray-800 truncate">{ping.address || `${ping.lat.toFixed(5)}, ${ping.lng.toFixed(5)}`}</p>
          <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span><span className="text-gray-400">By: </span>{finderDisplay}</span>
            {ping.status === 'interested' && ping.interestedUserName && (
              <span><span className="text-gray-400">Claimed by: </span>{ping.interestedUserName}</span>
            )}
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
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div><span className="text-gray-400">Doc ID: </span><span className="font-mono text-gray-600">{ping.id}</span></div>
            <div><span className="text-gray-400">Status: </span><span className="capitalize">{ping.status}</span></div>
            <div><span className="text-gray-400">Lat / Lng: </span><span className="font-mono">{ping.lat.toFixed(6)}, {ping.lng.toFixed(6)}</span></div>
            <div><span className="text-gray-400">Geohash: </span><span className="font-mono">{ping.geohash || '—'}</span></div>
            <div><span className="text-gray-400">Reported: </span>{fmtDate(ping.reportedAt)}</div>
            <div><span className="text-gray-400">Expires: </span>{fmtDate(ping.expiresAt)}</div>
            <div><span className="text-gray-400">Finder UID: </span><span className="font-mono">{ping.finderId || '—'}</span></div>
            <div><span className="text-gray-400">Finder title: </span>{ping.finderTitle || '—'}</div>
            {ping.status === 'interested' && (
              <>
                <div><span className="text-gray-400">Claimer UID: </span><span className="font-mono">{ping.interestedUserId || '—'}</span></div>
                <div><span className="text-gray-400">Claimer: </span>{ping.interestedUserName || '—'}</div>
                <div><span className="text-gray-400">ETA: </span>{ping.etaMinutes != null ? `${ping.etaMinutes} min` : '—'}</div>
                <div><span className="text-gray-400">Interest expires: </span>{fmtDate(ping.interestExpiresAt)}</div>
              </>
            )}
            {ping.holdRequestStatus && (
              <div><span className="text-gray-400">Hold status: </span>{ping.holdRequestStatus}</div>
            )}
          </div>

          <RemovePanel ping={ping} onRemoved={onRemoved} />
        </div>
      )}
    </div>
  );
}

const FILTERS: { label: string; value: PingFilter }[] = [
  { label: 'Active',  value: 'active' },
  { label: 'Claimed', value: 'claimed' },
  { label: 'Recent (24h)', value: 'recent' },
  { label: 'All',    value: 'all' },
];

export const PingsPage = () => {
  const [filter, setFilter]   = useState<PingFilter>('active');
  const [pings, setPings]     = useState<Ping[]>([]);
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = async (f: PingFilter = filter) => {
    setLoading(true);
    setError(null);
    try {
      const now = Timestamp.now();
      const yesterday = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

      let q;
      if (f === 'active' || f === 'claimed') {
        // Both use the same base query; claimed is filtered client-side
        q = query(collection(db!, 'spots'), where('expiresAt', '>', now), orderBy('expiresAt', 'asc'));
      } else if (f === 'recent') {
        q = query(collection(db!, 'spots'), where('reportedAt', '>', yesterday), orderBy('reportedAt', 'desc'));
      } else {
        q = query(collection(db!, 'spots'), orderBy('reportedAt', 'desc'), limit(100));
      }

      const snap = await getDocs(q);
      let docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) } as Ping));

      if (f === 'claimed') {
        docs = docs.filter(p => p.status === 'interested' || p.status === 'occupied');
      }

      setPings(docs);

      // Enrich finder user data
      const uids = [...new Set(docs.map(p => p.finderId).filter(Boolean) as string[])];
      const results = await Promise.allSettled(uids.map(uid => getDoc(doc(db!, 'users', uid))));
      const map: Record<string, UserInfo> = {};
      results.forEach((res, i) => {
        if (res.status === 'fulfilled' && res.value.exists()) {
          map[uids[i]] = res.value.data() as UserInfo;
        }
      });
      setUserMap(map);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load pings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filter); }, [filter]);

  const claimed  = pings.filter(p => p.status === 'interested' || p.status === 'occupied').length;
  const available = pings.filter(p => p.status === 'available').length;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <MapPin size={24} className="text-green-500" />
          <h1 className="text-3xl font-bold text-gray-800">Parking Pings</h1>
        </div>
        <button
          onClick={() => load(filter)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Summary chips */}
      {!loading && !error && (
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm">
            <span className="text-gray-400">Loaded </span>
            <span className="font-bold text-gray-800">{pings.length}</span>
            <span className="text-gray-400"> pings</span>
          </div>
          {(filter === 'active') && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm">
                <span className="font-bold text-green-700">{available}</span>
                <span className="text-green-600"> available</span>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm">
                <span className="font-bold text-blue-700">{claimed}</span>
                <span className="text-blue-600"> claimed</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filter pills */}
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
        <div className="text-sm text-gray-400 py-12 text-center">Loading pings…</div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!loading && !error && pings.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <MapPin size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {filter === 'active' ? 'No active parking pings right now.' : `No ${filter} pings found.`}
          </p>
        </div>
      )}

      {!loading && !error && pings.length > 0 && (
        <div className="space-y-3">
          {pings.map(p => (
            <PingCard
              key={p.id}
              ping={p}
              userMap={userMap}
              onRemoved={() => load(filter)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
