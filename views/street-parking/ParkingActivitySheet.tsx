import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { BottomSheet } from './BottomSheet';
import { MapPin } from 'lucide-react';
import { getDistance } from './utils';

interface ParkingActivitySheetProps {
    destination: { name: string; fullName: string; center: [number, number] };
    onExplore: () => void;
    onDismiss: () => void;
}

const SEARCH_RADIUS_MILES = 1;

export const ParkingActivitySheet: React.FC<ParkingActivitySheetProps> = ({
    destination, onExplore, onDismiss,
}) => {
    const [stats, setStats] = useState<{
        activePings: number;
        leavingLaterPings: number;
        mostRecentAgo: string | null;
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const fetchActivity = async () => {
            setLoading(true);
            try {
                const now = Timestamp.now();
                const q = query(
                    collection(db, 'spots'),
                    where('status', 'in', ['available', 'interested']),
                    where('expiresAt', '>', now),
                );
                const snap = await getDocs(q);

                const [lng, lat] = destination.center;
                let activePings = 0;
                let leavingLaterPings = 0;
                let mostRecentMs = 0;

                snap.docs.forEach(d => {
                    const s = d.data();
                    if (s.status === 'occupied') return;

                    const distKm = getDistance(lat, lng, s.lat, s.lng);
                    const distMi = distKm * 0.621371;
                    if (distMi > SEARCH_RADIUS_MILES) return;

                    if (s.pingMode === 'later') {
                        leavingLaterPings++;
                    } else {
                        activePings++;
                    }

                    const reported = s.reportedAt?.toMillis?.() || 0;
                    if (reported > mostRecentMs) mostRecentMs = reported;
                });

                if (cancelled) return;

                let mostRecentAgo: string | null = null;
                if (mostRecentMs > 0) {
                    const diffMin = Math.round((Date.now() - mostRecentMs) / 60000);
                    if (diffMin < 1) mostRecentAgo = 'Just now';
                    else if (diffMin < 60) mostRecentAgo = `${diffMin} min ago`;
                    else mostRecentAgo = `${Math.round(diffMin / 60)} hr ago`;
                }

                setStats({ activePings, leavingLaterPings, mostRecentAgo });
            } catch (e) {
                console.warn('Parking activity query failed', e);
                if (!cancelled) setStats({ activePings: 0, leavingLaterPings: 0, mostRecentAgo: null });
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchActivity();
        return () => { cancelled = true; };
    }, [destination.center[0], destination.center[1]]);

    const hasActivity = stats && (stats.activePings > 0 || stats.leavingLaterPings > 0);

    return (
        <BottomSheet isOpen={true} onClose={onDismiss}>
            <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <MapPin size={16} className="text-[#38bdf8]" />
                    <h3 className="font-bold text-base text-[var(--color-text)]">{destination.name}</h3>
                </div>
                <p className="text-[10px] text-[var(--color-text-secondary)] mb-4 truncate px-4">{destination.fullName}</p>

                {loading ? (
                    <p className="text-xs text-[var(--color-text-secondary)] py-4">Checking parking activity...</p>
                ) : hasActivity ? (
                    <div className="space-y-2.5 mb-4">
                        <div className="flex justify-between items-center px-3 py-2 bg-white/5 rounded-xl border border-[var(--color-border)]">
                            <span className="text-xs text-[var(--color-text-secondary)]">Active pings</span>
                            <span className="text-sm font-bold text-green-400">{stats!.activePings}</span>
                        </div>
                        <div className="flex justify-between items-center px-3 py-2 bg-white/5 rounded-xl border border-[var(--color-border)]">
                            <span className="text-xs text-[var(--color-text-secondary)]">Leaving later</span>
                            <span className="text-sm font-bold text-yellow-400">{stats!.leavingLaterPings}</span>
                        </div>
                        {stats!.mostRecentAgo && (
                            <div className="flex justify-between items-center px-3 py-2 bg-white/5 rounded-xl border border-[var(--color-border)]">
                                <span className="text-xs text-[var(--color-text-secondary)]">Most recent ping</span>
                                <span className="text-xs font-semibold text-[var(--color-text)]">{stats!.mostRecentAgo}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-[var(--color-text-secondary)] py-4 mb-2">
                        No parking activity near {destination.name} right now
                    </p>
                )}

                <button
                    onClick={onExplore}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 text-white"
                    style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}
                >
                    Explore {destination.name} area
                </button>
            </div>
        </BottomSheet>
    );
};
