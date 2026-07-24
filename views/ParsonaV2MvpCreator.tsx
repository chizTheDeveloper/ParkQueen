import React, { useMemo, useState } from 'react';
import { RotateCcw, Save, Shuffle } from 'lucide-react';
import { AvatarCompositeV2 } from '../components/AvatarCompositeV2';
import { BASE_STYLE_IDS, V2_LABELS } from '../parsona/v2/constants';
import {
  MVP_ACCESSORY_IDS,
  MVP_HAIR_IDS,
  MVP_TOP_IDS,
  enumerateMvpCombinations,
  loadMvpDraft,
  randomizeMvpAvatar,
  resetMvpAvatar,
  resolveMvpV2Layers,
  saveMvpDraft,
} from '../parsona/v2/mvp';
import type { AvatarConfigV2 } from '../parsona/v2/types';

type OptionKey = 'baseStyle' | 'hair' | 'top' | 'accessory';

const GROUPS = [
  { key: 'baseStyle', label: 'Base style', options: BASE_STYLE_IDS },
  { key: 'hair', label: 'Hair', options: MVP_HAIR_IDS },
  { key: 'top', label: 'Top', options: MVP_TOP_IDS },
  { key: 'accessory', label: 'Extras', options: MVP_ACCESSORY_IDS },
] as const;
const QA_SAMPLES = [0, 5, 10, 15].map(index => enumerateMvpCombinations()[index]);

function restoredDraftExists(): boolean {
  try {
    return window.localStorage.getItem('parqueen.parsona-v2.mvp-draft') !== null;
  } catch {
    return false;
  }
}

export function ParsonaV2MvpCreator() {
  const [restored] = useState(restoredDraftExists);
  const [draft, setDraft] = useState(() => loadMvpDraft(window.localStorage));
  const [savedMessage, setSavedMessage] = useState(restored ? 'Draft restored locally' : '');
  const layers = useMemo(() => resolveMvpV2Layers(draft), [draft]);

  const update = <K extends OptionKey>(key: K, value: AvatarConfigV2[K]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
    setSavedMessage('');
  };

  return (
    <section
      className="mx-auto w-full max-w-sm overflow-hidden rounded-[28px] border border-cyan-400/25 bg-[#071426] shadow-2xl"
      aria-label="Parsona v2 MVP Creator"
    >
      <header className="border-b border-white/10 px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">DEV-only MVP</p>
        <h2 className="mt-1 text-xl font-bold">MVP Creator</h2>
        <p className="mt-1 text-xs text-slate-400">16 provisional layered combinations</p>
      </header>

      <div className="bg-[#030812] px-5 py-5">
        <div className="flex justify-center">
          <AvatarCompositeV2
            avatar={draft}
            resolvedLayers={layers}
            size={240}
            aria-label="Live layered Parsona MVP preview"
          />
        </div>
        <div className="mt-3 flex items-end justify-center gap-4">
          {[48, 40].map(size => (
            <div key={size} className="text-center">
              <AvatarCompositeV2
                avatar={draft}
                resolvedLayers={layers}
                size={size}
                aria-label={`${size} pixel Parsona preview`}
              />
              <span className="mt-1 block text-[9px] text-slate-500">{size}px</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
          Fixed: Tone 3 · ParQueen navy
        </div>

        {GROUPS.map(group => (
          <fieldset key={group.key}>
            <legend className="mb-2 text-xs font-bold text-slate-300">{group.label}</legend>
            <div className="grid grid-cols-2 gap-2">
              {group.options.map(option => {
                const selected = draft[group.key] === option;
                return (
                  <button
                    key={option ?? 'none'}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => update(group.key, option as never)}
                    className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                      selected
                        ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100'
                        : 'border-white/10 bg-white/5 text-slate-300'
                    }`}
                  >
                    {V2_LABELS[option ?? 'none'].en}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(randomizeMvpAvatar());
              setSavedMessage('');
            }}
            className="min-h-11 rounded-xl bg-white/10 px-3 text-sm font-bold"
          >
            <Shuffle className="mr-2 inline" size={16} />Randomize
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(resetMvpAvatar());
              setSavedMessage('');
            }}
            className="min-h-11 rounded-xl bg-white/10 px-3 text-sm font-bold"
          >
            <RotateCcw className="mr-2 inline" size={16} />Reset
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (saveMvpDraft(window.localStorage, draft)) setSavedMessage('Draft saved locally');
          }}
          className="min-h-12 w-full rounded-xl bg-blue-600 px-4 font-bold text-white"
        >
          <Save className="mr-2 inline" size={17} />Save Draft
        </button>
        <p className="min-h-5 text-center text-xs font-semibold text-emerald-300" role="status">
          {savedMessage}
        </p>

        <div className="border-t border-white/10 pt-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Four-combination QA sample</p>
          <div className="grid grid-cols-4 gap-2">
            {QA_SAMPLES.map(sample => (
              <div key={JSON.stringify(sample)} className="rounded-lg bg-[#030812] p-1.5">
                <AvatarCompositeV2
                  avatar={sample}
                  resolvedLayers={resolveMvpV2Layers(sample)}
                  size={64}
                  aria-label={`${sample.baseStyle} ${sample.hair} ${sample.top} ${sample.accessory ?? 'none'}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ParsonaV2MvpMatrix() {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8" aria-label="All 16 MVP combinations">
      {enumerateMvpCombinations().map((avatar, index) => {
        const layers = resolveMvpV2Layers(avatar);
        return (
          <article
            key={JSON.stringify(avatar)}
            data-mvp-combination={index + 1}
            className="rounded-xl border border-white/10 bg-[#030812] p-3"
          >
            <div className="flex items-end justify-center gap-2">
              <AvatarCompositeV2 avatar={avatar} resolvedLayers={layers} size={96} aria-label={`MVP combination ${index + 1}`} />
              <AvatarCompositeV2 avatar={avatar} resolvedLayers={layers} size={40} aria-label={`MVP combination ${index + 1} at 40 pixels`} />
            </div>
            <p className="mt-2 truncate text-center text-[9px] text-slate-400">
              {avatar.baseStyle} · {avatar.hair} · {avatar.top} · {avatar.accessory ?? 'none'}
            </p>
          </article>
        );
      })}
    </div>
  );
}
