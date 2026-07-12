import React, { useState, useEffect, useRef, useCallback } from 'react';
import ParqueenLogo from '../../assets/Parqueen_Logo.png';
import { t, useLang } from '../../i18n';

export const TOUR_KEY = 'parqueenAppTourSeen_v1';

interface CoachStep {
    target: string;
    title: string;
    body: string;
}

// Step target IDs are stable; titles/bodies are resolved via t() inside the component.
const STEP_TARGETS = [
    { target: 'share-spot', key: 'ping_your_spot' },
    { target: 'my-car',     key: 'my_car' },
    { target: 'search',     key: 'search' },
    { target: 'profile',    key: 'profile' },
    { target: 'messages',   key: 'messages' },
    { target: 'bell',       key: 'bell' },
    { target: 'ai',         key: 'ai' },
] as const;

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
    useLang(); // re-render when language changes

    const welcome = {
        title: t('tour.welcome.title'),
        body: t('tour.welcome.body'),
    };
    const coachSteps: CoachStep[] = STEP_TARGETS.map(({ target, key }) => ({
        target,
        title: t(`tour.step.${key}.title`),
        body: t(`tour.step.${key}.body`),
    }));

    const [phase, setPhase] = useState<'welcome' | 'coach'>('welcome');
    const [steps, setSteps] = useState<CoachStep[]>([]);
    const [stepIndex, setStepIndex] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [visible, setVisible] = useState(false);
    const dismissedRef = useRef(false);
    const welcomeRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
    }, []);

    // Move focus into active card when welcome opens or step changes
    useEffect(() => {
        if (phase === 'welcome') {
            requestAnimationFrame(() => welcomeRef.current?.focus());
        }
    }, [phase]);

    useEffect(() => {
        if (phase === 'coach') {
            requestAnimationFrame(() => tooltipRef.current?.focus());
        }
    }, [phase, stepIndex]);

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
        let tid: ReturnType<typeof setTimeout>;
        const h = () => { clearTimeout(tid); tid = setTimeout(updateRect, 150); };
        window.addEventListener('resize', h);
        return () => { window.removeEventListener('resize', h); clearTimeout(tid); };
    }, [updateRect]);

    const startTour = () => {
        const available = coachSteps.filter(s => getTargetRect(s.target) !== null);
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
                    ref={welcomeRef}
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('tour.welcome.title')}
                    className="relative w-full max-w-[320px] flex flex-col items-center focus:outline-none"
                    style={{
                        transform: visible ? 'scale(1)' : 'scale(0.92)',
                        opacity: visible ? 1 : 0,
                        transition: prefersReducedMotion
                            ? 'none'
                            : 'transform 280ms cubic-bezier(0.34,1.56,0.64,1), opacity 200ms ease-out',
                    }}
                >
                    {/* Logo floats above the card, overlapping its top edge */}
                    <div
                        className="relative w-32 h-32 z-10"
                        style={{ marginBottom: '-32px' }}
                    >
                        <img
                            src={ParqueenLogo}
                            alt="ParQueen"
                            className="w-full h-full object-contain"
                            style={{
                                filter: 'drop-shadow(0 0 14px rgba(56,189,248,0.75)) drop-shadow(0 0 32px rgba(30,117,255,0.45))',
                            }}
                        />
                        {/* Shine sweep — CSS-masked to logo shape so light only hits logo pixels */}
                        <div
                            aria-hidden="true"
                            style={{
                                position: 'absolute',
                                inset: 0,
                                WebkitMaskImage: `url(${ParqueenLogo})`,
                                maskImage: `url(${ParqueenLogo})`,
                                WebkitMaskSize: 'contain',
                                maskSize: 'contain',
                                WebkitMaskRepeat: 'no-repeat',
                                maskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center',
                                maskPosition: 'center',
                                overflow: 'hidden',
                                pointerEvents: 'none',
                            }}
                        >
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '-10%',
                                    left: '-60%',
                                    width: '45%',
                                    height: '120%',
                                    background: 'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
                                    transform: 'skewX(-18deg)',
                                    animation: prefersReducedMotion ? 'none' : 'parqueen-shine 2.6s ease-in-out infinite',
                                }}
                            />
                        </div>
                        <style>{`
                            @keyframes parqueen-shine {
                                0%   { left: -60%; }
                                38%  { left: 120%; }
                                100% { left: 120%; }
                            }
                        `}</style>
                    </div>

                    {/* Card body — top padding makes room for the overlapping logo */}
                    <div className="w-full bg-[var(--color-card)] rounded-3xl shadow-2xl border border-white/10 px-6 pt-12 pb-7">
                        <h2 className="text-[20px] font-bold text-[var(--color-text)] mb-2 leading-tight text-center">{welcome.title}</h2>
                        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed mb-7 text-center">{welcome.body}</p>

                    <div className="flex gap-3">
                        <button
                            onClick={dismiss}
                            className="flex-1 py-3 rounded-full border border-[var(--color-border)] text-[13px] font-semibold text-[var(--color-text-secondary)] hover:bg-white/5 active:scale-[0.98] transition-all min-h-[44px]"
                        >
                            {t('tour.skip')}
                        </button>
                        <button
                            onClick={startTour}
                            className="flex-1 py-3 rounded-full text-[13px] font-bold text-white active:scale-[0.98] transition-all min-h-[44px]"
                            style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}
                        >
                            {t('tour.start')}
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
                ref={tooltipRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={`App tour, step ${stepIndex + 1} of ${steps.length}`}
                className="bg-[var(--color-card)] border border-white/10 rounded-2xl shadow-2xl px-5 py-4 focus:outline-none"
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
                    {t('tour.step_counter', { current: stepIndex + 1, total: steps.length })}
                </p>
                <h3 className="text-[16px] font-bold text-[var(--color-text)] mb-1 leading-tight">{step.title}</h3>
                <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed mb-4">{step.body}</p>

                <div className="flex gap-2.5">
                    <button
                        onClick={dismiss}
                        className="flex-1 py-2.5 rounded-full border border-[var(--color-border)] text-[12px] font-semibold text-[var(--color-text-secondary)] hover:bg-white/5 active:scale-[0.98] transition-all min-h-[44px]"
                    >
                        {t('tour.skip')}
                    </button>
                    <button
                        onClick={advance}
                        className="flex-1 py-2.5 rounded-full text-[12px] font-bold text-white active:scale-[0.98] transition-all min-h-[44px]"
                        style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}
                    >
                        {stepIndex === steps.length - 1 ? t('tour.done') : t('tour.next')}
                    </button>
                </div>
            </div>
        </>
    );
};
