import React, { useState } from 'react';

const FAILURE_REASONS = [
    'Someone else got the spot',
    'Finder hadn\'t left yet',
    'Couldn\'t find the location',
    'Other',
];

const DURATION_OPTIONS = [
    { label: '30 min', minutes: 30 },
    { label: '1 hr', minutes: 60 },
    { label: '2 hr', minutes: 120 },
    { label: '4 hr', minutes: 240 },
];

interface HandoffFlowProps {
    step: 'outcome' | 'celebration' | 'failure_reason';
    onOutcome: (outcome: 'success' | 'failed') => void;
    onFailureReason: (reason: string) => void;
    onDeparturePing: (durationMinutes: number) => void;
    onSkip: () => void;
}

export const HandoffFlow: React.FC<HandoffFlowProps> = ({
    step, onOutcome, onFailureReason, onDeparturePing, onSkip,
}) => {
    const [submitted, setSubmitted] = useState(false);

    if (step === 'outcome') {
        return (
            <div className="text-center">
                <div className="text-4xl mb-3">🅿️</div>
                <h3 className="font-bold text-lg text-[var(--color-text)] mb-1">Were you able to park?</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mb-5">Let us know how it went</p>
                <div className="flex gap-3">
                    <button
                        onClick={() => { if (!submitted) { setSubmitted(true); onOutcome('success'); } }}
                        disabled={submitted}
                        className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}
                    >
                        Yes
                    </button>
                    <button
                        onClick={() => { if (!submitted) { setSubmitted(true); onOutcome('failed'); } }}
                        disabled={submitted}
                        className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-[var(--color-border)] hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)] disabled:opacity-50"
                    >
                        No
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'celebration') {
        return (
            <div className="text-center">
                <div className="text-5xl mb-3">🎉</div>
                <h3 className="font-bold text-lg text-[var(--color-text)] mb-1">You parked!</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mb-5">Know when you'll be leaving?</p>
                <p className="text-[10px] text-[var(--color-text-secondary)] mb-3">Help the next driver find this spot</p>
                <div className="grid grid-cols-4 gap-2 mb-3">
                    {DURATION_OPTIONS.map(opt => (
                        <button
                            key={opt.minutes}
                            onClick={() => onDeparturePing(opt.minutes)}
                            className="py-2.5 rounded-xl text-xs font-semibold bg-white/5 border border-[var(--color-border)] hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)]"
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={onSkip}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold bg-white/5 border border-[var(--color-border)] hover:bg-white/10 transition-all text-[var(--color-text)]"
                >
                    Skip
                </button>
            </div>
        );
    }

    if (step === 'failure_reason') {
        return (
            <div className="text-center">
                <h3 className="font-bold text-lg text-[var(--color-text)] mb-1">What happened?</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mb-4">This helps us improve the experience</p>
                <div className="space-y-2">
                    {FAILURE_REASONS.map(reason => (
                        <button
                            key={reason}
                            onClick={() => onFailureReason(reason)}
                            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-[var(--color-border)] hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)]"
                        >
                            {reason}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return null;
};
