import React, { useMemo, useState } from 'react';
import { ChevronLeft, RotateCcw, Shuffle } from 'lucide-react';
import { AvatarCompositeV2 } from '../components/AvatarCompositeV2';
import {
  ACCESSORY_IDS,
  BASE_STYLE_IDS,
  DEFAULT_AVATAR_V2,
  HAIR_IDS,
  SKIN_IDS,
  TOP_IDS,
  V2_LABELS,
} from '../parsona/v2/constants';
import { getApprovedOptions } from '../parsona/v2/selectors';
import type { AvatarConfigV2 } from '../parsona/v2/types';

type Category = 'style' | 'tone' | 'hair' | 'extras' | 'top';
type Language = 'en' | 'es';

const CATEGORY_LABELS: Record<Category, Record<Language, string>> = {
  style: { en: 'Style', es: 'Estilo' },
  tone: { en: 'Tone', es: 'Tono' },
  hair: { en: 'Hair', es: 'Cabello' },
  extras: { en: 'Extras', es: 'Extras' },
  top: { en: 'Top', es: 'Prenda' },
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

interface Props {
  language?: Language;
  initialAvatar?: AvatarConfigV2;
  reviewMode?: boolean;
  user?: unknown;
  onBack?: () => void;
}

function approvedRandom(current: AvatarConfigV2): AvatarConfigV2 {
  const approved = {
    skin: getApprovedOptions('skin'),
    hair: getApprovedOptions('hair'),
    accessory: getApprovedOptions('accessory'),
    top: getApprovedOptions('top'),
  };
  if (!approved.skin.length || !approved.hair.length || !approved.top.length) return current;
  const pick = <T,>(values: readonly T[]): T => values[Math.floor(Math.random() * values.length)];
  return {
    ...current,
    baseStyle: pick(BASE_STYLE_IDS),
    skin: pick(approved.skin).id as AvatarConfigV2['skin'],
    hair: pick(approved.hair).id as AvatarConfigV2['hair'],
    accessory: !approved.accessory.length || Math.random() < 0.2
      ? null
      : pick(approved.accessory).id as AvatarConfigV2['accessory'],
    top: pick(approved.top).id as AvatarConfigV2['top'],
  };
}

export function ParsonaV2CreatorView({
  language = 'en',
  initialAvatar = DEFAULT_AVATAR_V2,
  reviewMode = true,
  onBack,
}: Props) {
  const [draft, setDraft] = useState(initialAvatar);
  const [saved] = useState(initialAvatar);
  const [category, setCategory] = useState<Category>('style');
  const [showDiscard, setShowDiscard] = useState(false);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const label = (id: string | null) => V2_LABELS[id ?? 'none'][language];
  const update = <K extends keyof AvatarConfigV2>(key: K, value: AvatarConfigV2[K]) =>
    setDraft(previous => ({ ...previous, [key]: value }));

  const options = category === 'style'
    ? BASE_STYLE_IDS
    : category === 'tone'
      ? SKIN_IDS
      : category === 'hair'
        ? HAIR_IDS
        : category === 'extras'
          ? ACCESSORY_IDS
          : TOP_IDS;

  return (
    <section className="min-h-screen bg-[#030812] text-slate-100 flex flex-col" aria-label="Parsona v2 creator review">
      <header className="px-4 pt-5 pb-3 flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={() => dirty ? setShowDiscard(true) : onBack()}
            className="min-w-11 min-h-11 rounded-full bg-white/10 flex items-center justify-center"
            aria-label={language === 'en' ? 'Back' : 'Atrás'}
          ><ChevronLeft size={20} /></button>
        )}
        <div className="flex-1">
          <h1 className="text-lg font-bold">{language === 'en' ? 'Create your Parsona' : 'Crea tu Parsona'}</h1>
          <p className="text-xs text-slate-400">
            {language === 'en' ? 'Premium artwork review — not public' : 'Revisión de arte prémium — no público'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(approvedRandom(draft))}
          className="min-w-11 min-h-11 rounded-full bg-white/10 flex items-center justify-center"
          aria-label={language === 'en' ? 'Randomize approved options' : 'Opciones aprobadas al azar'}
        ><Shuffle size={18} /></button>
        <button
          type="button"
          onClick={() => setDraft(saved)}
          className="min-w-11 min-h-11 rounded-full bg-white/10 flex items-center justify-center"
          aria-label={language === 'en' ? 'Reset' : 'Restablecer'}
        ><RotateCcw size={18} /></button>
      </header>

      <div className="flex justify-center py-4">
        <AvatarCompositeV2 avatar={draft} size={180} reviewMode={reviewMode} aria-label="Artwork pending" />
      </div>

      <div className="px-4 flex gap-2 overflow-x-auto" role="tablist" aria-label="Parsona categories">
        {CATEGORIES.map(item => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={category === item}
            onClick={() => setCategory(item)}
            className={`min-h-11 px-4 rounded-full font-semibold text-sm ${category === item ? 'bg-blue-600' : 'bg-white/10'}`}
          >
            {CATEGORY_LABELS[item][language]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 flex-1 content-start" role="tabpanel">
        {category === 'style' && (
          <p className="col-span-full text-sm text-slate-300">
            {language === 'en' ? 'Choose your base style' : 'Elige tu estilo base'}
          </p>
        )}
        {options.map(option => {
          const selected = category === 'style' ? draft.baseStyle === option
            : category === 'tone' ? draft.skin === option
              : category === 'hair' ? draft.hair === option
                : category === 'extras' ? draft.accessory === option
                  : draft.top === option;
          return (
            <button
              key={option ?? 'none'}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                if (category === 'style') update('baseStyle', option as AvatarConfigV2['baseStyle']);
                if (category === 'tone') update('skin', option as AvatarConfigV2['skin']);
                if (category === 'hair') update('hair', option as AvatarConfigV2['hair']);
                if (category === 'extras') update('accessory', option as AvatarConfigV2['accessory']);
                if (category === 'top') update('top', option as AvatarConfigV2['top']);
              }}
              className={`min-h-11 rounded-xl border px-3 py-3 text-sm ${selected ? 'border-blue-400 bg-blue-500/20' : 'border-white/10 bg-white/5'}`}
            >
              {label(option)}
              <span className="block text-[10px] text-amber-300 mt-1">
                {language === 'en' ? 'Pending artwork' : 'Arte pendiente'}
              </span>
            </button>
          );
        })}
      </div>

      <footer className="sticky bottom-0 p-4 border-t border-white/10 bg-[#030812]">
        <button
          type="button"
          disabled
          onClick={() => undefined}
          className="w-full min-h-11 rounded-xl bg-blue-600/30 text-white/50 font-bold"
        >
          {dirty ? (language === 'en' ? 'Save unavailable' : 'Guardado no disponible') : (language === 'en' ? 'Saved' : 'Guardado')}
        </button>
      </footer>

      {showDiscard && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center p-4 z-50">
          <div role="dialog" aria-modal="true" aria-label="Unsaved changes" className="w-full max-w-sm rounded-2xl bg-slate-900 p-5">
            <h2 className="font-bold">{language === 'en' ? 'Unsaved changes' : 'Cambios sin guardar'}</h2>
            <p className="text-sm text-slate-400 mt-2">
              {language === 'en' ? 'Discard your review changes?' : '¿Descartar los cambios de revisión?'}
            </p>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button type="button" className="min-h-11 rounded-xl bg-white/10" onClick={() => setShowDiscard(false)}>
                {language === 'en' ? 'Keep editing' : 'Seguir editando'}
              </button>
              <button type="button" className="min-h-11 rounded-xl bg-red-500/20 text-red-300" onClick={onBack}>
                {language === 'en' ? 'Discard' : 'Descartar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
