import React, { useState, useEffect } from 'react';
import { MapPin, Zap, Clock, Check, ChevronLeft, Users } from 'lucide-react';
import { StreetSpot } from '../../types';
import { TimePicker } from './TimePicker';
import { BottomSheet } from './BottomSheet';
import { localDateStr, combineDateAndTime } from './dateUtils';

interface SpotModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (departure: Date | null) => void;
    spot?: StreetSpot | null;
    spotAddress?: string;
    user?: any;
}

export const SpotModal: React.FC<SpotModalProps> = ({ isOpen, onClose, onSave, spot, spotAddress, user }) => {
    const [view, setView] = useState<'main' | 'timePicker'>('main');
    const [departureTime, setDepartureTime] = useState(new Date());
    const [selectedDateStr, setSelectedDateStr] = useState(() => localDateStr());
    const [pingType, setPingType] = useState<'now' | 'later'>('now');
    const [timeError, setTimeError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const hasToDate = spot && spot.reportedAt && typeof spot.reportedAt.toDate === 'function';
            const initialDate = hasToDate
                ? spot.reportedAt.toDate()
                : (spot && spot.reportedAt ? new Date(spot.reportedAt) : new Date(Date.now() + 2 * 60_000));
            setDepartureTime(initialDate);
            setSelectedDateStr(localDateStr());
            setPingType('now');
            setView('main');
            setTimeError(null);
        }
    }, [spot, isOpen]);

    const handleSetTime = () => {
        if (pingType === 'later') {
            const combined = combineDateAndTime(selectedDateStr, departureTime);
            if (combined.getTime() <= Date.now()) {
                setTimeError('Please choose a future time.');
                return;
            }
            onSave(combined);
            return;
        }
        onSave(null);
    };

    const isEditing = !!spot;

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose}>
            {view === 'main' ? (
                <div>
                    <div className="flex flex-col items-center text-center mb-6">
                        <img src="/Parqueen_Logo.png" alt="ParkQueen" className="w-16 h-16 object-contain mb-3 drop-shadow-lg" />
                        <h2 className="text-lg font-bold text-[var(--color-text)] leading-snug">
                            {isEditing ? 'Edit spot' : 'When are you leaving?'}
                        </h2>
                        <div className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl bg-[#1e75ff]/10 border border-[#1e75ff]/20 max-w-full">
                            <MapPin size={12} className="text-[#38bdf8] shrink-0" />
                            <p className="text-[12px] font-semibold text-[var(--color-text)] truncate">{spotAddress || 'Locating...'}</p>
                        </div>
                    </div>

                    {/* Reciprocity nudge — shown when user has claimed before and is creating a new ping */}
                    {!isEditing && (user?.claimCount ?? 0) > 0 && (
                        <div className="flex items-center gap-2.5 mb-5 px-3.5 py-3 rounded-2xl bg-[#1e75ff]/10 border border-[#1e75ff]/20">
                            <Users size={15} className="text-[#38bdf8] shrink-0" />
                            <p className="text-xs font-semibold text-[#38bdf8]">
                                You've claimed {user.claimCount} spot{user.claimCount !== 1 ? 's' : ''} — thanks for giving back!
                            </p>
                        </div>
                    )}

                    <div className="space-y-3">
                        <button
                            onClick={() => setPingType('now')}
                            className={`w-full rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
                                pingType === 'now'
                                    ? 'bg-blue-500/15 border border-blue-400/40 shadow-md'
                                    : 'bg-[var(--color-card)] border border-[var(--color-border)] hover:bg-white/8'
                            }`}
                        >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                pingType === 'now' ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--color-overlay)] text-[var(--color-text-secondary)]'
                            }`}>
                                <Zap size={18} />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-sm font-bold text-[var(--color-text)]">Leaving Now</div>
                                <div className="text-[11px] text-[var(--color-text-secondary)]">Spot opens immediately</div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                pingType === 'now' ? 'border-blue-400 bg-blue-500' : 'border-[var(--color-border)]'
                            }`}>
                                {pingType === 'now' && <Check size={12} className="text-white" />}
                            </div>
                        </button>

                        <button
                            onClick={() => { setPingType('later'); setView('timePicker'); }}
                            className={`w-full rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
                                pingType === 'later'
                                    ? 'bg-blue-500/15 border border-blue-400/40 shadow-md'
                                    : 'bg-[var(--color-card)] border border-[var(--color-border)] hover:bg-white/8'
                            }`}
                        >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                pingType === 'later' ? 'bg-blue-500/20 text-blue-400' : 'bg-[var(--color-overlay)] text-[var(--color-text-secondary)]'
                            }`}>
                                <Clock size={18} />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="text-sm font-bold text-[var(--color-text)]">Leaving Later</div>
                                <div className="text-[11px] text-[var(--color-text-secondary)]">
                                    {pingType === 'later'
                                        ? (() => {
                                            const combined = combineDateAndTime(selectedDateStr, departureTime);
                                            const isToday = combined.toDateString() === new Date().toDateString();
                                            const time = combined.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            return isToday ? time : combined.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + time;
                                        })()
                                        : 'Set a specific time'}
                                </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                pingType === 'later' ? 'border-blue-400 bg-blue-500' : 'border-[var(--color-border)]'
                            }`}>
                                {pingType === 'later' && <Check size={12} className="text-white" />}
                            </div>
                        </button>
                    </div>

                    {timeError && (
                        <p className="mt-4 text-sm text-red-400 font-semibold text-center">{timeError}</p>
                    )}
                    <button
                        onClick={handleSetTime}
                        className="w-full mt-4 font-bold py-3.5 rounded-full flex items-center justify-center gap-2 text-white active:scale-95 transition-transform"
                        style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}
                    >
                        <MapPin size={18} />
                        <span>{isEditing ? 'Update Spot' : 'Share Spot'}</span>
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex flex-col items-center text-center mb-6 pt-4">
                        <div className="w-11 h-11 rounded-full bg-blue-500/15 border border-blue-400/30 flex items-center justify-center mb-1.5">
                            <Clock size={20} className="text-blue-400" />
                        </div>
                        <h2 className="text-lg font-bold text-[var(--color-text)]">Set departure time</h2>
                    </div>
                    <div className="mb-4">
                        <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">Date</p>
                        <input
                            type="date"
                            value={selectedDateStr}
                            min={localDateStr()}
                            onChange={e => { if (e.target.value) setSelectedDateStr(e.target.value); }}
                            className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl px-4 py-3 text-sm font-semibold text-white focus:outline-none"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                    <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">Time</p>
                    <div className="mb-6">
                        <TimePicker initialTime={departureTime} onTimeChange={setDepartureTime} />
                    </div>
                    {timeError && (
                        <p className="mb-3 text-sm text-red-400 font-semibold text-center">{timeError}</p>
                    )}
                    <button
                        onClick={() => {
                            const combined = combineDateAndTime(selectedDateStr, departureTime);
                            if (combined.getTime() <= Date.now()) {
                                setTimeError('Please choose a future time.');
                                return;
                            }
                            onSave(combined);
                        }}
                        className="w-full font-bold py-3.5 rounded-full flex items-center justify-center gap-2 text-white active:scale-95 transition-transform"
                        style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}
                    >
                        <MapPin size={18} />
                        {isEditing ? 'Update Spot' : 'Share Spot'}
                    </button>
                    <button
                        onClick={() => setView('main')}
                        className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-sm font-semibold transition-colors"
                    >
                        <ChevronLeft size={16} />
                        Back
                    </button>
                </>
            )}
        </BottomSheet>
    );
};
