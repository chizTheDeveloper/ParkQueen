import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { t } from '../i18n';
import { AvatarComposite } from '../components/AvatarComposite';
import { PARSONA_PRESETS, getDefaultAvatar } from '../parsona/presets';
import type { AvatarConfig } from '../parsona/types';

interface ParsonaPresetPickerViewProps {
  userId: string;
  onDone: (avatar: AvatarConfig | null) => void;
}

export function ParsonaPresetPickerView({ userId, onDone }: ParsonaPresetPickerViewProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(false);

  const handleSave = async () => {
    const preset = selected
      ? PARSONA_PRESETS.find(p => p.id === selected)?.avatar ?? getDefaultAvatar(userId)
      : getDefaultAvatar(userId);

    setSaving(true);
    setError(false);
    try {
      await updateDoc(doc(db, 'users', userId), { avatar: preset });
      onDone(preset);
    } catch {
      setError(true);
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 pt-8 pb-4 text-center"
           style={{ paddingTop: 'max(32px, env(safe-area-inset-top))' }}>
        <h1 className="text-2xl font-extrabold tracking-tight">{t('parsona.preset.title')}</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-relaxed">
          {t('parsona.preset.subtitle')}
        </p>
      </div>

      {/* ── Preset grid ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-4 gap-3">
          {PARSONA_PRESETS.map(preset => {
            const isSelected = selected === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setSelected(isSelected ? null : preset.id)}
                aria-label={preset.label + (isSelected ? ' — selected' : '')}
                aria-pressed={isSelected}
                className={`
                  flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all
                  ${isSelected
                    ? 'border-[#1e75ff] bg-[#1e75ff]/15 shadow-[0_0_0_2px_#1e75ff40]'
                    : 'border-[var(--color-border)] bg-white/4 active:bg-white/8'}
                `}
              >
                <AvatarComposite
                  avatar={preset.avatar}
                  size={64}
                  aria-label={preset.label}
                />
                <span className="text-[9px] font-medium text-[var(--color-text-secondary)] text-center leading-tight w-full overflow-hidden text-ellipsis whitespace-nowrap">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-2 pb-6 space-y-2 border-t border-[var(--color-border)]"
           style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        {error && (
          <p className="text-xs text-red-400 text-center">{t('parsona.save_error')}</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`
            w-full py-4 rounded-2xl font-bold text-sm transition-all
            ${saving ? 'bg-[#1e75ff]/40 text-white/50 cursor-default' : 'bg-[#1e75ff] text-white active:opacity-90'}
          `}
        >
          {saving
            ? t('parsona.saving')
            : selected
              ? t('parsona.preset.select')
              : t('parsona.preset.later')}
        </button>
        {selected && (
          <button
            onClick={() => { setSelected(null); handleSave(); }}
            className="w-full py-3 rounded-xl text-sm text-[var(--color-text-secondary)] font-medium min-h-[44px] active:opacity-70 transition-opacity"
          >
            {t('parsona.preset.later')}
          </button>
        )}
      </div>
    </div>
  );
}
