import React, { useState, useEffect, useRef, useCallback } from 'react';
import ParqueenLogo from '../../assets/Parqueen_Logo.png';

export const TOUR_KEY = 'parqueenAppTourSeen_v1';

interface CoachStep {
    target: string;
    title: string;
    body: string;
}

const WELCOME = {
    title: 'Welcome to ParQueen',
    body: 'Save your car, find shared spots, and help nearby drivers.',
};

const COACH_STEPS: CoachStep[] = [
    { target: 'share-spot', title: 'Share a Spot',        body: 'Leaving? Tap here to ping your spot so a neighbor can grab it.' },
    { target: 'my-car',     title: 'My Car',              body: 'Save where you parked and set a private reminder.' },
    { target: 'search',     title: 'Find Parking Nearby', body: 'Search a neighborhood or street to explore parking around you.' },
    { target: 'bell',       title: 'Nearby Activity',     body: 'See shared spots near you and get notified when parking opens up.' },
    { target: 'ai',         title: 'Scan Street Signs',   body: 'Confused by a sign? Use AI to understand parking rules.' },
];

function getTargetRect(target: string): DOMRect | null {
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return r;
}

interface AppTourProps {
    onDone: () => void;
}

export const AppTour: React.FC<AppTourProps> = ({ onDone }) => {
    const [phase, setPhase] = useState<'welcome' | 'coach'>('welcome');
    const [steps, setSteps] = useState<CoachStep[]>([]);
    const [stepIndex, setStepIndex] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [visible, setVisible] = useState(false);
    const dismissedRef = useRef(false);

    const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
    }, []);

    const dismiss = useCallback(() => {
        if (dismissedRef.current) return;
        dismissedRef.current = true;
        setVisible(false);
        localStorage.setItem(TOUR_KEY, '1');
        setTimeout(onDone, prefersReducedMotion ? 0 : 300);
    }, [onDone, prefersReducedMotion]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [dismiss]);

    const updateRect = useCallback(() => {
        if (phase !== 'coach' || steps.length === 0) return;
        const step = steps[stepIndex];
        if (step) setRect(getTargetRect(step.target));
    }, [phase, steps, stepIndex]);

    useEffect(() => { updateRect(); }, [updateRect]);

    useEffect(() => {
        let t: ReturnType<typeof setTimeout>;
        const h = () => { clearTimeout(t); t = setTimeout(updateRect, 150); };
        window.addEventListener('resize', h);
        return () => { window.removeEventListener('resize', h); clearTimeout(t); };
    }, [updateRect]);

    const startTour = () => {
        const available = COACH_STEPS.filter(s => getTargetRect(s.target) !== null);
        setSteps(available);
        setStepIndex(0);
        setPhase('coach');
    };

    const advance = () => {
        if (stepIndex < steps.length - 1) {
            setStepIndex(i => i + 1);
        } else {
            dismiss();
        }
    };

    // ── WELCOME CARD ─────────────────────────────────────────────
    if (phase === 'welcome') {
        return (
            <div
                className="fixed inset-0 flex items-center justify-center p-6"
                style={{ zIndex: 40 }}
            >
                {/* Dark backdrop — no onClick, does not dismiss */}
                <div className="absolute inset-0 bg-black/65" aria-hidden="true" />

                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Welcome to ParQueen"
                    className="relative w-full max-w-[320px] flex flex-col items-center"
                    style={{
                        transform: visible ? 'scale(1)' : 'scale(0.92)',
                        opacity: visible ? 1 : 0,
                        transition: prefersReducedMotion
                            ? 'none'
                            : 'transform 280ms cubic-bezier(0.34,1.56,0.64,1), opacity 200ms ease-out',
                    }}
                >
                    {/* Logo floats above the card, overlapping its top edge */}
                    <img
                        src={ParqueenLogo}
                        alt="ParQueen"
                        className="w-32 h-32 object-contain relative z-10"
                        style={{
                            marginBottom: '-32px',
                            filter: 'drop-shadow(0 0 14px rgba(56,189,248,0.75)) drop-shadow(0 0 32px rgba(30,117,255,0.45))',
                        }}
                    />

                    {/* Card body — top padding makes room for the overlapping logo */}
                    <div className="w-full bg-[var(--color-card)] rounded-3xl shadow-2xl border border-white/10 px-6 pt-12 pb-7">
                        <h2 className="text-[20px] font-bold text-[var(--color-text)] mb-2 leading-tight text-center">{WELCOME.title}</h2>
                        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed mb-7 text-center">{WELCOME.body}</p>

                    <div className="flex gap-3">
                        <button
                            onClick={dismiss}
                            className="flex-1 py-3 rounded-full border border-[var(--color-border)] text-[13px] font-semibold text-[var(--color-text-secondary)] hover:bg-white/5 active:scale-[0.98] transition-all min-h-[44px]"
                        >
                            Skip
                        </button>
                        <button
                            onClick={startTour}
                            className="flex-1 py-3 rounded-full text-[13px] font-bold text-white active:scale-[0.98] transition-all min-h-[44px]"
                            style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}
                        >
                            Start Tour
                        </button>
                    </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── COACH MARK ───────────────────────────────────────────────
    const step = steps[stepIndex];
    if (!step || !rect) return null;

    const PAD = 10;
    const MIN = 44;
    const ringW = Math.max(rect.width + PAD * 2, MIN);
    const ringH = Math.max(rect.height + PAD * 2, MIN);
    const ringTop = rect.top + rect.height / 2 - ringH / 2;
    const ringLeft = rect.left + rect.width / 2 - ringW / 2;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tooltipW = Math.min(300, vw - 32);
    const tooltipLeft = Math.max(16, Math.min(vw - tooltipW - 16, vw / 2 - tooltipW / 2));
    const belowTarget = (rect.top + rect.height / 2) < vh / 2;

    return (
        <>
            {/* Transparent click-blocker: absorbs all taps, never dismisses */}
            <div
                aria-hidden="true"
                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            />

            {/* Spotlight ring — transparent center, box-shadow scrim fills the rest */}
            <div
                aria-hidden="true"
                style={{
                    position: 'fixed',
                    top: ringTop,
                    left: ringLeft,
                    width: ringW,
                    height: ringH,
                    borderRadius: 9999,
                    zIndex: 41,
                    pointerEvents: 'none',
                    boxShadow: visible
                        ? '0 0 0 9999px rgba(0,0,0,0.65), 0 0 0 3px #38bdf8, 0 0 20px rgba(56,189,248,0.4)'
                        : '0 0 0 9999px rgba(0,0,0,0)',
                    transition: prefersReducedMotion
                        ? 'none'
                        : 'box-shadow 300ms ease, top 250ms cubic-bezier(0.4,0,0.2,1), left 250ms cubic-bezier(0.4,0,0.2,1), width 250ms cubic-bezier(0.4,0,0.2,1), height 250ms cubic-bezier(0.4,0,0.2,1)',
                }}
            />

            {/* Tooltip card */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label={`App tour, step ${stepIndex + 1} of ${steps.length}`}
                className="bg-[var(--color-card)] border border-white/10 rounded-2xl shadow-2xl px-5 py-4"
                style={{
                    position: 'fixed',
                    ...(belowTarget
                        ? { top: ringTop + ringH + 14 }
                        : { bottom: vh - ringTop + 14 }),
                    left: tooltipLeft,
                    width: tooltipW,
                    zIndex: 42,
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'none' : (belowTarget ? 'translateY(6px)' : 'translateY(-6px)'),
                    transition: prefersReducedMotion ? 'none' : 'opacity 200ms ease, transform 200ms ease',
                }}
            >
                <p className="text-[10px] font-bold tracking-[0.15em] text-[#38bdf8] uppercase mb-2">
                    {stepIndex + 1} of {steps.length}
                </p>
                <h3 className="text-[16px] font-bold text-[var(--color-text)] mb-1 leading-tight">{step.title}</h3>
                <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed mb-4">{step.body}</p>

                <div className="flex gap-2.5">
                    <button
                        onClick={dismiss}
                        className="flex-1 py-2.5 rounded-full border border-[var(--color-border)] text-[12px] font-semibold text-[var(--color-text-secondary)] hover:bg-white/5 active:scale-[0.98] transition-all min-h-[44px]"
                    >
                        Skip
                    </button>
                    <button
                        onClick={advance}
                        className="flex-1 py-2.5 rounded-full text-[12px] font-bold text-white active:scale-[0.98] transition-all min-h-[44px]"
                        style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}
                    >
                        {stepIndex === steps.length - 1 ? 'Done' : 'Next'}
                    </button>
                </div>
            </div>
        </>
    );
};
