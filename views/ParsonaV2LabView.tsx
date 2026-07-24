import React from 'react';
import { AvatarCompositeV2 } from '../components/AvatarCompositeV2';
import { ParsonaV2CreatorView } from './ParsonaV2CreatorView';
import {
  ACCESSORY_IDS,
  BASE_STYLE_IDS,
  HAIR_IDS,
  PARSONA_V2_COMBINATION_COUNT,
  SKIN_IDS,
  TOP_IDS,
  V2_LABELS,
} from '../parsona/v2/constants';
import { enumerateV2Combinations, validateAllV2Combinations } from '../parsona/v2/combinations';
import { PARSONA_V2_MANIFEST } from '../parsona/v2/manifest';
import type { AvatarConfigV2 } from '../parsona/v2/types';

const SIZES = [180, 120, 96, 48, 40] as const;
const REPRESENTATIVE = enumerateV2Combinations().filter((_, index) => index % 47 === 0).slice(0, 25);

function Preview({ avatar, size }: { avatar: AvatarConfigV2; size: number }) {
  return (
    <div className="rounded-full overflow-hidden ring-1 ring-white/15">
      <AvatarCompositeV2 avatar={avatar} size={size} reviewMode aria-label="Artwork pending" />
    </div>
  );
}
export function ParsonaV2LabView() {
  const validity = validateAllV2Combinations();
  const categories = [
    ['Base styles', BASE_STYLE_IDS],
    ['Skin tones', SKIN_IDS],
    ['Hairstyles', HAIR_IDS],
    ['Accessories', ACCESSORY_IDS],
    ['Tops', TOP_IDS],
  ] as const;

  return (
    <main className="min-h-screen bg-[#030812] text-slate-100 p-4 sm:p-6">
      <header className="max-w-7xl mx-auto mb-8">
        <p className="text-xs font-bold tracking-[0.18em] text-cyan-400">DEV ONLY · ?qa=parsona-v2-lab</p>
        <h1 className="text-2xl font-bold mt-2">Minimal Premium Parsona v2 Review Lab</h1>
        <p className="text-sm text-slate-400 mt-2">
          Neutral silhouettes mark professional layers still pending. No reference-board portraits are included.
        </p>
        <div className="mt-4 inline-flex gap-4 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm">
          <span>{validity.valid.toLocaleString()} / {PARSONA_V2_COMBINATION_COUNT.toLocaleString()} valid</span>
          <span className="text-amber-300">{PARSONA_V2_MANIFEST.filter(item => item.status === 'pending').length} assets pending</span>
        </div>
      </header>

      <section className="max-w-7xl mx-auto space-y-8">
        <div>
          <h2 className="font-bold mb-3">Feminine and masculine variants</h2>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            {BASE_STYLE_IDS.map(baseStyle => (
              <div key={baseStyle} className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
                <Preview avatar={{ ...REPRESENTATIVE[0], baseStyle }} size={180} />
                <p className="mt-3 font-semibold">{V2_LABELS[baseStyle].en}</p>
                <p className="text-xs text-amber-300">pending</p>
              </div>
            ))}
          </div>
        </div>

        {categories.map(([title, options]) => (
          <div key={title}>
            <h2 className="font-bold mb-3">{title}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {options.map(option => (
                <div key={option ?? 'none'} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                  <div className="flex justify-center">
                    <Preview avatar={REPRESENTATIVE[0]} size={96} />
                  </div>
                  <p className="text-xs font-semibold mt-2">{V2_LABELS[option ?? 'none'].en}</p>
                  <p className="text-[10px] text-slate-500">{V2_LABELS[option ?? 'none'].es}</p>
                  <p className="text-[10px] text-amber-300 mt-1">{option === null ? 'no layer' : 'pending'}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div>
          <h2 className="font-bold mb-3">Size and circular-crop review</h2>
          <div className="flex flex-wrap items-end gap-6 rounded-2xl bg-[#071b36] p-5">
            {SIZES.map(size => (
              <div key={size} className="text-center">
                <Preview avatar={REPRESENTATIVE[0]} size={size} />
                <p className="text-[10px] text-slate-400 mt-2">{size}px</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-bold mb-3">25 representative combinations</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {REPRESENTATIVE.map((avatar, index) => (
              <div key={JSON.stringify(avatar)} className="rounded-xl bg-white/5 p-3 text-center">
                <div className="flex justify-center"><Preview avatar={avatar} size={96} /></div>
                <p className="text-[10px] text-slate-500 mt-2">Combination {index + 1}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-bold mb-3">Dormant creator review</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            <ParsonaV2CreatorView language="en" reviewMode />
            <ParsonaV2CreatorView language="es" reviewMode />
          </div>
        </div>
      </section>
    </main>
  );
}
