import React, { useState, useEffect, useRef } from 'react';
import { useFocusOnMount } from '../hooks/useFocusOnMount';
import { t, useLang } from '../i18n';
import { ArrowLeft, MapPin, Bell } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';

interface NotificationsViewProps {
    user: any;
    onBack: () => void;
    onSelectSpot?: (spotId: string) => void;
}

const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (km: number): string => {
    const miles = km * 0.621371;
    if (miles < 0.1) return `${Math.round(km * 3280.84)} ft`;
    return `${miles.toFixed(1)} mi`;
};

const relativeTime = (ts: any): string => {
    if (!ts) return '';
    const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : (ts.seconds ?? 0) * 1000;
    const diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

export const NotificationsView: React.FC<NotificationsViewProps> = ({ user, onBack, onSelectSpot }) => {
    const [spots, setSpots] = useState<any[]>([]);
    const [spotsLoading, setSpotsLoading] = useState(true);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const headingRef = useRef<HTMLHeadingElement>(null);
    useFocusOnMount(headingRef);
    useLang(); // re-render on language change

    const lastViewed = parseInt(localStorage.getItem('lastViewedNotifications') || '0', 10);

    // Geolocation — max 5s wait before showing location-needed state
    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationLoading(false);
            return;
        }
        const timer = setTimeout(() => setLocationLoading(false), 5000);
        navigator.geolocation.getCurrentPosition(
            pos => {
                clearTimeout(timer);
                setUserLocation([pos.coords.latitude, pos.coords.longitude]);
                setLocationLoading(false);
            },
            () => {
                clearTimeout(timer);
                setLocationLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
        return () => clearTimeout(timer);
    }, []);

    // Active spots listener — own pings excluded
    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, 'spots'), where('expiresAt', '>', Timestamp.now()));
        return onSnapshot(q, snap => {
            const all = snap.docs
                .map(d => ({ id: d.id, ...d.data() }) as any)
                .filter(s => s.finderId !== user?.id);
            all.sort((a, b) => (b.reportedAt?.toMillis() || 0) - (a.reportedAt?.toMillis() || 0));
            setSpots(all);
            setSpotsLoading(false);
        }, () => setSpotsLoading(false));
    }, [user?.id]);

    const isLoading = spotsLoading || locationLoading;

    // Filter to 2km when location is known; show all when location unavailable
    const filteredSpots = userLocation
        ? spots.filter(s => getDistanceKm(userLocation[0], userLocation[1], s.lat, s.lng) <= 2.0)
        : spots;
    const nearbySpots = filteredSpots.slice(0, 10);
    const hasMore = filteredSpots.length > 10;
    const showNoLocationBanner = !userLocation && spots.length > 0;

    const showList = !isLoading && nearbySpots.length > 0;
    const showEmpty = !isLoading && nearbySpots.length === 0 && (!!userLocation || spots.length === 0);
    const showNoLocation = !isLoading && !userLocation && spots.length === 0;

    return (
        <div className="h-full bg-[var(--color-bg)] flex flex-col">
            {/* Header */}
            <div
                className="flex items-center gap-3 px-4 pb-4 border-b border-[var(--color-border)] shrink-0"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
            >
                <button
                    onClick={onBack}
                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 text-[var(--color-text)] transition-colors"
                    aria-label="Back"
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 ref={headingRef} tabIndex={-1} className="text-[18px] font-bold text-[var(--color-text)] focus:outline-none">{t('common.nearby_activity')}</h1>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar">

                {/* Loading */}
                {isLoading && (
                    <div aria-live="polite" role="status" className="flex justify-center items-center h-48">
                        <div className="w-7 h-7 rounded-full border-2 border-[#1e75ff] border-t-transparent animate-spin" />
                    </div>
                )}

                {/* Location unavailable */}
                {showNoLocation && (
                    <div aria-live="polite" className="flex flex-col items-center justify-center px-8 py-24 text-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-[#1e75ff]/10 border border-[#1e75ff]/20 flex items-center justify-center mb-1">
                            <MapPin size={28} className="text-[#38bdf8]" />
                        </div>
                        <p className="text-[17px] font-bold text-[var(--color-text)]">{t('nearby_activity.location_needed')}</p>
                        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed max-w-[240px]">
                            {t('nearby_activity.location_needed_body')}
                        </p>
                    </div>
                )}

                {/* Location available, no nearby spots */}
                {showEmpty && (
                    <div aria-live="polite" className="flex flex-col items-center justify-center px-8 py-24 text-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-[#1e75ff]/10 border border-[#1e75ff]/20 flex items-center justify-center mb-1">
                            <Bell size={28} className="text-[#38bdf8]" />
                        </div>
                        <p className="text-[17px] font-bold text-[var(--color-text)]">{t('nearby_activity.all_clear')}</p>
                        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed max-w-[240px]">
                            {t('nearby_activity.no_pings')}
                        </p>
                    </div>
                )}

                {/* Spot list */}
                {showList && (
                    <div className="px-3 py-3 flex flex-col gap-2 pb-10">
                        {showNoLocationBanner && (
                            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 mb-1">
                                <MapPin size={16} className="text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[13px] font-bold text-amber-400">{t('common.location_off')}</p>
                                    <p className="text-[12px] text-[var(--color-text-secondary)] leading-snug mt-0.5">
                                        {t('common.location_off_body')}
                                    </p>
                                </div>
                            </div>
                        )}
                        {nearbySpots.map(spot => {
                            const km = userLocation
                                ? getDistanceKm(userLocation[0], userLocation[1], spot.lat, spot.lng)
                                : null;
                            const distStr = km !== null ? formatDistance(km) : null;
                            const time = relativeTime(spot.reportedAt);
                            const isNew = (spot.reportedAt?.toMillis?.() || 0) > lastViewed;
                            const isClaimed = spot.status === 'interested';
                            const expiresMs = spot.expiresAt?.toMillis?.() || 0;
                            const expiringSoon = expiresMs > 0 && (expiresMs - Date.now()) < 5 * 60 * 1000;
                            const address = spot.address || 'Shared spot nearby';
                            const finderName = spot.finderName || spot.username || 'Someone nearby';

                            return (
                                <button
                                    key={spot.id}
                                    onClick={() => { onSelectSpot?.(spot.id); onBack(); }}
                                    aria-label={t('nearby_activity.open_ping_aria', { name: finderName })}
                                    className="w-full text-left bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl px-4 py-3.5 flex items-start gap-3 active:scale-[0.99] transition-transform"
                                >
                                    {/* Icon with unread dot */}
                                    <div className="relative shrink-0 mt-0.5">
                                        <div className="w-9 h-9 rounded-full bg-[#1e75ff]/12 border border-[#1e75ff]/25 flex items-center justify-center">
                                            <MapPin size={16} className="text-[#38bdf8]" />
                                        </div>
                                        {isNew && (
                                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#38bdf8] border-2 border-[var(--color-card)]" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        {/* Name + time */}
                                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                                            <p className="text-[13px] text-[var(--color-text)] leading-snug truncate">
                                                <span className="font-semibold">{finderName}</span>
                                                <span className="text-[var(--color-text-secondary)] font-normal"> {t('nearby_activity.pinged_a_spot')}</span>
                                            </p>
                                            {time && (
                                                <span className="text-[11px] text-[var(--color-text-secondary)] shrink-0">{time}</span>
                                            )}
                                        </div>

                                        {/* Address */}
                                        <p className="text-[12px] text-[var(--color-text-secondary)] truncate mb-2">{address}</p>

                                        {/* Distance + status chip */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {distStr && (
                                                <span className="text-[11px] text-[var(--color-text-secondary)]">{t('nearby_activity.distance_away', { dist: distStr })}</span>
                                            )}
                                            {distStr && (
                                                <span className="text-[var(--color-border)] text-[10px] leading-none">·</span>
                                            )}
                                            {expiringSoon ? (
                                                <span className="text-[11px] font-semibold text-amber-400">{t('nearby_activity.expiring_soon')}</span>
                                            ) : isClaimed ? (
                                                <span className="text-[11px] font-semibold text-[#38bdf8]">{t('nearby_activity.someone_on_way')}</span>
                                            ) : (
                                                <span className="text-[11px] font-semibold text-emerald-400">{t('nearby_activity.available_now')}</span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                        {hasMore && (
                            <p className="text-center text-[12px] text-[var(--color-text-secondary)] pt-1 pb-2">
                                {userLocation
                                    ? t('nearby_activity.showing_closest', { more: filteredSpots.length - 10 })
                                    : t('nearby_activity.showing_recent', { more: filteredSpots.length - 10 })}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
