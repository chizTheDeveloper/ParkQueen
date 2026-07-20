import React, { useState, useEffect, useCallback } from 'react';
import { t, useLang } from '../i18n';
import { readPersistedAccess, resolveFromPermissions } from '../utils/locationAccess';

interface LocationPromptViewProps {
    onComplete: (access: 'granted' | 'declined' | 'denied') => void;
}

const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const LocationPromptView: React.FC<LocationPromptViewProps> = ({ onComplete }) => {
    useLang();
    const [requesting, setRequesting] = useState(false);

    // Best-effort Permissions API check — skip the primer if already resolved
    useEffect(() => {
        if (!navigator.permissions) return;
        navigator.permissions
            .query({ name: 'geolocation' })
            .then((result) => {
                const resolved = resolveFromPermissions(result.state, readPersistedAccess());
                if (resolved === 'granted') {
                    onComplete('granted');
                } else if (resolved === 'denied') {
                    // Permission already denied by the browser — skip the primer
                    onComplete('denied');
                }
                // 'unknown' or 'declined' → show the primer normally
            })
            .catch(() => {
                // Safari / unavailable — show the primer normally
            });
    }, [onComplete]);

    const handleEnable = useCallback(() => {
        if (requesting) return;
        if (!navigator.geolocation) {
            onComplete('denied');
            return;
        }
        setRequesting(true);
        navigator.geolocation.getCurrentPosition(
            () => {
                onComplete('granted');
            },
            () => {
                onComplete('denied');
            },
            { enableHighAccuracy: false, timeout: 15000 }
        );
    }, [requesting, onComplete]);

    const handleSkip = useCallback(() => {
        onComplete('declined');
    }, [onComplete]);

    return (
        <div
            className="fixed inset-0 z-[200] flex flex-col bg-[#060a14]"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            {/* ── Static map preview ─────────────────────────────────────────── */}
            <div
                className={`relative flex-1 overflow-hidden${prefersReduced ? '' : ' loc-map-in'}`}
                role="img"
                aria-label={t('location_prompt.map_desc')}
            >
                {/* Road network SVG */}
                <svg
                    viewBox="0 0 375 330"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute inset-0 w-full h-full"
                    preserveAspectRatio="xMidYMid slice"
                    aria-hidden="true"
                >
                    <defs>
                        <linearGradient id="loc-fade-btm" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="55%" stopOpacity="0" />
                            <stop offset="100%" stopColor="#060a14" stopOpacity="1" />
                        </linearGradient>
                        <radialGradient id="loc-vignette" cx="50%" cy="50%" r="65%">
                            <stop offset="0%" stopOpacity="0" />
                            <stop offset="100%" stopColor="#060a14" stopOpacity="0.55" />
                        </radialGradient>
                    </defs>

                    {/* Base */}
                    <rect width="375" height="330" fill="#060a14" />

                    {/* City blocks */}
                    <rect x="0"   y="0"   width="90"  height="82"  fill="#090d1c" />
                    <rect x="97"  y="0"   width="88"  height="82"  fill="#0a0f1e" />
                    <rect x="193" y="0"   width="89"  height="82"  fill="#090d1c" />
                    <rect x="290" y="0"   width="85"  height="82"  fill="#0a0f1e" />
                    <rect x="0"   y="89"  width="90"  height="73"  fill="#0a0f1e" />
                    <rect x="97"  y="89"  width="88"  height="73"  fill="#090d1c" />
                    <rect x="193" y="89"  width="89"  height="73"  fill="#0a0f1e" />
                    <rect x="290" y="89"  width="85"  height="73"  fill="#090d1c" />
                    <rect x="0"   y="170" width="90"  height="82"  fill="#090d1c" />
                    <rect x="97"  y="170" width="88"  height="82"  fill="#0a0f1e" />
                    <rect x="193" y="170" width="89"  height="82"  fill="#090d1c" />
                    <rect x="290" y="170" width="85"  height="82"  fill="#0a0f1e" />
                    <rect x="0"   y="260" width="90"  height="70"  fill="#0a0f1e" />
                    <rect x="97"  y="260" width="88"  height="70"  fill="#090d1c" />
                    <rect x="193" y="260" width="89"  height="70"  fill="#0a0f1e" />
                    <rect x="290" y="260" width="85"  height="70"  fill="#090d1c" />

                    {/* Minor cross-streets */}
                    <line x1="0" y1="41"  x2="375" y2="41"  stroke="#0d1525" strokeWidth="1.5" />
                    <line x1="0" y1="130" x2="375" y2="130" stroke="#0d1525" strokeWidth="1.5" />
                    <line x1="0" y1="214" x2="375" y2="214" stroke="#0d1525" strokeWidth="1.5" />
                    <line x1="0" y1="295" x2="375" y2="295" stroke="#0d1525" strokeWidth="1.5" />
                    <line x1="44"  y1="0" x2="44"  y2="330" stroke="#0d1525" strokeWidth="1.5" />
                    <line x1="143" y1="0" x2="143" y2="330" stroke="#0d1525" strokeWidth="1.5" />
                    <line x1="242" y1="0" x2="242" y2="330" stroke="#0d1525" strokeWidth="1.5" />
                    <line x1="338" y1="0" x2="338" y2="330" stroke="#0d1525" strokeWidth="1.5" />

                    {/* Major avenues (vertical) */}
                    <rect x="90"  y="0" width="7" height="330" fill="#18223c" />
                    <rect x="185" y="0" width="8" height="330" fill="#192440" />
                    <rect x="283" y="0" width="7" height="330" fill="#18223c" />

                    {/* Major streets (horizontal) */}
                    <rect x="0" y="82"  width="375" height="7" fill="#18223c" />
                    <rect x="0" y="162" width="375" height="8" fill="#192440" />
                    <rect x="0" y="252" width="375" height="7" fill="#18223c" />

                    {/* Diagonal — Broadway-like */}
                    <line x1="18" y1="0" x2="357" y2="330" stroke="#131c32" strokeWidth="5" strokeLinecap="round" />

                    {/* Overlay fades */}
                    <rect width="375" height="330" fill="url(#loc-fade-btm)" />
                    <rect width="375" height="330" fill="url(#loc-vignette)" />
                </svg>

                {/* Animated overlay — user dot and demo Pings */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* User location centered on main intersection */}
                    <div
                        className="absolute"
                        style={{ top: '50.3%', left: '50.4%', transform: 'translate(-50%, -50%)' }}
                    >
                        {/* One-shot expanding accuracy ring */}
                        {!prefersReduced && (
                            <div
                                className="absolute rounded-full border border-blue-500/25 loc-ring"
                                style={{ width: 28, height: 28, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                            />
                        )}
                        {/* Halo + dot — identical to production user-location marker */}
                        <div className={`relative flex items-center justify-center${prefersReduced ? '' : ' loc-dot-in'}`}>
                            <div className="absolute w-6 h-6 bg-blue-500/20 rounded-full" />
                            <div className="w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white shadow-md" />
                        </div>
                    </div>

                    {/* Blue Ping — upper right */}
                    <div
                        className={`absolute${prefersReduced ? '' : ' loc-ping-in'}`}
                        style={{ top: '27%', left: '65%', animationDelay: '0.3s' }}
                        aria-hidden="true"
                    >
                        <svg width="28" height="33" viewBox="0 0 28 33" fill="none">
                            <path d="M14 2C20.3 2 25 7 25 13C25 21 14 31 14 31C14 31 3 21 3 13C3 7 7.7 2 14 2Z" fill="#1e75ff" style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.55))' }} />
                            <text x="14" y="17" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="system-ui,sans-serif">P</text>
                        </svg>
                    </div>

                    {/* Yellow scheduled Ping — lower right */}
                    <div
                        className={`absolute${prefersReduced ? '' : ' loc-ping-in'}`}
                        style={{ top: '62%', left: '76%', animationDelay: '0.36s' }}
                        aria-hidden="true"
                    >
                        <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
                            <path d="M12 1.5C17.5 1.5 22 6 22 11.5C22 19 12 27 12 27C12 27 2 19 2 11.5C2 6 6.5 1.5 12 1.5Z" fill="#eab308" style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.55))' }} />
                            <circle cx="12" cy="11" r="5" stroke="white" strokeWidth="1.5" fill="none" />
                            <line x1="12" y1="11" x2="12" y2="8"   stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                            <line x1="12" y1="11" x2="14.5" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </div>

                    {/* Blue Ping — lower left */}
                    <div
                        className={`absolute${prefersReduced ? '' : ' loc-ping-in'}`}
                        style={{ top: '60%', left: '27%', animationDelay: '0.42s' }}
                        aria-hidden="true"
                    >
                        <svg width="28" height="33" viewBox="0 0 28 33" fill="none">
                            <path d="M14 2C20.3 2 25 7 25 13C25 21 14 31 14 31C14 31 3 21 3 13C3 7 7.7 2 14 2Z" fill="#1e75ff" style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.55))' }} />
                            <text x="14" y="17" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="system-ui,sans-serif">P</text>
                        </svg>
                    </div>
                </div>
            </div>

            {/* ── Permission sheet ───────────────────────────────────────────── */}
            <div
                className={`relative bg-[#080c18] rounded-t-[28px] px-6 pt-5${prefersReduced ? '' : ' loc-sheet-in'}`}
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
            >
                {/* Pull handle */}
                <div className="w-9 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.12)' }} />

                {/* Eyebrow */}
                <p className="text-[11px] font-bold tracking-[0.14em] text-blue-400 uppercase mb-2">
                    {t('location_prompt.eyebrow')}
                </p>

                {/* Headline */}
                <h1 className="text-[24px] font-bold text-white leading-tight mb-2">
                    {t('location_prompt.headline')}
                </h1>

                {/* Body */}
                <p className="text-[14px] leading-snug mb-6" style={{ color: 'rgba(255,255,255,0.58)' }}>
                    {t('location_prompt.body')}
                </p>

                {/* Enable location */}
                <button
                    type="button"
                    onClick={handleEnable}
                    disabled={requesting}
                    className="w-full h-[58px] rounded-full font-semibold text-[16px] text-white active:scale-[0.985] transition-transform disabled:opacity-70 mb-3"
                    style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}
                >
                    {requesting ? t('location_prompt.requesting') : t('location_prompt.enable')}
                </button>

                {/* Not now */}
                <button
                    type="button"
                    onClick={handleSkip}
                    disabled={requesting}
                    className="w-full min-h-[44px] flex items-center justify-center text-[15px] font-medium mb-4"
                    style={{ color: 'rgba(255,255,255,0.42)' }}
                >
                    {t('location_prompt.skip')}
                </button>

                {/* Reassurance */}
                <p className="text-[12px] text-center leading-snug" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {t('location_prompt.reassurance')}
                </p>
            </div>
        </div>
    );
};
