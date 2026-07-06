import React, { useState, useEffect, useRef } from 'react';
import { Car, CheckCircle2, XCircle, Users, MapPin, Clock, HelpCircle, Crown, Bell } from 'lucide-react';

const FAILURE_REASONS = [
    { label: 'Someone else got it', icon: Users },
    { label: "Finder hadn't left yet", icon: Clock },
    { label: "Couldn't find the location", icon: MapPin },
    { label: 'Other', icon: HelpCircle },
];

const OPTIONS = [
    { label: '30 min', minutes: 30 },
    { label: '1 hr', minutes: 60 },
    { label: '2 hr', minutes: 120 },
    { label: '4 hr', minutes: 240 },
];

interface HandoffFlowProps {
    step: 'outcome' | 'celebration' | 'failure_reason';
    finderName?: string | null;
    onOutcome: (outcome: 'success' | 'failed') => void;
    onFailureReason: (reason: string) => void;
    onDeparturePing: (durationMinutes: number) => void;
    onSetTimer: (minutes: number) => void;
    onSkip: () => void;
}

export const HandoffFlow: React.FC<HandoffFlowProps> = ({
    step, finderName, onOutcome, onFailureReason, onDeparturePing, onSetTimer, onSkip,
}) => {
    const [submitted, setSubmitted] = useState(false);
    const [innerStep, setInnerStep] = useState<'reminder' | 'departure'>('reminder');
    const [timerSet, setTimerSet] = useState(false);
    const [sharing, setSharing] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset inner celebration state each time the celebration step opens
    useEffect(() => {
        if (step === 'celebration') {
            setInnerStep('reminder');
            setTimerSet(false);
            setSharing(false);
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [step]);

    const handleSetTimer = (minutes: number) => {
        onSetTimer(minutes);
        setTimerSet(true);
        timerRef.current = setTimeout(() => setInnerStep('departure'), 1500);
    };

    const handleDeparturePing = (minutes: number) => {
        if (sharing) return;
        setSharing(true);
        timerRef.current = setTimeout(() => onDeparturePing(minutes), 1000);
    };

    if (step === 'outcome') {
        return (
            <div className="text-center">
                <div className="flex justify-center mb-5">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #1e75ff22, #0ea5e922)', border: '1.5px solid #1e75ff44' }}>
                        <Car size={38} className="text-[#38bdf8]" />
                    </div>
                </div>
                <h3 className="font-extrabold text-xl text-[var(--color-text)] mb-1">Did you get the spot?</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-6">Let us know how it went</p>
                <div className="flex gap-3">
                    <button
                        onClick={() => { if (!submitted) { setSubmitted(true); onOutcome('success'); } }}
                        disabled={submitted}
                        className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}
                    >
                        <CheckCircle2 size={16} />
                        Yes, I'm in!
                    </button>
                    <button
                        onClick={() => { if (!submitted) { setSubmitted(true); onOutcome('failed'); } }}
                        disabled={submitted}
                        className="flex-1 py-3.5 rounded-2xl text-sm font-bold border border-[var(--color-border)] bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)] flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <XCircle size={16} className="text-red-400" />
                        No luck
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'celebration') {
        // Hero — shown in both inner steps
        const hero = (
            <div className="rounded-3xl p-5 mb-6 text-center relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #1e75ff18, #0ea5e918)', border: '1.5px solid #1e75ff33' }}>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-32 h-32 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #1e75ff, transparent)' }} />
                </div>
                <div className="flex justify-center mb-3 relative">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #1e75ff, #0ea5e9)' }}>
                        <Car size={36} className="text-white" />
                    </div>
                </div>
                <h3 className="font-extrabold text-2xl text-[var(--color-text)] mb-1">You're parked!</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                    {finderName
                        ? `${finderName} helped you find this spot.`
                        : 'Someone helped you find this spot.'}
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-3">
                    <Crown size={13} className="text-yellow-400" />
                    <p className="text-[11px] font-bold text-yellow-400">+1 Crown earned</p>
                </div>
            </div>
        );

        if (innerStep === 'reminder') {
            return (
                <div>
                    {hero}

                    <div className="flex items-center gap-1.5 mb-3">
                        <Bell size={12} className="text-[var(--color-text-secondary)]" />
                        <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">Set a move reminder</p>
                    </div>

                    {timerSet ? (
                        <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
                            <CheckCircle2 size={14} className="text-emerald-400" />
                            <p className="text-sm font-semibold text-emerald-400">Reminder set.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            {OPTIONS.map(opt => (
                                <button
                                    key={opt.minutes}
                                    onClick={() => handleSetTimer(opt.minutes)}
                                    className="py-3 rounded-2xl text-xs font-bold border border-[var(--color-border)] bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)]"
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {!timerSet && (
                        <button
                            onClick={() => setInnerStep('departure')}
                            className="w-full py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-all"
                        >
                            Skip reminder
                        </button>
                    )}
                </div>
            );
        }

        // innerStep === 'departure'
        return (
            <div>
                {hero}

                <div className="flex items-center gap-1.5 mb-1">
                    <Users size={12} className="text-[var(--color-text-secondary)]" />
                    <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">Pay it forward</p>
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] mb-3">When are you leaving? Let the next driver know.</p>

                {sharing ? (
                    <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4">
                        <CheckCircle2 size={14} className="text-[#38bdf8]" />
                        <p className="text-sm font-semibold text-[#38bdf8]">Spot shared.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        {OPTIONS.map(opt => (
                            <button
                                key={opt.minutes}
                                onClick={() => handleDeparturePing(opt.minutes)}
                                className="py-3 rounded-2xl text-xs font-bold border border-[var(--color-border)] bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)]"
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}

                {!sharing && (
                    <button
                        onClick={onSkip}
                        className="w-full py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-all"
                    >
                        Not now
                    </button>
                )}
            </div>
        );
    }

    if (step === 'failure_reason') {
        return (
            <div>
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.25)' }}>
                        <XCircle size={30} className="text-red-400" />
                    </div>
                </div>
                <h3 className="font-extrabold text-xl text-[var(--color-text)] mb-1 text-center">What happened?</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mb-5 text-center">This helps us improve the experience</p>
                <div className="space-y-2">
                    {FAILURE_REASONS.map(({ label, icon: Icon }) => (
                        <button
                            key={label}
                            onClick={() => onFailureReason(label)}
                            className="w-full py-3 px-4 rounded-2xl text-sm font-semibold border border-[var(--color-border)] bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)] flex items-center gap-3"
                        >
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(30,117,255,0.12)', border: '1px solid rgba(30,117,255,0.2)' }}>
                                <Icon size={15} className="text-[#38bdf8]" />
                            </div>
                            {label}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return null;
};
