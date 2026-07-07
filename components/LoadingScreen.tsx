import React from 'react';
import ParQueenLogo from '../assets/Parqueen_Logo.png';

export const LoadingScreen = () => (
    <div
        className="h-full w-full flex items-center justify-center bg-[var(--color-bg)]"
        role="status"
        aria-live="polite"
        aria-label="Loading ParQueen"
    >
        <img
            src={ParQueenLogo}
            alt=""
            aria-hidden="true"
            width={160}
            height={160}
            className="w-40 motion-safe:animate-pulse select-none pointer-events-none"
            draggable={false}
        />
    </div>
);
