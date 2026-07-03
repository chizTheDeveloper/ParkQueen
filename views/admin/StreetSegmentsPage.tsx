import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  query, orderBy, Timestamp, where,
} from 'firebase/firestore';
import { MapPin, Plus, Trash2, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react';
import {
  geocodeIntersection, computeBearing, computeGeohash,
  CleaningSchedule, SegmentDoc, SuspensionDoc, StreetRuleDoc,
} from '../../utils/streetIntelligence';

const BOROUGHS = [
  { code: 'MN', label: 'Manhattan' },
  { code: 'BK', label: 'Brooklyn' },
  { code: 'QN', label: 'Queens' },
  { code: 'BX', label: 'Bronx' },
  { code: 'SI', label: 'Staten Island' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Add Segment Form ──────────────────────────────────────────────────────────

function AddSegmentForm({ onSaved }: { onSaved: () => void }) {
  const [streetName, setStreetName] = useState('');
  const [fromCross, setFromCross] = useState('');
  const [toCross, setToCross] = useState('');
  const [borough, setBorough] = useState('MN');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!streetName.trim() || !fromCross.trim() || !toCross.trim()) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const [fromCoord, toCoord] = await Promise.all([
        geocodeIntersection(streetName, fromCross, borough),
        geocodeIntersection(streetName, toCross, borough),
      ]);
      if (!fromCoord || !toCoord) {
        setError('Could not geocode one or both intersections. Check street names and try again.');
        setSaving(false);
        return;
      }
      const centerLat = (fromCoord.lat + toCoord.lat) / 2;
      const centerLng = (fromCoord.lng + toCoord.lng) / 2;
      const bearing = computeBearing(fromCoord, toCoord);
      const geohash = computeGeohash(centerLat, centerLng);

      await addDoc(collection(db, 'streetSegments'), {
        cityId: 'nyc',
        streetName: streetName.trim(),
        fromCross: fromCross.trim(),
        toCross: toCross.trim(),
        borough,
        fromLat: fromCoord.lat,
        fromLng: fromCoord.lng,
        toLat: toCoord.lat,
        toLng: toCoord.lng,
        centerLat,
        centerLng,
        bearing,
        geohash,
        cslSegmentId: null,
        confidence: {
          level: 'parqueen_verified',
          source: 'admin',
          lastVerifiedAt: Timestamp.now(),
          communityConfirmations: 0,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      setStreetName('');
      setFromCross('');
      setToCross('');
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Add Street Segment</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="col-span-2">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Street Name</label>
          <input
            value={streetName}
            onChange={e => setStreetName(e.target.value)}
            placeholder="Broadway"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">From Cross Street</label>
          <input
            value={fromCross}
            onChange={e => setFromCross(e.target.value)}
            placeholder="W 72 St"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">To Cross Street</label>
          <input
            value={toCross}
            onChange={e => setToCross(e.target.value)}
            placeholder="W 73 St"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Borough</label>
          <select
            value={borough}
            onChange={e => setBorough(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {BOROUGHS.map(b => <option key={b.code} value={b.code}>{b.label}</option>)}
          </select>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm mb-3">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Geocoding & saving…' : 'Add Segment'}
      </button>
    </div>
  );
}

// ── Cleaning Rule Form ────────────────────────────────────────────────────────

function AddRuleForm({ segmentId, onSaved }: { segmentId: string; onSaved: () => void }) {
  const [side, setSide] = useState('N');
  const [days, setDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('11:00');
  const [saving, setSaving] = useState(false);

  const toggleDay = (d: string) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleSave = async () => {
    if (!days.length) return;
    setSaving(true);
    const schedule: CleaningSchedule = { side, days, startTime, endTime };
    await addDoc(collection(db, 'streetSegments', segmentId, 'streetRules'), {
      type: 'streetCleaning',
      effectiveDate: Timestamp.now(),
      supersededAt: null,
      schedules: [schedule],
      source: 'admin',
      lastSourceSync: new Date().toISOString().slice(0, 10),
    });
    setDays([]);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Add Cleaning Rule</p>
      <div className="flex flex-wrap gap-3 mb-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Side</label>
          <select value={side} onChange={e => setSide(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-sm">
            {['N', 'S', 'E', 'W'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Start</label>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">End</label>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-sm" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {DAYS.map(d => (
          <button
            key={d}
            onClick={() => toggleDay(d)}
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${days.includes(d) ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            {d}
          </button>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving || !days.length}
        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : 'Save Rule'}
      </button>
    </div>
  );
}

// ── Segment Row ───────────────────────────────────────────────────────────────

function SegmentRow({ seg, onDeleted }: { seg: SegmentDoc; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [rules, setRules] = useState<StreetRuleDoc[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadRules = async () => {
    setLoadingRules(true);
    const snap = await getDocs(
      query(collection(db, 'streetSegments', seg.id, 'streetRules'), where('supersededAt', '==', null))
    );
    setRules(snap.docs.map(d => ({ id: d.id, ...d.data() } as StreetRuleDoc)));
    setLoadingRules(false);
  };

  const handleExpand = () => {
    if (!expanded) loadRules();
    setExpanded(e => !e);
  };

  const deleteRule = async (ruleId: string) => {
    await deleteDoc(doc(db, 'streetSegments', seg.id, 'streetRules', ruleId));
    loadRules();
  };

  const deleteSegment = async () => {
    if (!confirm(`Delete segment "${seg.streetName}" (${seg.fromCross}–${seg.toCross})?`)) return;
    setDeleting(true);
    await deleteDoc(doc(db, 'streetSegments', seg.id));
    onDeleted();
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-3 bg-white">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{seg.streetName}</p>
          <p className="text-xs text-gray-500">{seg.fromCross} → {seg.toCross} · {BOROUGHS.find(b => b.code === seg.borough)?.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">ParQueen Verified</span>
          <button onClick={handleExpand} className="p-1 text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={deleteSegment} disabled={deleting} className="p-1 text-red-400 hover:text-red-600 disabled:opacity-50">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-3 mb-2">Cleaning Rules</p>
          {loadingRules ? (
            <p className="text-xs text-gray-400">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="text-xs text-gray-400">No rules yet.</p>
          ) : (
            <div className="space-y-2">
              {rules.map(rule => (
                rule.schedules.map((sched, i) => (
                  <div key={`${rule.id}-${i}`} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200 text-xs">
                    <span className="font-semibold text-gray-700">Side {sched.side}</span>
                    <span className="text-gray-500">{sched.days.join(' & ')}</span>
                    <span className="text-gray-500">{sched.startTime}–{sched.endTime}</span>
                    <button onClick={() => deleteRule(rule.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              ))}
            </div>
          )}
          <AddRuleForm segmentId={seg.id} onSaved={loadRules} />
        </div>
      )}
    </div>
  );
}

// ── Suspensions Panel ─────────────────────────────────────────────────────────

function SuspensionsPanel() {
  const [suspensions, setSuspensions] = useState<SuspensionDoc[]>([]);
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<'holiday' | 'emergency'>('holiday');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const snap = await getDocs(query(collection(db, 'suspensions'), orderBy('date', 'desc')));
    setSuspensions(snap.docs.map(d => ({ id: d.id, ...d.data() } as SuspensionDoc)));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!date || !label) return;
    setSaving(true);
    await addDoc(collection(db, 'suspensions'), {
      cityId: 'nyc',
      date,
      type,
      label: label.trim(),
      affectsTypes: ['streetCleaning'],
      source: 'admin',
      createdAt: Timestamp.now(),
    });
    setDate('');
    setLabel('');
    setSaving(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'suspensions', id));
    load();
  };

  return (
    <div className="mt-8">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">ASP Suspensions</h3>
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Martin Luther King Jr. Day" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Type</label>
            <select value={type} onChange={e => setType(e.target.value as any)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="holiday">Holiday</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
        </div>
        <button onClick={handleAdd} disabled={saving || !date || !label} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Add Suspension'}
        </button>
      </div>
      <div className="space-y-2">
        {suspensions.map(s => (
          <div key={s.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">{s.label}</p>
              <p className="text-xs text-gray-500">{s.date} · {s.type}</p>
            </div>
            <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {!suspensions.length && <p className="text-sm text-gray-400">No suspensions on record.</p>}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export const StreetSegmentsPage = () => {
  const [segments, setSegments] = useState<SegmentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'segments' | 'suspensions'>('segments');

  const loadSegments = async () => {
    setLoading(true);
    const snap = await getDocs(query(collection(db, 'streetSegments'), orderBy('streetName')));
    setSegments(snap.docs.map(d => ({ id: d.id, ...d.data() } as SegmentDoc)));
    setLoading(false);
  };

  useEffect(() => { loadSegments(); }, []);

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Street Intelligence</h2>
        <p className="text-sm text-gray-500 mt-1">Manage street segments and parking rules for the ParQueen Street Intelligence system.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['segments', 'suspensions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'segments' && (
        <>
          <AddSegmentForm onSaved={loadSegments} />
          {loading ? (
            <p className="text-sm text-gray-400">Loading segments…</p>
          ) : segments.length === 0 ? (
            <p className="text-sm text-gray-400">No segments yet. Add one above.</p>
          ) : (
            <div>
              {segments.map(seg => (
                <SegmentRow key={seg.id} seg={seg} onDeleted={loadSegments} />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'suspensions' && <SuspensionsPanel />}
    </div>
  );
};
