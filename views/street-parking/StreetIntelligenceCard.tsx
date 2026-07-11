import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, getDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { Leaf, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  computeSafeUntil,
  StreetRuleDoc, SuspensionDoc, SafeUntilResult, CleaningSchedule,
} from '../../utils/streetIntelligence';

interface Props {
  segmentId: string;
  parkingSide: string | null;
  streetName: string;
  onResult?: (result: SafeUntilResult | null) => void;
}

const fmtSafeUntil = (d: Date) => {
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} at ${time}`;
};

const SIDE_LABELS: Record<string, string> = {
  even: 'Even-address side',
  odd: 'Odd-address side',
  North: 'North side', South: 'South side',
  East: 'East side', West: 'West side',
};

export const StreetIntelligenceCard = ({ segmentId, parkingSide, streetName, onResult }: Props) => {
  const [result, setResult] = useState<SafeUntilResult | null>(null);
  const [scheduleCount, setScheduleCount] = useState(0);
  const [sideUnknown, setSideUnknown] = useState(false);
  const [displaySchedules, setDisplaySchedules] = useState<CleaningSchedule[]>([]);
  const [needsReview, setNeedsReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [debugLines, setDebugLines] = useState<string[]>([]);

  const isDebugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debugStreet');
  const cdbg = (msg: string) => {
    if (!isDebugMode) return;
    console.log('[StreetIntelCardDebug]', msg);
    setDebugLines(prev => [...prev, `${new Date().toLocaleTimeString()} ${msg}`]);
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      cdbg(`load — segmentId:${segmentId} parkingSide:${parkingSide} streetName:${streetName}`);
      try {
        const [segSnap, rulesSnap, suspSnap] = await Promise.all([
          getDoc(doc(db, 'streetSegments', segmentId)),
          getDocs(query(
            collection(db, 'streetSegments', segmentId, 'streetRules'),
            where('supersededAt', '==', null),
          )),
          getDocs(query(collection(db, 'suspensions'), orderBy('date', 'desc'))),
        ]);
        const segStatus = segSnap.exists() ? (segSnap.data().status ?? 'active') : 'active';
        cdbg(`segment status: ${segStatus}`);
        setNeedsReview(segStatus === 'needs_review');

        if (cancelled) return;

        const rules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StreetRuleDoc));
        cdbg(`streetRules docs: ${rules.length} | ids: ${rules.map(r => r.id).join(', ')}`);

        const suspensions = suspSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as SuspensionDoc))
          .filter(s => s.status !== 'archived');
        const allSchedules: CleaningSchedule[] = rules.flatMap(r => r.schedules || []);

        cdbg(`total schedules: ${allSchedules.length}`);
        allSchedules.forEach((s, i) =>
          cdbg(`  schedule[${i}]: side="${s.side}" days=${JSON.stringify(s.days)} start=${s.startTime} end=${s.endTime}`)
        );

        setScheduleCount(allSchedules.length);
        setDisplaySchedules(allSchedules);

        if (!parkingSide) {
          // Side not known — show "rules found, side unconfirmed" if any rules exist
          cdbg(`UI branch: side-unknown (schedules=${allSchedules.length})`);
          setSideUnknown(allSchedules.length > 0);
          onResult?.(null);
          return;
        }

        cdbg(`computeSafeUntil input: parkingSide="${parkingSide}" scheduleCount=${allSchedules.length} suspensionCount=${suspensions.length}`);
        const r = computeSafeUntil(allSchedules, parkingSide, suspensions);
        cdbg(`computeSafeUntil result: activeNow=${r.activeNow} safeUntil=${r.safeUntil?.toISOString() ?? 'null'} nextDay=${r.nextDay ?? 'null'} nextTime=${r.nextTime ?? 'null'} scheduleDescription=${r.scheduleDescription ?? 'null'}`);

        const branch = r.scheduleDescription === null ? 'no-schedule'
          : r.activeNow ? 'active-now'
          : r.nextDay ? 'safe-until'
          : 'no-upcoming';
        cdbg(`UI branch: ${branch}`);

        setResult(r);
        onResult?.(r);
      } catch (e) {
        cdbg(`load error: ${(e as any)?.message ?? String(e)}`);
        console.warn('StreetIntelligenceCard load error:', e);
        setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentId, parkingSide]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4 animate-pulse">
        <div className="h-3 w-24 bg-white/10 rounded mb-2" />
        <div className="h-6 w-40 bg-white/10 rounded" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4">
        <p className="text-sm text-[var(--color-text-secondary)]">Couldn't load street cleaning info — check back shortly.</p>
      </div>
    );
  }

  if (sideUnknown) {
    const sideUnknownDebugBlock = isDebugMode && debugLines.length > 0 ? (
      <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.85)', borderRadius: 8, border: '1px solid #1e75ff55' }}>
        <p style={{ color: '#1e75ff', fontWeight: 700, fontSize: 10, margin: '0 0 4px', fontFamily: 'monospace' }}>StreetIntelCardDebug</p>
        {debugLines.map((l, i) => {
          const isWarn = l.includes('null') || l.includes('no-schedule') || l.includes('error');
          return <p key={i} style={{ margin: '1px 0', fontSize: 10, color: isWarn ? '#f87171' : '#a3e635', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{l}</p>;
        })}
      </div>
    ) : null;
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
          <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
            Street cleaning found
          </p>
        </div>
        <p className="text-sm text-white font-semibold mb-1">
          We found cleaning rules for this street, but couldn't confirm which side you parked on.
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Check the street signs before leaving your car.
        </p>
        {sideUnknownDebugBlock}
      </div>
    );
  }

  if (!result) return null;

  const debugBlock = isDebugMode && debugLines.length > 0 ? (
    <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(0,0,0,0.85)', borderRadius: 8, border: '1px solid #1e75ff55' }}>
      <p style={{ color: '#1e75ff', fontWeight: 700, fontSize: 10, margin: '0 0 4px', fontFamily: 'monospace' }}>StreetIntelCardDebug</p>
      {debugLines.map((l, i) => {
        const isWarn = l.includes('null') || l.includes('no-schedule') || l.includes('error');
        return <p key={i} style={{ margin: '1px 0', fontSize: 10, color: isWarn ? '#f87171' : '#a3e635', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{l}</p>;
      })}
    </div>
  ) : null;

  if (!result.scheduleDescription) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Leaf size={14} className="text-[var(--color-text-secondary)]" />
          <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
            {streetName}{parkingSide ? ` · ${SIDE_LABELS[parkingSide] ?? parkingSide}` : ''}
          </p>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">No cleaning schedule on file for this side yet.</p>
        {debugBlock}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4">
      {/* Street + side header */}
      <div className="flex items-center gap-2 mb-3">
        <Leaf size={14} className="text-[var(--color-text-secondary)]" />
        <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
          {streetName}{parkingSide ? ` · ${SIDE_LABELS[parkingSide] ?? parkingSide}` : ''}
        </p>
      </div>

      {/* Safe Until / Active Now */}
      {result.activeNow ? (
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={18} className="text-red-400 shrink-0" />
          <div>
            <p className="text-base font-extrabold text-red-400 leading-tight">Active Now</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Cleaning in progress — move your car immediately
            </p>
          </div>
        </div>
      ) : result.nextDay ? (
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={18} className="text-green-400 shrink-0" />
          <div>
            <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest leading-none mb-0.5">Safe Until</p>
            <p className="text-base font-extrabold text-white leading-tight">
              {result.safeUntil ? fmtSafeUntil(result.safeUntil) : `${result.nextDay} ${result.nextTime}`}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={18} className="text-green-400 shrink-0" />
          <p className="text-sm text-[var(--color-text-secondary)]">No upcoming cleaning found (14 days).</p>
        </div>
      )}

      {/* Schedule description */}
      <p className="text-xs text-[var(--color-text-secondary)] mb-3">
        Because: street cleaning {result.scheduleDescription}
      </p>

      {/* Schedule count + verified badge */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-white/5 border-white/10 text-[var(--color-text-secondary)]">
          {scheduleCount} cleaning schedule{scheduleCount !== 1 ? 's' : ''}
        </span>
        {needsReview ? (
          <span className="text-[10px] font-semibold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
            Needs review
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
            ParQueen Verified
          </span>
        )}
      </div>
      {needsReview && (
        <p className="text-xs text-yellow-400/80 mt-2">
          We found a schedule, but this street still needs verification. Check posted signs.
        </p>
      )}
      {debugBlock}
    </div>
  );
};
