import React from 'react';
import { t, useLang } from '../i18n';

interface Props {
    onDone: () => void;
}

export const LocationPromptView = ({ onDone }: Props) => {
    useLang();

    const handleEnable = () => {
        if (navigator.geolocation) {
            // Trigger OS prompt; map's watchPosition will handle the actual result
            navigator.geolocation.getCurrentPosition(() => {}, () => {});
        }
        onDone();
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--color-bg)] px-8"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="w-16 h-16 rounded-2xl bg-blue-500/15 flex items-center justify-center mb-8">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="11" r="3" />
                    <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                </svg>
            </div>

            <h2 className="text-[24px] font-bold text-[var(--color-text)] text-center leading-tight mb-3">
                {t('onboarding.location.headline')}
            </h2>
            <p className="text-[var(--color-text-secondary)] text-center text-[15px] leading-relaxed mb-10 max-w-xs">
                {t('onboarding.location.body')}
            </p>

            <button
                onClick={handleEnable}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 active:scale-[0.98] text-white font-bold py-4 rounded-full text-[15px] shadow-lg shadow-blue-500/30 transition-transform"
            >
                {t('onboarding.location.enable')}
            </button>
            <button
                onClick={onDone}
                className="mt-3 py-3 px-6 min-h-[44px] text-[var(--color-text-secondary)] text-sm"
            >
                {t('onboarding.location.skip')}
            </button>
        </div>
    );
};
