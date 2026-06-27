import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Zap, Clock, Check } from 'lucide-react';
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
    const [visible, setVisible] = useState(false);
    const dragStartY = useRef<number | null>(null);
    const [dragOffset, setDragOffset] = useState(0);
    const sheetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            const hasToDate = spot && spot.reportedAt && typeof spot.reportedAt.toDate === 'function';
            const initialDate = hasToDate
                ? spot.reportedAt.toDate()
                : (spot && spot.reportedAt ? new Date(spot.reportedAt) : new Date(Date.now() + 2 * 60_000));
            setDepartureTime(initialDate);
            setPingType('now');
            setView('main');
            requestAnimationFrame(() => setVisible(true));
        } else {
            setVisible(false);
        }
    }, [spot, isOpen]);

    const dismiss = () => {
        setVisible(false);
        setTimeout(onClose, 300);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (dragStartY.current === null) return;
        const dy = e.touches[0].clientY - dragStartY.current;
        setDragOffset(Math.max(0, dy));
    };

    const handleTouchEnd = () => {
        if (dragOffset > 80) {
            dismiss();
        }
        setDragOffset(0);
        dragStartY.current = null;
    };

    const handleSetTime = () => {
        if (pingType === 'later' && departureTime.getTime() <= Date.now()) {
            alert('Please select a future time.');
            return;
        }
        onSave(pingType === 'now' ? null : departureTime);
    };

    if (!isOpen) return null;

    const isEditing = !!spot;

    return (
        <div className="absolute inset-0 z-30">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
                onClick={dismiss}
            />

            {/* Sheet */}
            <div
                ref={sheetRef}
                className="absolute bottom-0 left-0 right-0 bg-[var(--color-surface)] rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out max-h-[85vh] overflow-y-auto"
                style={{ transform: visible ? `translateY(${dragOffset}px)` : 'translateY(100%)' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
                </div>

                <div className="px-6 pb-8">
                    {view === 'main' ? (
                        <>
                            {/* Centered stacked header */}
                            <div className="flex flex-col items-center text-center mb-6">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center mb-3">
                                    <MapPin size={18} className="text-white" />
                                </div>
                                <h2 className="text-lg font-bold text-[var(--color-text)] leading-snug">
                                    {isEditing ? 'Edit spot' : 'When are you leaving?'}
                                </h2>
                                <p className="text-[12px] text-[var(--color-text-secondary)] mt-1">{spotAddress || 'Locating...'}</p>
                            </div>

                            {/* Options */}
                            <div className="space-y-3">
                                <button
                                    onClick={() => setPingType('now')}
                                    className={`w-full rounded-2xl p-3.5 flex items-center gap-3 transition-all ${
                                        pingType === 'now'
                                            ? 'bg-blue-500/15 border border-blue-400/40'
                                            : 'bg-[var(--color-overlay)] border border-[var(--color-border)] hover:bg-white/8'
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
                                            ? 'bg-blue-500/15 border border-blue-400/40'
                                            : 'bg-[var(--color-overlay)] border border-[var(--color-border)] hover:bg-white/8'
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
                                style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}
                            >
                                <MapPin size={18} />
                                <span>{isEditing ? 'Confirm' : 'Ping'}</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="flex flex-col items-center text-center mb-6">
                                <Clock size={28} className="text-blue-400 mb-2" />
                                <h2 className="text-lg font-bold text-[var(--color-text)]">Set departure time</h2>
                            </div>
                            <div className="mb-6">
                                <TimePicker initialTime={departureTime} onTimeChange={setDepartureTime} />
                            </div>
                            <button
                                onClick={() => { setPingType('later'); setView('main'); }}
                                className="w-full font-bold py-3.5 rounded-full text-white active:scale-95 transition-transform"
                                style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}
                            >
                                Set Time
                            </button>
                            <button onClick={() => setView('main')} className="w-full text-center mt-3 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-sm transition-colors">
                                Cancel
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
