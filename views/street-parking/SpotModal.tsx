import React, { useState, useEffect } from 'react';
import { MapPin, Zap, Clock, X, Check } from 'lucide-react';
import { StreetSpot } from '../../types';
import { TimePicker } from './TimePicker';

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
            setPingType(initialDate.getTime() > Date.now() + 60_000 ? 'later' : 'now');
            setView('main');
        }
    }, [spot, isOpen]);

    const handleSetTime = () => {
        onSave(pingType === 'now' ? null : departureTime);
    };

    if (!isOpen) return null;

    const isEditing = !!spot;

    return (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[var(--color-glass)] backdrop-blur-xl rounded-3xl p-6 w-full max-w-sm text-[var(--color-text)] border border-[var(--color-border)] shadow-2xl">
                <div className="flex justify-end">
                    <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {view === 'main' ? (
                    <>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-[34px] h-[34px] rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shrink-0">
                                <MapPin size={16} className="text-white" />
                            </div>
                            <h2 className="text-lg font-bold leading-snug">{isEditing ? 'Edit spot' : 'When are you leaving?'}</h2>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] ml-[46px] mb-6">{spotAddress || 'Locating...'}</p>

                        <div className="space-y-3">
                            <button
                                onClick={() => setPingType('now')}
                                className={`w-full rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
                                    pingType === 'now'
                                        ? 'bg-blue-500/15 border border-blue-400/40'
                                        : 'bg-white/5 border border-[var(--color-border)] hover:bg-white/8'
                                }`}
                            >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                    pingType === 'now' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-[var(--color-text-secondary)]'
                                }`}>
                                    <Zap size={18} />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-sm font-bold">Leaving Now</div>
                                    <div className="text-[11px] text-[var(--color-text-secondary)]">Spot opens immediately</div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    pingType === 'now' ? 'border-blue-400 bg-blue-500' : 'border-white/20'
                                }`}>
                                    {pingType === 'now' && <Check size={12} className="text-white" />}
                                </div>
                            </button>

                            <button
                                onClick={() => { setPingType('later'); setView('timePicker'); }}
                                className={`w-full rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
                                    pingType === 'later'
                                        ? 'bg-blue-500/15 border border-blue-400/40'
                                        : 'bg-white/5 border border-[var(--color-border)] hover:bg-white/8'
                                }`}
                            >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                    pingType === 'later' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-[var(--color-text-secondary)]'
                                }`}>
                                    <Clock size={18} />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-sm font-bold">Leaving Later</div>
                                    <div className="text-[11px] text-[var(--color-text-secondary)]">
                                        {pingType === 'later'
                                            ? departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                            : 'Set a specific time'}
                                    </div>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    pingType === 'later' ? 'border-blue-400 bg-blue-500' : 'border-white/20'
                                }`}>
                                    {pingType === 'later' && <Check size={12} className="text-white" />}
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={handleSetTime}
                            className="w-full mt-6 font-bold py-3 rounded-full flex items-center justify-center gap-2 text-white active:scale-95 transition-transform"
                            style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}
                        >
                            <MapPin size={18} />
                            <span>{isEditing ? 'Confirm' : 'Ping'}</span>
                        </button>
                    </>
                ) : (
                    <>
                        <div className="text-center mb-6">
                            <Clock size={24} className="mx-auto text-blue-400 mb-2" />
                            <h2 className="text-lg font-bold">Set departure time</h2>
                        </div>
                        <div className="mb-6">
                            <TimePicker initialTime={departureTime} onTimeChange={setDepartureTime} />
                        </div>
                        <button
                            onClick={() => { setPingType('later'); setView('main'); }}
                            className="w-full font-bold py-3 rounded-full text-white active:scale-95 transition-transform"
                            style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}
                        >
                            Set Time
                        </button>
                        <button onClick={() => setView('main')} className="w-full text-center mt-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-sm transition-colors">
                            Cancel
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
