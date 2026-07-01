import React, { useState, useEffect } from 'react';
import { MapPin, Zap, Clock, Check, X, ChevronLeft } from 'lucide-react';
import { StreetSpot } from '../../types';
import { TimePicker } from './TimePicker';
import { BottomSheet } from './BottomSheet';

interface SpotModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (departure: Date | null) => void;
    spot?: StreetSpot | null;
    spotAddress?: string;
}

export const SpotModal: React.FC<SpotModalProps> = ({ isOpen, onClose, onSave, spot, spotAddress }) => {
    const [view, setView] = useState<'main' | 'timePicker'>('main');
    const [departureTime, setDepartureTime] = useState(new Date());
    const [pingType, setPingType] = useState<'now' | 'later'>('now');

    useEffect(() => {
        if (isOpen) {
            const hasToDate = spot && spot.reportedAt && typeof spot.reportedAt.toDate === 'function';
            const initialDate = hasToDate
                ? spot.reportedAt.toDate()
                : (spot && spot.reportedAt ? new Date(spot.reportedAt) : new Date(Date.now() + 2 * 60_000));
            setDepartureTime(initialDate);
            setPingType('now');
            setView('main');
        }
    }, [spot, isOpen]);

    const handleSetTime = () => {
        if (pingType === 'later' && departureTime.getTime() <= Date.now()) {
            alert('Please select a future time.');
            return;
        }
        onSave(pingType === 'now' ? null : departureTime);
    };

    const isEditing = !!spot;

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose}>
            {view === 'main' ? (
                <div className="relative">
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/10 transition-colors z-10"
                    >
                        <X size={16} />
                    </button>

                    <div className="flex flex-col items-center text-center mb-6">
                        <img src="/Parqueen_Logo.png" alt="ParkQueen" className="w-12 h-12 object-contain mb-3 drop-shadow-lg" />
                        <h2 className="text-lg font-bold text-[var(--color-text)] leading-snug">
                            {isEditing ? 'Edit spot' : 'When are you leaving?'}
                        </h2>
                        <div className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-xl bg-[#1e75ff]/10 border border-[#1e75ff]/20 max-w-full">
                            <MapPin size={12} className="text-[#38bdf8] shrink-0" />
                            <p className="text-[12px] font-semibold text-[var(--color-text)] truncate">{spotAddress || 'Locating...'}</p>
                        </div>
                    </div>

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
                                        ? departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

                    <button
                        onClick={handleSetTime}
                        className="w-full mt-6 font-bold py-3.5 rounded-full flex items-center justify-center gap-2 text-white active:scale-95 transition-transform"
                        style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}
                    >
                        <MapPin size={18} />
                        <span>{isEditing ? 'Confirm' : 'Ping'}</span>
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex items-center mb-6">
                        <button
                            onClick={() => setView('main')}
                            aria-label="Back"
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/10 transition-colors shrink-0"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div className="flex-1 flex flex-col items-center text-center -ml-8">
                            <Clock size={22} className="text-blue-400 mb-1" />
                            <h2 className="text-base font-bold text-[var(--color-text)]">Set departure time</h2>
                        </div>
                    </div>
                    <div className="mb-6">
                        <TimePicker initialTime={departureTime} onTimeChange={setDepartureTime} />
                    </div>
                    <button
                        onClick={() => { setPingType('later'); setView('main'); }}
                        className="w-full font-bold py-3.5 rounded-full text-white active:scale-95 transition-transform"
                        style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}
                    >
                        Set Time
                    </button>
                </>
            )}
        </BottomSheet>
    );
};
