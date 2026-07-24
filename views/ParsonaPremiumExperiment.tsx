import React, { useEffect, useState } from 'react';
import { AvatarCompositeV2 } from '../components/AvatarCompositeV2';
import { loadPremiumPreset, PREMIUM_MVP_PRESETS, premiumPresetLayers, savePremiumPreset, type PremiumPresetId } from '../parsona/v2/premiumMvp';

const asset = (path: string) => `/views/parsona-premium-experiment-assets/${path}`;
export const ParsonaPremiumExperiment: React.FC = () => {
  const [preset, setPreset] = useState<PremiumPresetId>('feminine');
  const [saved, setSaved] = useState(false);
  useEffect(() => setPreset(loadPremiumPreset(localStorage)), []);
  const config = PREMIUM_MVP_PRESETS[preset];
  const preview = (size: number, light = false) => <div className={light ? 'bg-[#f6f0e7]' : 'bg-[#06162D]'}><AvatarCompositeV2 avatar={{ version: 2, ...config }} size={size} resolvedLayers={premiumPresetLayers(preset, asset)} /></div>;
  return <section className="mt-10 rounded-3xl border border-cyan-400/20 bg-slate-950 p-6 text-white">
    <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">DEV only</p><h2 className="mt-2 text-2xl font-bold">Premium MVP Preview</h2>
    <div className="mx-auto mt-5 max-w-sm rounded-3xl border border-white/10 bg-[#071426] p-5 shadow-2xl">
      <div className="flex justify-center">{preview(300)}</div>
      <div className="mt-4 flex justify-center gap-3">{preview(48)}{preview(40)}</div>
      <div className="mt-5 grid grid-cols-2 gap-3">{(['feminine','masculine'] as const).map(id => <button key={id} onClick={() => { setPreset(id); setSaved(false); }} className={`min-h-11 rounded-xl border px-4 capitalize ${preset === id ? 'border-cyan-300 bg-cyan-400/10' : 'border-white/10'}`}>{id}</button>)}</div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">{['Tone 3', config.hair.replace('_',' '), config.top.replace('_',' '), config.accessory?.replace('_',' ') ?? 'none'].map(x => <span key={x} className="rounded-full border border-[#C99343]/40 px-3 py-1 capitalize">{x}</span>)}</div>
      <p className="mt-4 text-sm text-slate-400">More customization options are in development.</p>
      <div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => { setPreset('feminine'); setSaved(false); }} className="min-h-11 rounded-xl border border-white/10">Reset</button><button onClick={() => { savePremiumPreset(localStorage, preset); setSaved(true); }} className="min-h-11 rounded-xl bg-blue-600 font-semibold">Save locally</button></div>
      {saved && <p role="status" className="mt-3 text-center text-sm text-cyan-300">Preset saved locally</p>}
    </div>
    <div className="mt-6 flex flex-wrap gap-4">{preview(180)}{preview(180, true)}{preview(96)}{preview(48)}{preview(40)}</div>
  </section>;
};
