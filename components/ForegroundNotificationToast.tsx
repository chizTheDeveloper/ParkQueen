import React from 'react';

interface ForegroundNotificationToastProps {
  title: string;
  body: string;
  openLabel: string;
  dismissLabel: string;
  onOpen: () => void;
  onDismiss: () => void;
}

export const ForegroundNotificationToast: React.FC<ForegroundNotificationToastProps> = ({
  title,
  body,
  openLabel,
  dismissLabel,
  onOpen,
  onDismiss,
}) => (
  <div className="fixed top-4 left-4 right-4 z-50 flex justify-center animate-in fade-in slide-in-from-top duration-300">
    <div className="bg-[var(--color-glass)] backdrop-blur-xl border border-[var(--color-border)] rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 max-w-sm w-full">
      <div className="w-9 h-9 rounded-full bg-[#1e75ff]/15 flex items-center justify-center shrink-0">
        <span className="text-lg" aria-hidden="true">👑</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-[var(--color-text)] truncate">{title}</div>
        <div className="text-xs text-[var(--color-text-secondary)] truncate">{body}</div>
      </div>
      <button
        type="button"
        data-foreground-notification-action="open"
        onClick={onOpen}
        className="shrink-0 rounded-lg bg-[#1e75ff] px-3 py-1.5 text-xs font-bold text-white"
      >
        {openLabel}
      </button>
      <button
        type="button"
        data-foreground-notification-action="dismiss"
        onClick={onDismiss}
        aria-label={dismissLabel}
        className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] shrink-0 text-lg"
      >
        &times;
      </button>
    </div>
  </div>
);
