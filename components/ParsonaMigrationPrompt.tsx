import React from 'react';
import { t } from '../i18n';

interface ParsonaMigrationPromptProps {
  onCreateParsona: () => void;
  onDismiss: () => void;
}

/**
 * One-time banner shown to users who have an existing `avatarUrl` but no
 * `avatar` object yet. Invites them to create a Parsona.
 * The caller is responsible for persisting the dismissal state.
 */
export function ParsonaMigrationPrompt({ onCreateParsona, onDismiss }: ParsonaMigrationPromptProps) {
  return (
    <div className="mx-4 mb-4 rounded-2xl border border-[#1e75ff]/30 bg-[#1e75ff]/10 p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#1e75ff]/20 flex items-center justify-center shrink-0 mt-0.5">
          {/* Crown icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 20h20M5 20V9l7-5 7 5v11"/>
            <path d="M9 20v-6h6v6"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text)] leading-snug">
            {t('parsona.migration.title')}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
            {t('parsona.migration.body')}
          </p>
          <div className="flex gap-3 mt-3">
            <button
              onClick={onCreateParsona}
              className="flex-1 py-2 px-3 rounded-xl bg-[#1e75ff] text-white text-xs font-semibold min-h-[44px] active:opacity-80 transition-opacity"
            >
              {t('parsona.migration.cta')}
            </button>
            <button
              onClick={onDismiss}
              className="py-2 px-3 rounded-xl bg-white/5 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs font-medium min-h-[44px] active:opacity-70 transition-opacity"
            >
              {t('parsona.migration.dismiss')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
