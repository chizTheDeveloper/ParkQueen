import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { BottomSheet } from './BottomSheet';
import { MapPin } from 'lucide-react';
import { getDistance } from './utils';
import { derivePingLifecycle, timestampToMillis } from '../../utils/pingLifecycle';
import { t, useLang } from '../../i18n';
import { buildGeoQueryRanges } from './geoQuery';

interface ParkingActivitySheetProps {
    destination: { name: string; fullName: string; center: [number, number] };
    onExplore: () => void;
    onDismiss: () => void;
    nowMs: number;
}

const SEARCH_RADIUS_MILES = 1;

export const ParkingActivitySheet: React.FC<ParkingActivitySheetProps> = ({
    destination, onExplore, onDismiss, nowMs,
}) => {
    useLang();
    const [nearbySpots, setNearbySpots] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const fetchActivity = async () => {
            setLoading(true);
            try {
                const [lng, lat] = destination.center;
                // Fixed once per fetch — every range shares this exact
                // Timestamp rather than each range computing its own
                // `Timestamp.now()`, giving all ranges the same logical
                // snapshot eligibility boundary.
                const fixedTimestamp = Timestamp.now();
                const ranges = buildGeoQueryRanges(lat, lng, SEARCH_RADIUS_MILES);

                const snaps = await Promise.all(ranges.map(range => getDocs(query(
                    collection(db, 'spots'),
                    where('status', 'in', ['available', 'interested']),
                    where('expiresAt', '>', fixedTimestamp),
                    where('geohash', '>=', range.start),
                    where('geohash', '<=', range.end),
                    orderBy('geohash'),
                ))));

                if (cancelled) return;

                // Geohash ranges can overlap — dedup by document ID before
                // applying the exact-distance filter.
                const merged = new Map<string, any>();
                snaps.forEach(snap => {
                    snap.docs.forEach(d => {
                        const s = d.data();
                        if (s.status === 'occupied') return;
                        merged.set(d.id, s);
                    });
                });

                const spots: any[] = [];
                merged.forEach(s => {
                    const distKm = getDistance(lat, lng, s.lat, s.lng);
                    const distMi = distKm * 0.621371;
                    if (distMi > SEARCH_RADIUS_MILES) return;
                    spots.push(s);
                });

                setNearbySpots(spots);
            } catch (e) {
                console.warn('Parking activity query failed', e);
                if (!cancelled) setNearbySpots([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchActivity();
        return () => { cancelled = true; };
    }, [destination.center[0], destination.center[1]]);

    const stats = useMemo(() => {
        if (!nearbySpots) return null;
        let activePings = 0;
        let leavingLaterPings = 0;
        let mostRecentMs = 0;
        nearbySpots.forEach(spot => {
            const lifecycle = derivePingLifecycle(spot, nowMs);
            if (lifecycle.expired) return;
            if (lifecycle.phase === 'scheduled') leavingLaterPings++;
            else {
                activePings++;
                mostRecentMs = Math.max(mostRecentMs, timestampToMillis(spot.reportedAt));
            }
        });
        let mostRecentAgo: string | null = null;
        if (mostRecentMs > 0) {
            const diffMin = Math.round((nowMs - mostRecentMs) / 60000);
            if (diffMin < 1) mostRecentAgo = t('parking_activity.just_now');
            else if (diffMin < 60) mostRecentAgo = t('parking_activity.min_ago', { count: diffMin });
            else mostRecentAgo = t('parking_activity.hr_ago', { count: Math.round(diffMin / 60) });
        }
        return { activePings, leavingLaterPings, mostRecentAgo };
    }, [nearbySpots, nowMs]);

    const hasActivity = stats && (stats.activePings > 0 || stats.leavingLaterPings > 0);

    return (
        <BottomSheet isOpen={true} onClose={onDismiss} ariaLabel={t('parking_activity.sheet_label')}>
            <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <MapPin size={16} className="text-[#38bdf8]" />
                    <h3 className="font-bold text-base text-[var(--color-text)]">{destination.name}</h3>
                </div>
                <p className="text-[10px] text-[var(--color-text-secondary)] mb-4 truncate px-4">{destination.fullName}</p>

                {loading ? (
                    <p className="text-xs text-[var(--color-text-secondary)] py-4">{t('parking_activity.checking')}</p>
                ) : hasActivity ? (
                    <div className="space-y-2.5 mb-4">
                        <div className="flex justify-between items-center px-3 py-2 bg-white/5 rounded-xl border border-[var(--color-border)]">
                            <span className="text-xs text-[var(--color-text-secondary)]">{t('parking_activity.active_pings')}</span>
                            <span className="text-sm font-bold text-green-400">{stats!.activePings}</span>
                        </div>
                        <div className="flex justify-between items-center px-3 py-2 bg-white/5 rounded-xl border border-[var(--color-border)]">
                            <span className="text-xs text-[var(--color-text-secondary)]">{t('parking_activity.leaving_later')}</span>
                            <span className="text-sm font-bold text-yellow-400">{stats!.leavingLaterPings}</span>
                        </div>
                        {stats!.mostRecentAgo && (
                            <div className="flex justify-between items-center px-3 py-2 bg-white/5 rounded-xl border border-[var(--color-border)]">
                                <span className="text-xs text-[var(--color-text-secondary)]">{t('parking_activity.most_recent')}</span>
                                <span className="text-xs font-semibold text-[var(--color-text)]">{stats!.mostRecentAgo}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-[var(--color-text-secondary)] py-4 mb-2">
                        {t('parking_activity.none_near', { name: destination.name })}
                    </p>
                )}

                <button
                    onClick={onExplore}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 text-white"
                    style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}
                >
                    {t('parking_activity.explore_area', { name: destination.name })}
                </button>
            </div>
        </BottomSheet>
    );
};
