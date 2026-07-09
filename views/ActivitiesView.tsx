import React, { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, Clock, ChevronDown, Handshake, ParkingSquare } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit, startAfter, Timestamp } from 'firebase/firestore';

interface HistoryItem {
  id: string;
  role: 'finder' | 'driver';
  address: string;
  status: string;
  statusLabel: string;
  timestamp: number;
  date: string;
}

const PAGE_SIZE = 20;

function formatStatus(role: string, spotStatus: string, outcome?: string): { status: string; label: string } {
  if (role === 'driver') {
    if (outcome === 'success') return { status: 'success', label: 'Parked' };
    if (outcome === 'failed') return { status: 'failed', label: 'Unsuccessful' };
    return { status: 'completed', label: 'Completed' };
  }
  if (spotStatus === 'occupied') return { status: 'success', label: 'Helped a driver' };
  if (spotStatus === 'interested') return { status: 'active', label: 'In progress' };
  if (spotStatus === 'available') return { status: 'active', label: 'Active' };
  return { status: 'expired', label: 'Expired' };
}

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  active: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  completed: 'bg-gray-500/10 text-[var(--color-text-secondary)] border-[var(--color-border)]',
  expired: 'bg-gray-500/10 text-[var(--color-text-secondary)] border-[var(--color-border)]',
};

export const ActivitiesView = ({ user, onBack }: { user: any; onBack: () => void }) => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState<number | null>(null);

  const fetchHistory = async (after?: number) => {
    if (!user?.id) return;

    try {
      // Query spots where user was the finder
      const spotsQ = query(
        collection(db, 'spots'),
        where('finderId', '==', user.id),
      );
      const spotsSnap = await getDocs(spotsQ);

      const finderItems: HistoryItem[] = spotsSnap.docs.map(d => {
        const s = d.data();
        const ts = s.reportedAt?.toMillis?.() || 0;
        const { status, label } = formatStatus('finder', s.status);
        return {
          id: `finder-${d.id}`,
          role: 'finder' as const,
          address: s.address || 'Street Parking Spot',
          status,
          statusLabel: label,
          timestamp: ts,
          date: ts ? new Date(ts).toLocaleString() : 'Unknown',
        };
      });

      // Query spotFeedback where user was the driver
      const feedbackQ = query(
        collection(db, 'spotFeedback'),
        where('userId', '==', user.id),
      );
      const feedbackSnap = await getDocs(feedbackQ);

      const driverItems: HistoryItem[] = feedbackSnap.docs.map(d => {
        const f = d.data();
        const ts = f.createdAt?.toMillis?.() || 0;
        const { status, label } = formatStatus('driver', '', f.outcome);
        return {
          id: `driver-${d.id}`,
          role: 'driver' as const,
          address: f.address || 'Saved parking spot',
          status,
          statusLabel: label,
          timestamp: ts,
          date: ts ? new Date(ts).toLocaleString() : 'Unknown',
        };
      });

      // Merge and sort by timestamp descending
      const all = [...finderItems, ...driverItems]
        .sort((a, b) => b.timestamp - a.timestamp);

      // Pagination: filter items after cursor, take PAGE_SIZE + 1
      const filtered = after ? all.filter(i => i.timestamp < after) : all;
      const page = filtered.slice(0, PAGE_SIZE);
      const more = filtered.length > PAGE_SIZE;

      if (after) {
        setItems(prev => [...prev, ...page]);
      } else {
        setItems(page);
      }
      setHasMore(more);
      if (page.length > 0) {
        setLastTimestamp(page[page.length - 1].timestamp);
      }
    } catch (err) {
      console.error('Error fetching parking history', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.id]);

  const handleLoadMore = () => {
    if (!lastTimestamp || loadingMore) return;
    setLoadingMore(true);
    fetchHistory(lastTimestamp);
  };

  return (
    <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4 max-w-md mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)] tracking-wide">Parking History</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">Your recent parking activity</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-10">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center p-10 text-[var(--color-text-secondary)] bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl">
          <MapPin className="mx-auto mb-3.5 opacity-80" size={32} />
          <p className="text-sm">No parking history yet</p>
          <p className="text-xs mt-1">Your pings and parking events will appear here</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map(item => (
            <div key={item.id} className="bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl p-3.5 flex items-center gap-3.5">
              <div className={`p-2 rounded-xl shrink-0 ${item.role === 'finder' ? 'bg-yellow-400/15 text-yellow-400' : 'bg-green-500/10 text-green-400'}`}>
                {item.role === 'finder' ? <Handshake size={18} /> : <ParkingSquare size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-[var(--color-text)] truncate">{item.address}</h3>
                <p className="text-[10px] text-[var(--color-text-secondary)] flex items-center gap-1.5 mt-0.5">
                  <Clock size={11} className="shrink-0" />
                  <span>{item.date}</span>
                  <span className="mx-0.5">·</span>
                  <span>{item.role === 'finder' ? 'You pinged' : 'You parked'}</span>
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${STATUS_STYLES[item.status] || STATUS_STYLES.completed}`}>
                {item.statusLabel}
              </span>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-white/5 border border-[var(--color-border)] hover:bg-white/10 transition-all text-[var(--color-text-secondary)] flex items-center justify-center gap-1.5"
            >
              {loadingMore ? (
                <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              ) : (
                <>
                  <ChevronDown size={14} />
                  Load more
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
