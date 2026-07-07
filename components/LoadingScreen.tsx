import React from 'react';

/**
 * Suspense/lazy-chunk fallback. Shown while heavy view chunks load.
 * Uses skeleton pattern (Apple HIG progressive-loading) so users perceive
 * the app as already present and waiting — not stuck on a splash screen.
 * All colors use semantic theme tokens so light and dark mode work automatically.
 * Animations use motion-safe: to respect prefers-reduced-motion.
 */
export const LoadingScreen = () => (
    <div
        className="h-full w-full bg-[var(--color-bg)] flex flex-col items-center justify-center px-8"
        role="status"
        aria-live="polite"
        aria-label="Loading ParQueen"
    >
        {/* Brand wordmark */}
        <p className="text-3xl font-extrabold tracking-tight text-[var(--color-text)] mb-1 select-none">
            ParQueen
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] mb-8 tracking-wide">
            Preparing your parking map…
        </p>

        {/* Mini map skeleton card */}
        <div
            className="w-full max-w-[280px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 motion-safe:animate-pulse"
            aria-hidden="true"
        >
            {/* Street-line placeholders */}
            <div className="space-y-2.5 mb-4">
                <div className="h-1.5 rounded-full bg-[var(--color-border)] w-full" />
                <div className="h-1.5 rounded-full bg-[var(--color-border)] w-4/5" />
                <div className="h-1.5 rounded-full bg-[var(--color-border)] w-11/12" />
            </div>
            {/* Location dot + address bar */}
            <div className="flex items-center gap-2.5">
                <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: 'linear-gradient(135deg,#1e75ff,#0ea5e9)' }}
                />
                <div className="h-2 rounded-full bg-[var(--color-border)] flex-1" />
            </div>
        </div>
    </div>
);
