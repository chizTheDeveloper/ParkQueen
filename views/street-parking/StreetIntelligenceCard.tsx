import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Leaf, Clock, AlertTriangle, CheckCircle, Layers } from 'lucide-react';
import {
  computeSafeUntil, getBlockComplexity,
  StreetRuleDoc, SuspensionDoc, SafeUntilResult, CleaningSchedule,
} from '../../utils/streetIntelligence';

interface Props {
  segmentId: string;
  parkingSide: 'N' | 'S' | 'E' | 'W';
  streetName: string;
}

const SIDE_LABELS: Record<string, string> = {
  N: 'North Side', S: 'South Side', E: 'East Side', W: 'West Side',
};

const COMPLEXITY_CONFIG = {
  simple: { label: 'Easy Block', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  moderate: { label: 'Moderate Block', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  complex: { label: 'Complex Block', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

export const StreetIntelligenceCard = ({ segmentId, parkingSide, streetName }: Props) => {
  const [result, setResult] = useState<SafeUntilResult | null>(null);
  const [ruleCount, setRuleCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
        const suspensions = suspSnap.docs.map(d => ({ id: d.id, ...d.data() } as SuspensionDoc));

        // Flatten all schedules from active rules
        const allSchedules: CleaningSchedule[] = rules.flatMap(r => r.schedules || []);

        setRuleCount(rules.length);
        setResult(computeSafeUntil(allSchedules, parkingSide, suspensions));
      } catch (e) {
        console.warn('StreetIntelligenceCard load error:', e);
        setResult(null);
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

  if (!result) return null;

  const complexity = getBlockComplexity(ruleCount);
  const cx = COMPLEXITY_CONFIG[complexity];

  // No cleaning rules for this side
  if (!result.scheduleDescription) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Leaf size={14} className="text-[var(--color-text-secondary)]" />
          <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
            {streetName} · {SIDE_LABELS[parkingSide]}
          </p>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">No street cleaning on record for this side.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4">
      {/* Street + side header */}
      <div className="flex items-center gap-2 mb-3">
        <Leaf size={14} className="text-[var(--color-text-secondary)]" />
        <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
          {streetName} · {SIDE_LABELS[parkingSide]}
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
            <p className="text-base font-extrabold text-white leading-tight">{result.nextDay} {result.nextTime}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={18} className="text-green-400 shrink-0" />
          <p className="text-sm text-[var(--color-text-secondary)]">No upcoming cleaning found (14 days).</p>
        </div>
      )}

      {/* Because: explanation */}
      <p className="text-xs text-[var(--color-text-secondary)] mb-3">
        Because: street cleaning {result.scheduleDescription}
      </p>

      {/* Block complexity + confidence */}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cx.bg} ${cx.color}`}>
          {cx.label}
        </span>
        <span className="text-[10px] font-semibold text-[var(--color-text-secondary)] bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
          ParQueen Verified
        </span>
      </div>
    </div>
  );
};
