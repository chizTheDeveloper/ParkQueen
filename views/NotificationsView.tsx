import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusOnMount } from '../hooks/useFocusOnMount';
import { t, useLang } from '../i18n';
import { ArrowLeft, MapPin, Bell, LocateFixed, WifiOff } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { deriveNearbyState, type LocationPermissionState, type LocationCallbacks } from '../utils/nearbyActivity';

interface NotificationsViewProps {
    user: any;
    onBack: () => void;
    onSelectSpot?: (spotId: string) => void;
    permissionState: LocationPermissionState;
    callbacks: LocationCallbacks;
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

const avatarGradients = [
    'linear-gradient(135deg,#1e3a5f,#1e40af)',
    'linear-gradient(135deg,#1a2e1a,#14532d)',
    'linear-gradient(135deg,#2e1a2e,#581c87)',
    'linear-gradient(135deg,#3b2a1a,#92400e)',
];

const LOCATION_NEEDED: LocationPermissionState[] = [
    'not_determined', 'denied_requestable', 'permanently_blocked', 'services_disabled',
];

export const NotificationsView: React.FC<NotificationsViewProps> = ({
    user, onBack, onSelectSpot, permissionState, callbacks,
}) => {
    const [spots, setSpots] = useState<any[]>([]);
    const [spotsLoading, setSpotsLoading] = useState(true);
    const [spotsError, setSpotsError] = useState(false);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const headingRef = useRef<HTMLHeadingElement>(null);
    useFocusOnMount(headingRef);
    useLang();

    const lastViewed = parseInt(localStorage.getItem('lastViewedNotifications') || '0', 10);

    // Fetch coordinates only when granted
    const fetchLocation = useCallback(() => {
        if (!navigator.geolocation) { setLocationError(true); return; }
        setLocating(true);
        setLocationError(false);
        const timer = setTimeout(() => { setLocating(false); setLocationError(true); }, 10000);
        navigator.geolocation.getCurrentPosition(
            pos => {
                clearTimeout(timer);
                setUserLocation([pos.coords.latitude, pos.coords.longitude]);
                setLocating(false);
            },
            () => { clearTimeout(timer); setLocating(false); setLocationError(true); },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    useEffect(() => {
        if (permissionState === 'granted' && !userLocation) fetchLocation();
        setRequesting(false);
    }, [permissionState]); // eslint-disable-line react-hooks/exhaustive-deps

    // Recheck when returning to foreground (for permanently_blocked / services_disabled)
    useEffect(() => {
        if (permissionState !== 'permanently_blocked' && permissionState !== 'services_disabled') return;
        const onVisible = () => { if (document.visibilityState === 'visible') callbacks.recheckPermission(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [permissionState, callbacks]);

    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, 'spots'), where('expiresAt', '>', Timestamp.now()));
        return onSnapshot(
            q,
            snap => {
                const all = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }) as any)
                    .filter(s => s.finderId !== user?.id && s.status !== 'interested');
                all.sort((a, b) => (b.reportedAt?.toMillis() || 0) - (a.reportedAt?.toMillis() || 0));
                setSpots(all);
                setSpotsLoading(false);
            },
            () => { setSpotsLoading(false); setSpotsError(true); }
        );
    }, [user?.id]);

    const filteredSpots = userLocation
        ? spots.filter(s => getDistanceKm(userLocation[0], userLocation[1], s.lat, s.lng) <= 2.0)
        : spots;
    const nearbySpots = filteredSpots.slice(0, 10);
    const hasMore = filteredSpots.length > 10;
    const showNoLocationBanner = !userLocation && spots.length > 0 && permissionState === 'granted';

    const renderState = deriveNearbyState({
        permissionState,
        locating,
        locationError,
        userLocation,
        spotsLoading,
        spotsError,
        nearbyCount: nearbySpots.length,
    });

    const isLocationNeeded = (LOCATION_NEEDED as string[]).includes(renderState);

    // CTA for each location-needed sub-state
    const locationCTA = renderState === 'permanently_blocked'
        ? { label: t('nearby_activity.open_settings'), action: callbacks.openAppSettings }
        : renderState === 'services_disabled'
        ? { label: t('nearby_activity.turn_on_services'), action: callbacks.openLocationServicesSettings }
        : {
            label: requesting ? t('nearby_activity.enable_requesting') : t('nearby_activity.enable_cta'),
            action: () => { setRequesting(true); callbacks.requestLocationPermission(); },
        };

    return (
        <div className="h-full bg-[var(--color-bg)] flex flex-col">
            {/* Header */}
            <div
                className="flex items-center gap-3 px-4 pb-4 border-b border-[var(--color-border)] shrink-0"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}
            >
                <button
                    onClick={onBack}
                    className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/5 text-[var(--color-text)] transition-colors shrink-0"
                    aria-label="Back"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1
                        ref={headingRef}
                        tabIndex={-1}
                        className="text-[18px] font-bold text-[var(--color-text)] focus:outline-none leading-tight"
                    >
                        {t('common.nearby_activity')}
                    </h1>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                        {t('nearby_activity.subtitle')}
                    </p>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar">

                {/* ── Unified location-needed state ───────────────────────── */}
                {isLocationNeeded && (
                    <div className="flex flex-col items-center justify-center px-6 py-10 text-center gap-4 min-h-[420px]">
                        {/* Illustration */}
                        <div className="relative mb-2">
                            <div className="w-24 h-24 rounded-full bg-[#1e75ff]/10 border border-[#1e75ff]/20 flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-[#1e75ff]/15 border border-[#1e75ff]/30 flex items-center justify-center">
                                    <MapPin size={28} className="text-[#38bdf8]" />
                                </div>
                            </div>
                            <div
                                className="absolute inset-0 rounded-full border border-[#1e75ff]/20 animate-ping"
                                style={{ animationDuration: '2s' }}
                            />
                        </div>

                        <p
                            className="text-[20px] font-bold text-[var(--color-text)] leading-tight"
                            style={{ textWrap: 'balance' } as React.CSSProperties}
                        >
                            {t('nearby_activity.enable_headline')}
                        </p>
                        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed max-w-[260px]">
                            {t('nearby_activity.enable_body')}
                        </p>

                        <button
                            type="button"
                            onClick={locationCTA.action}
                            disabled={requesting && renderState !== 'permanently_blocked' && renderState !== 'services_disabled'}
                            className="w-full max-w-[280px] h-[54px] rounded-full font-semibold text-[16px] text-white active:scale-[0.985] transition-transform disabled:opacity-70 mt-2"
                            style={{ background: 'linear-gradient(90deg,#1e75ff,#0ea5e9)' }}
                        >
                            {locationCTA.label}
                        </button>

                        <p className="text-[12px] leading-snug max-w-[240px]" style={{ color: 'rgba(255,255,255,0.40)' }}>
                            {t('nearby_activity.enable_reassurance')}
                        </p>
                    </div>
                )}

                {/* ── locating ────────────────────────────────────────────── */}
                {renderState === 'locating' && (
                    <div aria-live="polite" role="status" className="flex flex-col items-center justify-center gap-4 h-48">
                        <div className="w-7 h-7 rounded-full border-2 border-[#1e75ff] border-t-transparent animate-spin" />
                        <p className="text-[14px] font-semibold text-[var(--color-text)]">
                            {t('nearby_activity.locating_headline')}
                        </p>
                        <p className="text-[13px] text-[var(--color-text-secondary)]">
                            {t('nearby_activity.locating_body')}
                        </p>
                    </div>
                )}

                {/* ── location_error ──────────────────────────────────────── */}
                {renderState === 'location_error' && (
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-1">
                            <LocateFixed size={24} className="text-amber-400" />
                        </div>
                        <p className="text-[17px] font-bold text-[var(--color-text)]">
                            {t('nearby_activity.error_headline')}
                        </p>
                        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed max-w-[240px]">
                            {t('nearby_activity.error_body')}
                        </p>
                        <button
                            type="button"
                            onClick={fetchLocation}
                            className="mt-2 px-8 h-[44px] rounded-full font-semibold text-[14px] text-white border border-[#1e75ff]/40 active:scale-[0.985] transition-transform"
                            style={{ background: '#0d1a2e' }}
                        >
                            {t('nearby_activity.error_retry')}
                        </button>
                    </div>
                )}

                {/* ── pings_loading ───────────────────────────────────────── */}
                {renderState === 'pings_loading' && (
                    <div aria-live="polite" role="status" className="flex flex-col items-center justify-center gap-4 h-48">
                        <div className="w-7 h-7 rounded-full border-2 border-[#1e75ff] border-t-transparent animate-spin" />
                        <p className="text-[14px] font-semibold text-[var(--color-text)]">
                            {t('nearby_activity.loading_headline')}
                        </p>
                    </div>
                )}

                {/* ── empty ───────────────────────────────────────────────── */}
                {renderState === 'empty' && (
                    <div aria-live="polite" className="flex flex-col items-center justify-center px-8 py-24 text-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-[#1e75ff]/10 border border-[#1e75ff]/20 flex items-center justify-center mb-1">
                            <Bell size={28} className="text-[#38bdf8]" />
                        </div>
                        <p className="text-[17px] font-bold text-[var(--color-text)]">
                            {t('nearby_activity.empty_headline')}
                        </p>
                        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed max-w-[240px]">
                            {t('nearby_activity.empty_body')}
                        </p>
                    </div>
                )}

                {/* ── query_error ─────────────────────────────────────────── */}
                {renderState === 'query_error' && (
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-1">
                            <WifiOff size={24} className="text-rose-400" />
                        </div>
                        <p className="text-[17px] font-bold text-[var(--color-text)]">
                            {t('nearby_activity.query_error_headline')}
                        </p>
                        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed max-w-[240px]">
                            {t('nearby_activity.query_error_body')}
                        </p>
                        <button
                            type="button"
                            onClick={() => { setSpotsError(false); setSpotsLoading(true); }}
                            className="mt-2 px-8 h-[44px] rounded-full font-semibold text-[14px] text-white border border-[#1e75ff]/40 active:scale-[0.985] transition-transform"
                            style={{ background: '#0d1a2e' }}
                        >
                            {t('nearby_activity.query_error_retry')}
                        </button>
                    </div>
                )}

                {/* ── results ─────────────────────────────────────────────── */}
                {renderState === 'results' && (
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

                        <p className="text-[10px] font-bold text-[#1e75ff] tracking-widest uppercase px-1 pb-1">
                            {nearbySpots.length} {nearbySpots.length === 1 ? 'ping' : 'pings'}{userLocation ? ' within 2 mi' : ' nearby'}
                        </p>

                        {nearbySpots.map(spot => {
                            const km = userLocation
                                ? getDistanceKm(userLocation[0], userLocation[1], spot.lat, spot.lng)
                                : null;
                            const distStr = km !== null ? formatDistance(km) : null;
                            const time = relativeTime(spot.reportedAt);
                            const isNew = (spot.reportedAt?.toMillis?.() || 0) > lastViewed;
                            const expiringSoon = (spot.expiresAt?.toMillis?.() || 0) > 0 &&
                                (spot.expiresAt.toMillis() - Date.now()) < 5 * 60 * 1000;
                            const address = spot.address || 'Shared spot nearby';
                            const finderName = spot.finderName || spot.username || 'Someone nearby';
                            const initial = finderName.charAt(0).toUpperCase();
                            const avatarBg = avatarGradients[initial.charCodeAt(0) % avatarGradients.length];

                            return (
                                <button
                                    key={spot.id}
                                    onClick={() => { onSelectSpot?.(spot.id); onBack(); }}
                                    aria-label={t('nearby_activity.open_ping_aria', { name: finderName })}
                                    className={`w-full text-left rounded-2xl px-4 py-3.5 flex items-start gap-3 active:scale-[0.99] transition-transform border ${
                                        isNew
                                            ? 'bg-[#0d1f35] border-[#1e75ff]/20'
                                            : 'bg-[var(--color-card)] border-[var(--color-border)]'
                                    }`}
                                >
                                    <div className="relative shrink-0 mt-0.5">
                                        <div
                                            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[15px] font-extrabold text-white"
                                            style={{ background: avatarBg }}
                                        >
                                            {initial}
                                        </div>
                                        {isNew && (
                                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#38bdf8] border-2 border-[var(--color-card)]" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                                            <p className="text-[13px] text-[var(--color-text)] leading-snug truncate">
                                                <span className={isNew ? 'font-extrabold' : 'font-semibold'}>{finderName}</span>
                                                <span className="text-[var(--color-text-secondary)] font-normal"> {t('nearby_activity.pinged_a_spot')}</span>
                                            </p>
                                            {time && (
                                                <span className="text-[11px] text-[var(--color-text-secondary)] shrink-0">{time}</span>
                                            )}
                                        </div>

                                        <p className="text-[12px] text-[var(--color-text-secondary)] truncate mb-2">{address}</p>

                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {distStr && (
                                                <span className="text-[11px] text-[var(--color-text-secondary)]">{t('nearby_activity.distance_away', { dist: distStr })}</span>
                                            )}
                                            {distStr && (
                                                <span className="text-[var(--color-border)] text-[10px] leading-none">·</span>
                                            )}
                                            {expiringSoon ? (
                                                <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
                                                    {t('nearby_activity.expiring_soon')}
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                                                    {t('nearby_activity.available_now')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}

                        {hasMore && (
                            <p className="text-center text-[11px] text-[var(--color-text-secondary)] pt-1 pb-2">
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
