import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Leaf, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  computeSafeUntil,
  StreetRuleDoc, SuspensionDoc, SafeUntilResult, CleaningSchedule,
} from '../../utils/streetIntelligence';

interface Props {
  segmentId: string;
  parkingSide: string;
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [rulesSnap, suspSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'streetSegments', segmentId, 'streetRules'),
            where('supersededAt', '==', null),
          )),
          getDocs(query(collection(db, 'suspensions'), orderBy('date', 'desc'))),
        ]);

        if (cancelled) return;

        const rules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StreetRuleDoc));
        const suspensions = suspSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as SuspensionDoc))
          .filter(s => s.status !== 'archived');
        const allSchedules: CleaningSchedule[] = rules.flatMap(r => r.schedules || []);

        setScheduleCount(allSchedules.length);
        const r = computeSafeUntil(allSchedules, parkingSide, suspensions);
        setResult(r);
        onResult?.(r);
      } catch (e) {
        console.warn('StreetIntelligenceCard load error:', e);
        setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
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

  if (!result) return null;

  if (!result.scheduleDescription) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Leaf size={14} className="text-[var(--color-text-secondary)]" />
          <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
            {streetName} · {SIDE_LABELS[parkingSide] ?? parkingSide}
          </p>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">No cleaning schedule on file for this side yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4">
      {/* Street + side header */}
      <div className="flex items-center gap-2 mb-3">
        <Leaf size={14} className="text-[var(--color-text-secondary)]" />
        <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
          {streetName} · {SIDE_LABELS[parkingSide] ?? parkingSide}
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
        <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
          ParQueen Verified
        </span>
      </div>
    </div>
  );
};
