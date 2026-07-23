import React, { useState, useCallback, useRef, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { t } from '../i18n';
import { AvatarComposite } from '../components/AvatarComposite';
import {
  SKINS, FACES, HAIR_STYLES, HAIR_COLORS, FACIAL_HAIR,
  GLASSES, HEADWEAR, OUTFITS, BACKGROUNDS,
} from '../parsona/assets';
import { getDefaultAvatar } from '../parsona/presets';
import type { AvatarConfig, SkinId, FaceId, HairId, HairColorId, FacialHairId, GlassesId, HeadwearId, OutfitId, BackgroundId } from '../parsona/types';
import { ChevronLeft, Shuffle, RotateCcw } from 'lucide-react';

// ─── Category tab definition ───────────────────────────────────────────────────
type Category = 'skin' | 'face' | 'hair' | 'extras' | 'outfit' | 'background';

const CATEGORIES: { id: Category; key: string }[] = [
  { id: 'skin',       key: 'parsona.cat.skin' },
  { id: 'face',       key: 'parsona.cat.face' },
  { id: 'hair',       key: 'parsona.cat.hair' },
  { id: 'extras',     key: 'parsona.cat.extras' },
  { id: 'outfit',     key: 'parsona.cat.outfit' },
  { id: 'background', key: 'parsona.cat.background' },
];

// ─── Option tile ───────────────────────────────────────────────────────────────
function OptionTile({
  label, selected, onSelect,
  children,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onSelect}
      aria-label={label + (selected ? ` — ${t('parsona.selected_aria')}` : '')}
      aria-pressed={selected}
      className={`
        flex flex-col items-center gap-1.5 p-2 rounded-xl w-full min-h-[44px]
        border transition-all
        ${selected
          ? 'border-[#1e75ff] bg-[#1e75ff]/15 shadow-[0_0_0_2px_#1e75ff40]'
          : 'border-[var(--color-border)] bg-white/4 active:bg-white/8'}
      `}
    >
      {children}
      <span className="text-[10px] text-[var(--color-text-secondary)] font-medium leading-tight text-center w-full">
        {label}
      </span>
    </button>
  );
}

// ─── Color swatch tile ─────────────────────────────────────────────────────────
function ColorTile({
  label, color, selected, onSelect,
}: {
  label: string; color: string; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      aria-label={label + (selected ? ` — ${t('parsona.selected_aria')}` : '')}
      aria-pressed={selected}
      className={`
        flex flex-col items-center gap-1.5 p-2 rounded-xl w-full min-h-[44px]
        border transition-all
        ${selected
          ? 'border-[#1e75ff] bg-[#1e75ff]/15 shadow-[0_0_0_2px_#1e75ff40]'
          : 'border-[var(--color-border)] bg-white/4 active:bg-white/8'}
      `}
    >
      <span
        className="w-8 h-8 rounded-full border-2 border-white/20 shrink-0"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span className="text-[10px] text-[var(--color-text-secondary)] font-medium leading-tight text-center w-full">
        {label}
      </span>
    </button>
  );
}

// ─── None tile ────────────────────────────────────────────────────────────────
function NoneTile({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const label = t('parsona.none');
  return (
    <button
      onClick={onSelect}
      aria-label={label + (selected ? ` — ${t('parsona.selected_aria')}` : '')}
      aria-pressed={selected}
      className={`
        flex flex-col items-center gap-1.5 p-2 rounded-xl w-full min-h-[44px]
        border transition-all
        ${selected
          ? 'border-[#1e75ff] bg-[#1e75ff]/15 shadow-[0_0_0_2px_#1e75ff40]'
          : 'border-[var(--color-border)] bg-white/4 active:bg-white/8'}
      `}
    >
      <span className="w-8 h-8 rounded-full border-2 border-dashed border-[var(--color-border)] flex items-center justify-center" aria-hidden="true">
        <span className="w-4 h-0.5 bg-[var(--color-text-secondary)] rounded"/>
      </span>
      <span className="text-[10px] text-[var(--color-text-secondary)] font-medium leading-tight text-center w-full">{label}</span>
    </button>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
      {label}
    </p>
  );
}

// ─── Random avatar generator ───────────────────────────────────────────────────
function randomItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function randomAvatar(): AvatarConfig {
  const fhChance = Math.random() < 0.3;
  const glChance = Math.random() < 0.25;
  // Lower headwear probability; never combine coversHair headwear with facial hair
  const hwChance = Math.random() < 0.15;
  const hw = hwChance ? randomItem(HEADWEAR) : null;
  const coversHair = hw?.coversHair ?? false;
  return {
    version: 1,
    skin:       randomItem(SKINS).id,
    face:       randomItem(FACES).id,
    hair:       randomItem(HAIR_STYLES).id,
    hairColor:  randomItem(HAIR_COLORS).id,
    facialHair: (fhChance && !coversHair) ? randomItem(FACIAL_HAIR).id : null,
    glasses:    glChance ? randomItem(GLASSES).id : null,
    headwear:   hw?.id ?? null,
    outfit:     randomItem(OUTFITS).id,
    background: randomItem(BACKGROUNDS).id,
  };
}

// ─── Main view ─────────────────────────────────────────────────────────────────
interface ParsonaCreatorViewProps {
  user: { id: string; avatar?: AvatarConfig | null } | null;
  onBack: () => void;
  onSaved?: (avatar: AvatarConfig) => void;
}

export function ParsonaCreatorView({ user, onBack, onSaved }: ParsonaCreatorViewProps) {
  const initialAvatar: AvatarConfig = user?.avatar ?? getDefaultAvatar(user?.id ?? '');
  const [draft, setDraft]         = useState<AvatarConfig>(initialAvatar);
  const [saved, setSaved]         = useState<AvatarConfig>(initialAvatar);
  const [activeTab, setActiveTab] = useState<Category>('skin');
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

  // Scroll active tab into view
  useEffect(() => {
    const el = tabBarRef.current?.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement | null;
    el?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
  }, [activeTab]);

  const handleBack = useCallback(() => {
    if (isDirty) { setShowDiscard(true); return; }
    onBack();
  }, [isDirty, onBack]);

  const handleSave = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true);
    setSaveError(false);
    try {
      await updateDoc(doc(db, 'users', user.id), { avatar: draft });
      setSaved(draft);
      onSaved?.(draft);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }, [user?.id, draft, onSaved]);

  const update = useCallback(<K extends keyof AvatarConfig>(key: K, val: AvatarConfig[K]) => {
    setDraft(prev => ({ ...prev, [key]: val }));
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'skin':
        return (
          <div className="grid grid-cols-4 gap-2 py-1">
            {SKINS.map(s => (
              <ColorTile
                key={s.id}
                label={t(`parsona.skin.${s.id}`)}
                color={s.color}
                selected={draft.skin === s.id}
                onSelect={() => update('skin', s.id as SkinId)}
              />
            ))}
          </div>
        );

      case 'face':
        return (
          <div className="grid grid-cols-3 gap-2 py-1">
            {FACES.map(f => (
              <OptionTile
                key={f.id}
                label={t(`parsona.face.${f.id}`)}
                selected={draft.face === f.id}
                onSelect={() => update('face', f.id as FaceId)}
              >
                <AvatarComposite
                  avatar={{ ...draft, face: f.id as FaceId }}
                  size={48}
                  aria-label={t(`parsona.face.${f.id}`)}
                />
              </OptionTile>
            ))}
          </div>
        );

      case 'hair':
        return (
          <div className="space-y-4">
            <div>
              <SectionHeader label={t('parsona.section.style')} />
              <div className="grid grid-cols-3 gap-2">
                {HAIR_STYLES.map(h => (
                  <OptionTile
                    key={h.id}
                    label={t(`parsona.hair.${h.id}`)}
                    selected={draft.hair === h.id}
                    onSelect={() => update('hair', h.id as HairId)}
                  >
                    <AvatarComposite
                      avatar={{ ...draft, hair: h.id as HairId }}
                      size={48}
                      aria-label={t(`parsona.hair.${h.id}`)}
                    />
                  </OptionTile>
                ))}
              </div>
            </div>
            <div>
              <SectionHeader label={t('parsona.section.color')} />
              <div className="grid grid-cols-4 gap-2">
                {HAIR_COLORS.map(c => (
                  <ColorTile
                    key={c.id}
                    label={t(`parsona.hcolor.${c.id}`)}
                    color={c.color}
                    selected={draft.hairColor === c.id}
                    onSelect={() => update('hairColor', c.id as HairColorId)}
                  />
                ))}
              </div>
            </div>
          </div>
        );

      case 'extras':
        return (
          <div className="space-y-4">
            <div>
              <SectionHeader label={t('parsona.section.headwear')} />
              <div className="grid grid-cols-3 gap-2">
                <NoneTile selected={!draft.headwear} onSelect={() => update('headwear', null)} />
                {HEADWEAR.map(hw => (
                  <OptionTile
                    key={hw.id}
                    label={t(`parsona.hw.${hw.id}`)}
                    selected={draft.headwear === hw.id}
                    onSelect={() => update('headwear', hw.id as HeadwearId)}
                  >
                    <AvatarComposite
                      avatar={{ ...draft, headwear: hw.id as HeadwearId }}
                      size={48}
                      aria-label={t(`parsona.hw.${hw.id}`)}
                    />
                  </OptionTile>
                ))}
              </div>
            </div>
            <div>
              <SectionHeader label={t('parsona.section.glasses')} />
              <div className="grid grid-cols-3 gap-2">
                <NoneTile selected={!draft.glasses} onSelect={() => update('glasses', null)} />
                {GLASSES.map(gl => (
                  <OptionTile
                    key={gl.id}
                    label={t(`parsona.gl.${gl.id}`)}
                    selected={draft.glasses === gl.id}
                    onSelect={() => update('glasses', gl.id as GlassesId)}
                  >
                    <AvatarComposite
                      avatar={{ ...draft, glasses: gl.id as GlassesId }}
                      size={48}
                      aria-label={t(`parsona.gl.${gl.id}`)}
                    />
                  </OptionTile>
                ))}
              </div>
            </div>
            <div>
              <SectionHeader label={t('parsona.section.facial_hair')} />
              <div className="grid grid-cols-3 gap-2">
                <NoneTile selected={!draft.facialHair} onSelect={() => update('facialHair', null)} />
                {FACIAL_HAIR.map(fh => (
                  <OptionTile
                    key={fh.id}
                    label={t(`parsona.fh.${fh.id}`)}
                    selected={draft.facialHair === fh.id}
                    onSelect={() => update('facialHair', fh.id as FacialHairId)}
                  >
                    <AvatarComposite
                      avatar={{ ...draft, facialHair: fh.id as FacialHairId }}
                      size={48}
                      aria-label={t(`parsona.fh.${fh.id}`)}
                    />
                  </OptionTile>
                ))}
              </div>
            </div>
          </div>
        );

      case 'outfit':
        return (
          <div className="grid grid-cols-3 gap-2 py-1">
            {OUTFITS.map(o => (
              <OptionTile
                key={o.id}
                label={t(`parsona.outfit.${o.id}`)}
                selected={draft.outfit === o.id}
                onSelect={() => update('outfit', o.id as OutfitId)}
              >
                <AvatarComposite
                  avatar={{ ...draft, outfit: o.id as OutfitId }}
                  size={48}
                  aria-label={t(`parsona.outfit.${o.id}`)}
                />
              </OptionTile>
            ))}
          </div>
        );

      case 'background':
        return (
          <div className="grid grid-cols-4 gap-2 py-1">
            {BACKGROUNDS.map(bg => (
              <ColorTile
                key={bg.id}
                label={t(`parsona.bg.${bg.id}`)}
                color={bg.color}
                selected={draft.background === bg.id}
                onSelect={() => update('background', bg.id as BackgroundId)}
              />
            ))}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg)] text-[var(--color-text)]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0"
           style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button
          onClick={handleBack}
          aria-label="Back"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] shrink-0 active:bg-white/10 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold tracking-wide leading-tight">{t('parsona.title')}</h1>
          <p className="text-xs text-[var(--color-text-secondary)] leading-tight">{t('parsona.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setDraft(randomAvatar())}
            aria-label={t('parsona.randomize')}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] active:bg-white/10 transition-colors"
          >
            <Shuffle size={15} className="text-[var(--color-text-secondary)]" />
          </button>
          <button
            onClick={() => setDraft(saved)}
            aria-label={t('parsona.reset')}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] active:bg-white/10 transition-colors"
          >
            <RotateCcw size={15} className="text-[var(--color-text-secondary)]" />
          </button>
        </div>
      </div>

      {/* ── Live preview ─────────────────────────────────────────────────── */}
      <div className="flex justify-center py-4 shrink-0">
        <AvatarComposite
          avatar={draft}
          userId={user?.id}
          size={148}
          aria-label="Parsona preview"
          className="rounded-full shadow-[0_0_0_3px_#1e75ff40]"
        />
      </div>

      {/* ── Category tabs ────────────────────────────────────────────────── */}
      <div
        ref={tabBarRef}
        className="flex gap-1 px-4 pb-2 overflow-x-auto no-scrollbar shrink-0"
        role="tablist"
        aria-label="Parsona categories"
      >
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            data-tab={cat.id}
            role="tab"
            aria-selected={activeTab === cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={`
              px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 min-h-[36px]
              ${activeTab === cat.id
                ? 'bg-[#1e75ff] text-white'
                : 'bg-white/6 text-[var(--color-text-secondary)] active:bg-white/10'}
            `}
          >
            {t(cat.key)}
          </button>
        ))}
      </div>

      {/* ── Options panel ────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-4"
        role="tabpanel"
        aria-label={t(CATEGORIES.find(c => c.id === activeTab)?.key ?? '')}
      >
        {renderTabContent()}
      </div>

      {/* ── Save button ──────────────────────────────────────────────────── */}
      <div className="px-4 pt-2 pb-4 shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg)]"
           style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {saveError && (
          <p className="text-xs text-red-400 text-center mb-2">{t('parsona.save_error')}</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className={`
            w-full py-4 rounded-2xl font-bold text-sm transition-all
            ${isDirty && !saving
              ? 'bg-[#1e75ff] text-white active:opacity-90'
              : 'bg-[#1e75ff]/30 text-white/40 cursor-default'}
          `}
        >
          {saving ? t('parsona.saving') : isDirty ? t('parsona.save') : t('parsona.save_done')}
        </button>
      </div>

      {/* ── Unsaved changes dialog ───────────────────────────────────────── */}
      {showDiscard && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 pb-8" onClick={() => setShowDiscard(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-[var(--color-glass)] border border-[var(--color-border)] p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <p className="font-bold text-[var(--color-text)]">{t('parsona.unsaved_title')}</p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t('parsona.unsaved_body')}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDiscard(false); onBack(); }}
                className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-400 font-semibold text-sm min-h-[44px] active:opacity-80"
              >
                {t('parsona.unsaved_discard')}
              </button>
              <button
                onClick={() => setShowDiscard(false)}
                className="flex-1 py-3 rounded-xl bg-[#1e75ff] text-white font-semibold text-sm min-h-[44px] active:opacity-90"
              >
                {t('parsona.unsaved_keep')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
