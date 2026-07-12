import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Zap, Clock, Check, ChevronLeft, Calendar, ChevronRight } from 'lucide-react';
import { StreetSpot } from '../../types';
import { TimePicker } from './TimePicker';
import { BottomSheet } from './BottomSheet';
import { localDateStr, combineDateAndTime } from './dateUtils';
import { t, useLang } from '../../i18n';

interface SpotModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (departure: Date | null) => void;
    spot?: StreetSpot | null;
    spotAddress?: string;
    user?: any;
}

export const SpotModal: React.FC<SpotModalProps> = ({ isOpen, onClose, onSave, spot, spotAddress, user }) => {
    useLang();
    const [view, setView] = useState<'main' | 'timePicker'>('main');
    const [departureTime, setDepartureTime] = useState(new Date());
    const [selectedDateStr, setSelectedDateStr] = useState(() => localDateStr());
    const [pingType, setPingType] = useState<'now' | 'later'>('now');
    const [timeError, setTimeError] = useState<string | null>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);

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
    const scheduledDate = new Date(selectedDateStr + 'T12:00:00');
    const isScheduledToday = selectedDateStr === localDateStr();
    const scheduledDayLabel = isScheduledToday
        ? t('ping_modal.today')
        : scheduledDate.toLocaleDateString([], { weekday: 'long' });
    const scheduledDateFull = scheduledDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <BottomSheet isOpen={isOpen} onClose={onClose}>
            {view === 'main' ? (
                <div>
                    <div className="flex flex-col items-center text-center mb-6">
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-[#38bdf8] mb-1">{t('ping_modal.eyebrow')}</p>
                        <h2 className="text-lg font-bold text-[var(--color-text)] leading-snug">
                            {isEditing ? t('ping_modal.title_edit') : t('ping_modal.title_new')}
                        </h2>
                        <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">{t('ping_modal.subtitle')}</p>
                        <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-xl bg-[#1e75ff]/10 border border-[#1e75ff]/20 max-w-full">
                            <MapPin size={12} className="text-[#38bdf8] shrink-0" />
                            <p className="text-[12px] font-semibold text-[var(--color-text)] truncate">{spotAddress || t('ping_modal.locating')}</p>
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
                                <div className="text-sm font-bold text-[var(--color-text)]">{t('ping_modal.leaving_now')}</div>
                                <div className="text-[11px] text-[var(--color-text-secondary)]">{t('ping_modal.spot_opens')}</div>
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
                                <div className="text-sm font-bold text-[var(--color-text)]">{t('ping_modal.leaving_later')}</div>
                                <div className="text-[11px] text-[var(--color-text-secondary)]">
                                    {pingType === 'later'
                                        ? (() => {
                                            const combined = combineDateAndTime(selectedDateStr, departureTime);
                                            const isToday = combined.toDateString() === new Date().toDateString();
                                            const time = combined.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            return isToday ? time : combined.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + time;
                                        })()
                                        : t('ping_modal.set_time')}
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
                        <p className="mt-4 text-sm text-red-400 font-semibold text-center">{t('ping_modal.future_time_error')}</p>
                    )}
                    <button
                        onClick={handleSetTime}
                        className="w-full mt-4 font-bold py-3.5 rounded-full flex items-center justify-center gap-2 text-white active:scale-95 transition-transform"
                        style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}
                    >
                        <MapPin size={18} />
                        <span>{isEditing ? t('ping_modal.update') : pingType === 'later' ? t('ping_modal.schedule_ping') : t('ping_modal.ping_now')}</span>
                    </button>
                </div>
            ) : (
                <>
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6">
                        <button
                            onClick={() => setView('main')}
                            aria-label={t('ping_modal.back')}
                            className="w-9 h-9 rounded-full bg-[var(--color-card)] border border-[var(--color-border)] flex items-center justify-center shrink-0"
                        >
                            <ChevronLeft size={18} className="text-[var(--color-text-secondary)]" />
                        </button>
                        <div>
                            <p className="text-[10px] font-semibold tracking-widest uppercase text-[#38bdf8] mb-0.5">{t('ping_modal.schedule_eyebrow')}</p>
                            <p className="text-[16px] font-semibold text-[var(--color-text)] leading-tight">{t('ping_modal.schedule_title')}</p>
                            <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">{t('ping_modal.schedule_subtitle')}</p>
                        </div>
                    </div>

                    {/* Date */}
                    <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">{t('ping_modal.date')}</p>
                    <div className="mb-5">
                        <button
                            type="button"
                            onClick={() => {
                                const input = dateInputRef.current;
                                if (!input) return;
                                if (input.showPicker) { input.showPicker(); } else { input.click(); }
                            }}
                            className="w-full flex items-center gap-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl px-4 py-3.5 text-left"
                        >
                            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center shrink-0">
                                <Calendar size={15} className="text-[#38bdf8]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-[var(--color-text-secondary)]">{scheduledDayLabel}</p>
                                <p className="text-[14px] font-semibold text-[var(--color-text)] truncate">{scheduledDateFull}</p>
                            </div>
                            <ChevronRight size={16} className="text-[var(--color-text-secondary)] shrink-0" />
                        </button>
                        <input
                            ref={dateInputRef}
                            type="date"
                            aria-label="Departure date"
                            value={selectedDateStr}
                            min={localDateStr()}
                            onChange={e => { if (e.target.value) setSelectedDateStr(e.target.value); }}
                            className="absolute w-0 h-0 opacity-0 pointer-events-none"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>

                    {/* Time */}
                    <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">{t('ping_modal.time')}</p>
                    <div className="mb-5 rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] px-4 py-4">
                        <TimePicker initialTime={departureTime} onTimeChange={setDepartureTime} />
                    </div>

                    {/* Helper */}
                    <p className="text-[11px] text-[var(--color-text-secondary)] text-center mb-5 px-2 leading-relaxed">{t('ping_modal.schedule_helper')}</p>

                    {timeError && (
                        <p className="mb-3 text-sm text-red-400 font-semibold text-center">{t('ping_modal.future_time_error')}</p>
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
                        {isEditing ? t('ping_modal.update') : t('ping_modal.schedule_ping')}
                    </button>
                </>
            )}
        </BottomSheet>
    );
};
