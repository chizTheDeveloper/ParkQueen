import React, { useState, useEffect, useRef } from 'react';
import { useFocusOnMount } from '../hooks/useFocusOnMount';
import { doc, updateDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, ChevronRight, Edit, Clock, Info, Settings, Crown, MapPin, Handshake, ParkingSquare } from 'lucide-react';
import { VehicleIcon } from '../utils/vehicleIcon';
import { AppView } from '../types';
import { getNextTitle, getTierForCrowns, TIER_VISUALS, getProgressPct } from '../utils/crowns';
import { deriveImpactCounts } from '../utils/profileImpact';
import { t, useLang, getLang } from '../i18n';
import { AvatarComposite } from '../components/AvatarComposite';
import { ParsonaMigrationPrompt } from '../components/ParsonaMigrationPrompt';

export const ProfileView = ({ user, onBack, setView }) => {
  useLang();
  const dismissKey = `parsona_migration_dismissed_v1_${user?.uid ?? ''}`;
  const [migrationDismissed, setMigrationDismissed] = useState(
    () => localStorage.getItem(`parsona_migration_dismissed_v1_${user?.uid ?? ''}`) === '1'
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [recentActivity, setRecentActivity] = useState<{ id: string; icon: string; actionKey: string; address: string; ts: number; reward: string | null }[]>([]);
  const [impactState, setImpactState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [impactCounts, setImpactCounts] = useState({ pingsShared: 0, successfulHandoffs: 0, spotsFound: 0 });
  const [showCrownsInfo, setShowCrownsInfo] = useState(false);
  useFocusOnMount(headingRef);

  const fmt = (ms: number) => {
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return t('profile.time_just_now');
    if (min < 60) return t('profile.time_min_ago', { min });
    const hr = Math.round(min / 60);
    if (hr < 24) return t('profile.time_hr_ago', { hr });
    return t('profile.time_days_ago', { d: Math.round(hr / 24) });
  };

  const colorLabels: Record<string, string> = {
    'Black': t('vehicle.color_black'), 'White': t('vehicle.color_white'),
    'Silver': t('vehicle.color_silver'), 'Gray': t('vehicle.color_gray'),
    'Blue': t('vehicle.color_blue'), 'Red': t('vehicle.color_red'),
    'Green': t('vehicle.color_green'), 'Brown': t('vehicle.color_brown'),
    'Beige': t('vehicle.color_beige'), 'Gold': t('vehicle.color_gold'),
    'Yellow': t('vehicle.color_yellow'), 'Orange': t('vehicle.color_orange'),
    'Purple': t('vehicle.color_purple'),
  };
  const typeLabels: Record<string, string> = {
    'Sedan': t('vehicle.type_sedan'), 'Compact': t('vehicle.type_compact'),
    'SUV': t('vehicle.type_suv'), 'Hatchback': t('vehicle.type_hatchback'),
    'Coupe': t('vehicle.type_coupe'), 'Pickup Truck': t('vehicle.type_pickup_truck'),
    'Van': t('vehicle.type_van'), 'Minivan': t('vehicle.type_minivan'),
    'Wagon': t('vehicle.type_wagon'), 'Convertible': t('vehicle.type_convertible'),
  };

  useEffect(() => {
    if (!user?.id) return;
    const fetchActivity = async () => {
      try {
        const items: { id: string; icon: string; actionKey: string; address: string; reward: string | null; ts: number }[] = [];

        const spotsSnap = await getDocs(query(collection(db, 'spots'), where('finderId', '==', user.id)));
        const allSpots = spotsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        allSpots.forEach(s => {
          const ts = s.reportedAt?.toMillis?.() || 0;
          const addr = s.address || '';
          if (s.status === 'occupied') {
            items.push({ id: `f-${s.id}`, icon: 'handshake', actionKey: 'profile.activity_helped_driver', address: addr, reward: '+2', ts });
          } else if (s.pingMode === 'later') {
            items.push({ id: `f-${s.id}`, icon: 'clock', actionKey: 'profile.activity_scheduled', address: addr, reward: null, ts });
          } else {
            items.push({ id: `f-${s.id}`, icon: 'pin', actionKey: 'profile.activity_pinged', address: addr, reward: null, ts });
          }
        });

        const fbSnap = await getDocs(query(collection(db, 'spotFeedback'), where('userId', '==', user.id)));
        const allFeedback = fbSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        allFeedback.forEach(f => {
          const ts = f.createdAt?.toMillis?.() || 0;
          items.push({ id: `d-${f.id}`, icon: 'parking', actionKey: 'profile.activity_parked', address: f.address || '', reward: '+1', ts });
        });

        // Compute impact from all docs before slicing
        const counts = deriveImpactCounts(allSpots, allFeedback);
        setImpactCounts(counts);
        setImpactState('loaded');

        items.sort((a, b) => b.ts - a.ts);
        setRecentActivity(items.slice(0, 3));
      } catch {
        setImpactState('error');
      }
    };
    fetchActivity();
  }, [user?.id]);

  const activityIcon = (key: string) => {
    const map: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
      handshake: { icon: <Handshake size={13} />, bg: 'bg-yellow-400/15', color: 'text-yellow-400' },
      parking:   { icon: <ParkingSquare size={13} />, bg: 'bg-green-400/15', color: 'text-green-400' },
      pin:       { icon: <MapPin size={13} />, bg: 'bg-[#1e75ff]/15', color: 'text-[#38bdf8]' },
      clock:     { icon: <Clock size={13} />, bg: 'bg-orange-400/15', color: 'text-orange-400' },
    };
    const m = map[key] || map['pin'];
    return (
      <div className={`w-7 h-7 rounded-lg ${m.bg} ${m.color} flex items-center justify-center shrink-0`}>
        {m.icon}
      </div>
    );
  };

  const crowns = user?.crowns || 0;
  const tier = getTierForCrowns(crowns);
  const visual = TIER_VISUALS[tier];
  const next = getNextTitle(crowns);
  const pct = getProgressPct(crowns);

  const hasImpact = impactState === 'loaded' &&
    (impactCounts.pingsShared > 0 || impactCounts.successfulHandoffs > 0 || impactCounts.spotsFound > 0);

  return (
    <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4">
      {user ? (
        <div className="max-w-md mx-auto flex flex-col">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              aria-label={t('profile.back_aria')}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 active:scale-95 transition-all shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-bold text-[var(--color-text)] tracking-wide focus:outline-none"
            >
              {t('profile.title')}
            </h2>
            <button
              onClick={() => setView(AppView.SETTINGS)}
              aria-label={t('profile.settings_aria')}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[#38bdf8] hover:bg-white/10 active:scale-95 transition-all shrink-0"
            >
              <Settings size={20} />
            </button>
          </div>

          <div className="space-y-3">

            {/* ── Identity Card ──────────────────────────────────────── */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[22px] overflow-hidden">
              <div className="flex items-center gap-4 px-4 py-4">

                {/* Parsona avatar */}
                <div className="relative shrink-0">
                  <div className="rounded-full border-[3px] border-[#1e75ff] shadow-lg shadow-[#1e75ff]/20 overflow-hidden">
                    <AvatarComposite avatar={user?.avatar} userId={user?.id ?? ''} size={92} aria-label={t('parsona.title')} />
                  </div>
                  <button
                    onClick={() => setView(AppView.PARSONA_CREATOR)}
                    aria-label={t('parsona.edit')}
                    className="absolute -bottom-1 -right-1 w-10 h-10 flex items-end justify-end pb-0.5 pr-0.5"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#1e75ff] border-2 border-[var(--color-bg)] flex items-center justify-center text-white shadow-md active:scale-95 transition-transform pointer-events-none">
                      <Edit size={11} />
                    </div>
                  </button>
                </div>

                {/* Identity text */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[18px] font-extrabold text-[var(--color-text)] leading-tight truncate">
                    {user.username?.startsWith('user_') ? (user.fullName || t('profile.username_fallback')) : (user.username || user.fullName || t('profile.username_fallback'))}
                  </h3>

                  {user.username?.startsWith('user_') && (
                    <button
                      onClick={() => setView(AppView.EDIT_PROFILE)}
                      className="mt-1 px-2.5 py-0.5 rounded-full bg-[#1e75ff]/15 border border-[#1e75ff]/30 text-[#38bdf8] text-xs font-semibold active:scale-95 transition-transform"
                    >
                      {t('profile.complete_profile')}
                    </button>
                  )}

                  {(() => {
                    const ts = user.createdAt;
                    if (!ts) return null;
                    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
                    const locale = getLang() === 'es' ? 'es' : 'en-US';
                    return (
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {t('profile.joined', { date: d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }) })}
                      </p>
                    );
                  })()}

                </div>
              </div>
            </div>

            {/* ── Migration prompt: avatarUrl but no Parsona yet ──────── */}
            {user?.avatarUrl && !user?.avatar && !migrationDismissed && (
              <ParsonaMigrationPrompt
                onCreateParsona={() => setView(AppView.PARSONA_CREATOR)}
                onDismiss={() => {
                  localStorage.setItem(dismissKey, '1');
                  setMigrationDismissed(true);
                }}
              />
            )}

            {/* ── Community Progress Card ────────────────────────────── */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[22px] overflow-hidden">
              <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
                <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">{t('profile.section_progress')}</p>
              </div>
              <div className="px-4 py-4 flex flex-col items-center text-center">

                {/* Rank title */}
                <p className="text-sm font-bold leading-tight" style={{ color: visual.textColor }}>
                  {user.title || t('profile.newcomer')}
                </p>

                {/* Crown count + info */}
                <div className="flex items-center gap-1.5 mt-2">
                  <Crown size={14} className="text-yellow-400 shrink-0" aria-hidden="true" />
                  <span className="text-[13px] font-bold text-[var(--color-text)]">
                    {crowns !== 1 ? t('profile.crowns_plural', { count: crowns }) : t('profile.crowns_singular', { count: crowns })}
                  </span>
                  <button
                    onClick={() => setShowCrownsInfo(true)}
                    aria-label={t('profile.crowns_what_are')}
                    className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors active:scale-90 p-1"
                  >
                    <Info size={13} />
                  </button>
                </div>

                {/* Progress bar */}
                {next ? (
                  <div className="w-full mt-3">
                    <div
                      role="progressbar"
                      aria-valuenow={Math.round(pct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${crowns} ${crowns !== 1 ? t('profile.crowns_plural', { count: crowns }) : t('profile.crowns_singular', { count: crowns })} — ${next.crownsNeeded} ${t('profile.crowns_until_next')} ${next.title}`}
                      className="w-full max-w-[260px] mx-auto h-1.5 bg-white/10 rounded-full overflow-hidden"
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none"
                        style={{ width: `${Math.min(pct, 100)}%`, background: 'linear-gradient(90deg, #1e75ff, #38bdf8)' }}
                      />
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">
                      <span className="font-semibold text-[var(--color-text)]">{next.crownsNeeded}</span>{' '}
                      {t('profile.crowns_until_next')}{' '}
                      <span className="font-semibold" style={{ color: TIER_VISUALS[next.tier].textColor }}>{next.title}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-xs font-bold text-[#38bdf8] mt-2">{t('profile.max_rank')}</p>
                )}
              </div>
            </div>

            {/* ── Impact Card (only after load, only if nonzero) ─────── */}
            {hasImpact && (
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[22px] overflow-hidden">
                <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
                  <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">{t('profile.section_impact')}</p>
                </div>
                <div className="px-4 py-4 grid grid-cols-3 gap-3">
                  <div className="flex flex-col items-center text-center">
                    <span className="text-[22px] font-extrabold text-[var(--color-text)] leading-none">{impactCounts.pingsShared}</span>
                    <span className="text-[10px] text-[var(--color-text-secondary)] mt-1 leading-snug">{t('profile.pings_shared')}</span>
                  </div>
                  <div className="flex flex-col items-center text-center border-x border-[var(--color-border)]">
                    <span className="text-[22px] font-extrabold text-[var(--color-text)] leading-none">{impactCounts.successfulHandoffs}</span>
                    <span className="text-[10px] text-[var(--color-text-secondary)] mt-1 leading-snug">{t('profile.successful_handoffs')}</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <span className="text-[22px] font-extrabold text-[var(--color-text)] leading-none">{impactCounts.spotsFound}</span>
                    <span className="text-[10px] text-[var(--color-text-secondary)] mt-1 leading-snug">{t('profile.spots_found')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Vehicle Card ───────────────────────────────────────── */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[20px] overflow-hidden">
              <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
                <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">{t('profile.section_vehicle')}</p>
              </div>
              <button
                onClick={() => setView(AppView.EDIT_VEHICLE)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0 flex items-center justify-center w-9">
                    <VehicleIcon type={user.vehicleType} color={user.vehicleColor} size={26} />
                  </div>
                  <div>
                    {user.vehicleBrand || user.vehicleColor || user.vehicleType ? (
                      <p className="text-sm font-semibold text-[var(--color-text)] text-left">
                        {[colorLabels[user.vehicleColor] ?? user.vehicleColor, user.vehicleBrand].filter(Boolean).join(' ')}
                        {user.vehicleType ? (
                          <span className="text-[var(--color-text-secondary)] font-normal"> · {typeLabels[user.vehicleType] ?? user.vehicleType}</span>
                        ) : null}
                      </p>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-[var(--color-text)]">{t('profile.no_vehicle')}</p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('profile.no_vehicle_hint')}</p>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-[var(--color-text-secondary)] shrink-0" aria-hidden="true" />
              </button>
            </div>

            {/* Incomplete vehicle banner */}
            {(user.vehicleType || user.vehicleBrand) && !user.vehicleColor && (
              <button
                onClick={() => setView(AppView.EDIT_VEHICLE)}
                className="w-full flex items-center gap-2.5 px-4 py-3 rounded-[20px] bg-amber-500/10 border border-amber-500/25 text-amber-400 active:scale-[0.99] transition-all"
              >
                <span className="text-base leading-none" aria-hidden="true">⚠️</span>
                <span className="flex-1 text-left text-xs font-semibold">{t('vehicle.incomplete_banner')}</span>
                <ChevronRight size={13} className="shrink-0 opacity-70" aria-hidden="true" />
              </button>
            )}

            {/* ── Recent Activity Card ───────────────────────────────── */}
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[20px] overflow-hidden">
              <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
                <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">{t('profile.section_activity')}</p>
              </div>
              {recentActivity.length === 0 ? (
                <div className="px-4 py-4 text-center">
                  <p className="text-xs text-[var(--color-text-secondary)]">{t('profile.no_activity')}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 opacity-60">{t('profile.no_activity_hint')}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {recentActivity.map(item => (
                    <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                      {activityIcon(item.icon)}
                      <p className="flex-1 text-xs font-semibold text-[var(--color-text)] truncate">
                        {t(item.actionKey)}
                        {item.address ? <span className="text-[var(--color-text-secondary)] font-normal"> · {item.address}</span> : null}
                        <span className="text-[var(--color-text-secondary)] font-normal"> · {fmt(item.ts)}</span>
                      </p>
                      {item.reward && (
                        <div className="flex items-center gap-0.5 shrink-0" aria-label={`${item.reward} Crowns`}>
                          <span className="text-xs font-bold text-yellow-400">{item.reward}</span>
                          <Crown size={11} className="text-yellow-400" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setView(AppView.PARKING_SPACE)}
                className="w-full py-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#38bdf8] border-t border-[var(--color-border)] hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                {t('profile.view_all_activity')}
                <ChevronRight size={13} aria-hidden="true" />
              </button>
            </div>

          </div>
        </div>
      ) : (
        <div className="text-center py-10">{t('profile.not_logged_in')}</div>
      )}

      {/* Crowns info modal */}
      {showCrownsInfo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="crowns-modal-title"
          className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCrownsInfo(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-5 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <Crown size={18} className="text-yellow-400 shrink-0" aria-hidden="true" />
              <h3 id="crowns-modal-title" className="text-base font-extrabold text-[var(--color-text)]">
                {t('profile.crowns_modal_title')}
              </h3>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{t('profile.crowns_modal_body1')}</p>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{t('profile.crowns_modal_body2')}</p>
            <button
              onClick={() => setShowCrownsInfo(false)}
              className="w-full py-3 rounded-xl bg-white/8 border border-[var(--color-border)] text-sm font-bold text-[var(--color-text)] hover:bg-white/12 active:scale-[0.98] transition-all"
            >
              {t('profile.crowns_modal_dismiss')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
