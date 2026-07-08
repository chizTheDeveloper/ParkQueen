import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Car, Share2, Bell, ScanLine } from 'lucide-react';

export const TOUR_KEY = 'parqueenAppTourSeen_v1';

const TOUR_STEPS = [
    {
        Icon: MapPin,
        title: 'Welcome to ParQueen',
        body: 'Save your car, find shared spots, and help nearby drivers.',
    },
    {
        Icon: Car,
        title: 'Save Your Spot',
        body: 'Tap My Car to remember where you parked and set a private reminder.',
    },
    {
        Icon: Share2,
        title: 'Share a Spot',
        body: 'Leaving? Ping your spot so a neighbor can grab it.',
    },
    {
        Icon: Bell,
        title: 'Nearby Activity',
        body: 'See shared spots around you and get notified when parking opens nearby.',
    },
    {
        Icon: ScanLine,
        title: 'Scan Street Signs',
        body: 'Use the AI assistant to understand confusing parking signs.',
    },
] as const;

interface AppTourProps {
    onDone: () => void;
}

export const AppTour: React.FC<AppTourProps> = ({ onDone }) => {
    const [step, setStep] = useState(0);
    const [visible, setVisible] = useState(false);
    const dismissedRef = useRef(false);
    const total = TOUR_STEPS.length;
    const isLast = step === total - 1;

    // Slide-up entrance — same requestAnimationFrame pattern as BottomSheet
    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
    }, []);

    const dismiss = () => {
        if (dismissedRef.current) return;
        dismissedRef.current = true;
        setVisible(false);
        localStorage.setItem(TOUR_KEY, '1');
        setTimeout(onDone, 300);
    };

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const { Icon, title, body } = TOUR_STEPS[step];

    return (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
            {/* Backdrop — blocks map taps, clicking it skips */}
            <div
                className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
                onClick={dismiss}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`App tour, step ${step + 1} of ${total}`}
                className="relative bg-[var(--color-surface)] rounded-t-3xl shadow-2xl px-6 pb-10 pt-6"
                style={{
                    transform: visible ? 'translateY(0)' : 'translateY(100%)',
                    transition: prefersReducedMotion ? 'none' : 'transform 300ms ease-out',
                }}
            >
                {/* Step icon */}
                <div className="w-12 h-12 rounded-2xl bg-[#1e75ff]/15 flex items-center justify-center mb-4">
                    <Icon size={24} className="text-[#1e75ff]" />
                </div>

                {/* Copy */}
                <h2 className="text-lg font-bold text-[var(--color-text)] mb-1.5">{title}</h2>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-6">{body}</p>

                {/* Progress dots */}
                <div className="flex gap-1.5 mb-6" aria-hidden="true">
                    {TOUR_STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                i === step ? 'w-5 bg-[#1e75ff]' : 'w-1.5 bg-[var(--color-border)]'
                            }`}
                        />
                    ))}
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={dismiss}
                        className="flex-1 py-3 rounded-full border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-white/5 active:scale-[0.98] transition-all min-h-[44px]"
                    >
                        Skip
                    </button>
                    {isLast ? (
                        <button
                            onClick={dismiss}
                            className="flex-1 py-3 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 text-sm font-bold text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all min-h-[44px]"
                        >
                            Done
                        </button>
                    ) : (
                        <button
                            onClick={() => setStep(s => s + 1)}
                            className="flex-1 py-3 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 text-sm font-bold text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all min-h-[44px]"
                        >
                            Next
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
