import React, { useEffect, useMemo, useState } from 'react';
import { AvatarCompositeV2 } from '../components/AvatarCompositeV2';
import { ParsonaV2CreatorView } from './ParsonaV2CreatorView';
import { ParsonaV2MvpCreator, ParsonaV2MvpMatrix } from './ParsonaV2MvpCreator';
import { ParsonaPremiumExperiment } from './ParsonaPremiumExperiment';
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
import {
  BATCH_1_ARTWORK_SLOTS,
  PARSONA_V2_REVIEW_SIZES,
  classifyBatch1ArtworkResponse,
  evaluateBatch1Artwork,
} from '../parsona/v2/artworkReview';
import type {
  Batch1ArtworkResult,
  Batch1ArtworkSlot,
} from '../parsona/v2/artworkReview';
import type { AvatarConfigV2 } from '../parsona/v2/types';

const REPRESENTATIVE = enumerateV2Combinations().filter((_, index) => index % 47 === 0).slice(0, 25);
const TONE_03_SLOTS = BATCH_1_ARTWORK_SLOTS.filter(slot => slot.skinToneId === 'tone_03');

type ReviewSurface = 'checkerboard' | 'white' | 'black' | 'navy';
type ReviewLayout = 'individual' | 'compare' | 'overlay' | 'blink' | 'tones';
type InspectionState = Batch1ArtworkResult | { status: 'checking'; errors: string[] };

const SURFACE_STYLES: Record<ReviewSurface, React.CSSProperties> = {
  checkerboard: {
    backgroundColor: '#fff',
    backgroundImage: 'linear-gradient(45deg,#cbd5e1 25%,transparent 25%),linear-gradient(-45deg,#cbd5e1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#cbd5e1 75%),linear-gradient(-45deg,transparent 75%,#cbd5e1 75%)',
    backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
    backgroundSize: '16px 16px',
  },
  white: { background: '#fff' },
  black: { background: '#000' },
  navy: { background: '#06162d' },
};

function PendingScaffold({ size }: { size: number }) {
  return (
    <div
      aria-label="Artwork missing"
      className="grid place-items-center border border-dashed border-amber-400/60 text-amber-300 text-[9px] uppercase tracking-wider"
      style={{ width: size, height: size }}
    >
      Missing
    </div>
  );
}

function ReviewGuides({
  alignment,
  anchors,
  safeZone,
}: {
  alignment: boolean;
  anchors: boolean;
  safeZone: boolean;
}) {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {alignment && (
        <>
          <span className="absolute left-1/2 top-0 bottom-0 border-l border-cyan-300/80" />
          <span className="absolute left-0 right-0 border-t border-cyan-300/80" style={{ top: '38.1%' }} />
        </>
      )}
      {anchors && (
        <>
          <span className="absolute left-0 right-0 border-t border-amber-300/70" style={{ top: '49.8%' }} />
          <span className="absolute left-0 right-0 border-t border-amber-300/70" style={{ top: '58.6%' }} />
          <span className="absolute left-0 right-0 border-t border-amber-300/70" style={{ top: '68.4%' }} />
          <span className="absolute left-0 right-0 border-t border-amber-300/70" style={{ top: '85%' }} />
        </>
      )}
      {safeZone && (
        <span className="absolute rounded-full border border-fuchsia-300/80" style={{ inset: '7%' }} />
      )}
    </div>
  );
}

function AssetPreview({
  slot,
  inspection,
  size,
  surface,
  alignment,
  anchors,
  safeZone,
  alphaBoundary,
}: {
  slot: Batch1ArtworkSlot;
  inspection: InspectionState | undefined;
  size: number;
  surface: ReviewSurface;
  alignment: boolean;
  anchors: boolean;
  safeZone: boolean;
  alphaBoundary: boolean;
}) {
  const canRender = inspection?.status === 'loaded' || inspection?.status === 'invalid';
  return (
    <div className="relative overflow-hidden shrink-0" style={{ width: size, height: size, ...SURFACE_STYLES[surface] }}>
      {canRender ? (
        <img
          src={slot.runtimePath}
          alt={`${slot.assetId} ${slot.baseStyle} artwork`}
          draggable={false}
          style={{
            width: size,
            height: size,
            display: 'block',
            objectFit: 'contain',
            filter: alphaBoundary
              ? 'drop-shadow(1px 0 #ff00ff) drop-shadow(-1px 0 #ff00ff) drop-shadow(0 1px #ff00ff) drop-shadow(0 -1px #ff00ff)'
              : undefined,
          }}
        />
      ) : (
        <PendingScaffold size={size} />
      )}
      <ReviewGuides alignment={alignment} anchors={anchors} safeZone={safeZone} />
    </div>
  );
}

function Preview({ avatar, size }: { avatar: AvatarConfigV2; size: number }) {
  return (
    <div className="rounded-full overflow-hidden ring-1 ring-white/15">
      <AvatarCompositeV2 avatar={avatar} size={size} reviewMode aria-label="Artwork pending" />
    </div>
  );
}

export function ParsonaV2LabView() {
  const validity = validateAllV2Combinations();
  const [inspections, setInspections] = useState<Record<string, InspectionState>>({});
  const [surface, setSurface] = useState<ReviewSurface>('checkerboard');
  const [layout, setLayout] = useState<ReviewLayout>('tones');
  const [selectedSlotId, setSelectedSlotId] = useState(TONE_03_SLOTS[0].slotId);
  const [alignment, setAlignment] = useState(true);
  const [anchors, setAnchors] = useState(true);
  const [safeZone, setSafeZone] = useState(true);
  const [alphaBoundary, setAlphaBoundary] = useState(false);
  const [blinkRunning, setBlinkRunning] = useState(false);
  const [blinkFrame, setBlinkFrame] = useState(0);

  useEffect(() => {
    if (layout !== 'blink' || !blinkRunning) return undefined;
    const timer = window.setInterval(() => setBlinkFrame(frame => (frame + 1) % 2), 450);
    return () => window.clearInterval(timer);
  }, [layout, blinkRunning]);

  useEffect(() => {
    let cancelled = false;
    setInspections(Object.fromEntries(
      BATCH_1_ARTWORK_SLOTS.map(slot => [slot.slotId, { status: 'checking', errors: [] }]),
    ));

    Promise.all(BATCH_1_ARTWORK_SLOTS.map(async slot => {
      try {
        const response = await fetch(slot.runtimePath, { cache: 'no-store' });
        if (classifyBatch1ArtworkResponse(response.ok, response.headers.get('content-type')) === 'missing') {
          return [slot.slotId, evaluateBatch1Artwork(slot, null)] as const;
        }
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          bitmap.close();
          return [slot.slotId, { status: 'invalid', errors: ['Canvas inspection unavailable'] }] as const;
        }
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
        let hasTransparency = false;
        let hasVisiblePixels = false;
        for (let index = 3; index < pixels.length; index += 4) {
          if (pixels[index] < 255) hasTransparency = true;
          if (pixels[index] > 0) hasVisiblePixels = true;
          if (hasTransparency && hasVisiblePixels) break;
        }
        const metadata = {
          width: bitmap.width,
          height: bitmap.height,
          byteLength: blob.size,
          hasTransparency,
          hasVisiblePixels,
        };
        bitmap.close();
        return [slot.slotId, evaluateBatch1Artwork(slot, metadata)] as const;
      } catch {
        return [slot.slotId, { status: 'invalid', errors: ['File could not be decoded'] }] as const;
      }
    })).then(results => {
      if (!cancelled) setInspections(Object.fromEntries(results));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = [
    ['Base styles', BASE_STYLE_IDS],
    ['Skin tones', SKIN_IDS],
    ['Hairstyles', HAIR_IDS],
    ['Accessories', ACCESSORY_IDS],
    ['Tops', TOP_IDS],
  ] as const;
  const selectedSlot = BATCH_1_ARTWORK_SLOTS.find(slot => slot.slotId === selectedSlotId)!;
  const displayedSlots = useMemo(() => {
    if (layout === 'individual') return [selectedSlot];
    if (layout === 'overlay' || layout === 'blink') return TONE_03_SLOTS;
    if (layout === 'compare') {
      if (!selectedSlot.skinToneId) return [selectedSlot];
      return BATCH_1_ARTWORK_SLOTS.filter(slot => slot.skinToneId === selectedSlot.skinToneId);
    }
    return BATCH_1_ARTWORK_SLOTS.filter(slot => slot.baseStyle !== 'shared');
  }, [layout, selectedSlot]);

  return (
    <main className="min-h-screen bg-[#030812] text-slate-100 p-4 sm:p-6">
      <header className="max-w-7xl mx-auto mb-8">
        <p className="text-xs font-bold tracking-[0.18em] text-cyan-400">DEV ONLY · ?qa=parsona-v2-lab</p>
        <h1 className="text-2xl font-bold mt-2">Minimal Premium Parsona v2 Review Lab</h1>
        <p className="text-sm text-slate-400 mt-2">
          Neutral scaffolding marks professional layers still pending. No reference-board portraits are included.
        </p>
        <div className="mt-4 inline-flex flex-wrap gap-4 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm">
          <span>{validity.valid.toLocaleString()} / {PARSONA_V2_COMBINATION_COUNT.toLocaleString()} valid</span>
          <span className="text-amber-300">{PARSONA_V2_MANIFEST.filter(item => item.status === 'pending').length} manifest options pending</span>
          <span>Batch 1: {BATCH_1_ARTWORK_SLOTS.length} runtime + 11 masters</span>
        </div>
      </header>

      <section className="max-w-7xl mx-auto space-y-8">
        <div className="rounded-2xl border border-blue-400/20 bg-white/[0.02] p-4 sm:p-6">
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-400">Functional MVP workspace</p>
            <h2 className="mt-1 text-xl font-bold">Test the 16 working combinations</h2>
            <p className="mt-1 text-sm text-slate-400">Drafts stay in this browser. No account, profile, or remote data write occurs.</p>
          </div>
          <ParsonaV2MvpCreator />
          <ParsonaV2MvpMatrix />
          <ParsonaPremiumExperiment />
        </div>

        <div className="rounded-2xl border border-cyan-400/20 bg-[#071426] p-4 sm:p-6">
          <div className="flex flex-col gap-1 mb-5">
            <p className="text-[11px] font-bold tracking-[0.16em] text-cyan-400 uppercase">Batch 1 artwork intake</p>
            <h2 className="text-xl font-bold">Background and base-layer review</h2>
            <p className="text-sm text-slate-400">The lab reads the exact local manifest paths. Missing files remain missing and cannot be approved here.</p>
          </div>

          <div className="grid xl:grid-cols-[300px_1fr] gap-6">
            <aside className="space-y-4">
              <label className="block text-xs font-semibold text-slate-300">
                Individual asset
                <select
                  value={selectedSlotId}
                  onChange={event => setSelectedSlotId(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-[#0b1b31] px-3 text-sm"
                >
                  {BATCH_1_ARTWORK_SLOTS.map(slot => (
                    <option key={slot.slotId} value={slot.slotId}>{slot.slotId}</option>
                  ))}
                </select>
              </label>

              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2">Review layout</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['individual', 'compare', 'overlay', 'blink', 'tones'] as const).map(value => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setLayout(value)}
                      className={`min-h-11 rounded-lg px-2 text-xs capitalize ${layout === value ? 'bg-cyan-500 text-slate-950' : 'bg-white/5 text-slate-300'}`}
                    >
                      {value === 'compare' ? 'F / M' : value === 'overlay' ? '50% overlay' : value === 'tones' ? 'All tones' : value}
                    </button>
                  ))}
                </div>
                {layout === 'blink' && (
                  <button
                    type="button"
                    onClick={() => setBlinkRunning(running => !running)}
                    className="mt-2 min-h-11 w-full rounded-lg bg-white/5 px-3 text-xs"
                  >
                    {blinkRunning ? 'Pause rapid blink' : 'Start rapid blink'}
                  </button>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2">Review background</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['checkerboard', 'white', 'black', 'navy'] as const).map(value => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSurface(value)}
                      className={`min-h-11 rounded-lg px-3 text-xs capitalize ${surface === value ? 'ring-2 ring-cyan-400 bg-white/15' : 'bg-white/5'}`}
                    >
                      {value === 'navy' ? 'Production navy' : value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {[
                  ['Alignment guides', alignment, setAlignment],
                  ['Head / torso anchors', anchors, setAnchors],
                  ['Safe-zone overlay', safeZone, setSafeZone],
                  ['Alpha boundary', alphaBoundary, setAlphaBoundary],
                ].map(([label, checked, setter]) => (
                  <label key={label as string} className="min-h-11 flex items-center justify-between rounded-lg bg-white/5 px-3 text-xs">
                    {label as string}
                    <input
                      type="checkbox"
                      checked={checked as boolean}
                      onChange={event => (setter as React.Dispatch<React.SetStateAction<boolean>>)(event.target.checked)}
                      className="h-5 w-5 accent-cyan-400"
                    />
                  </label>
                ))}
              </div>
            </aside>

            <div className="min-w-0 space-y-5">
              {(layout === 'overlay' || layout === 'blink') && displayedSlots.length === 2 ? (
                <article className="rounded-xl border border-white/10 bg-black/20 p-3 w-fit">
                  <div
                    className="relative overflow-hidden"
                    style={{ width: 180, height: 180, ...SURFACE_STYLES[surface] }}
                    aria-label={layout === 'overlay' ? 'Feminine and Masculine tone 03 at 50 percent overlay' : `Rapid comparison showing ${displayedSlots[blinkFrame].baseStyle}`}
                  >
                    {(layout === 'overlay' ? displayedSlots : [displayedSlots[blinkFrame]]).map((slot, index) => (
                      <img
                        key={slot.slotId}
                        src={slot.runtimePath}
                        alt=""
                        draggable={false}
                        className="absolute inset-0 h-full w-full object-contain"
                        style={{
                          opacity: layout === 'overlay' && index === 1 ? 0.5 : 1,
                          filter: alphaBoundary
                            ? 'drop-shadow(1px 0 #ff00ff) drop-shadow(-1px 0 #ff00ff) drop-shadow(0 1px #ff00ff) drop-shadow(0 -1px #ff00ff)'
                            : undefined,
                        }}
                      />
                    ))}
                    <ReviewGuides alignment={alignment} anchors={anchors} safeZone={safeZone} />
                  </div>
                  <p className="mt-3 text-xs font-bold">tone_03 canonical alignment</p>
                  <p className="text-[10px] text-slate-400">{layout === 'overlay' ? 'Masculine at 50% opacity over Feminine' : blinkRunning ? 'Alternating every 450 ms' : 'Blink paused'}</p>
                </article>
              ) : (
                <div className={layout === 'tones' ? 'grid grid-cols-2 md:grid-cols-5 gap-3' : 'flex flex-wrap gap-4'}>
                  {displayedSlots.map(slot => (
                  <article key={slot.slotId} className="rounded-xl border border-white/10 bg-black/20 p-3 min-w-0">
                    <div className="flex justify-center">
                      <AssetPreview
                        slot={slot}
                        inspection={inspections[slot.slotId]}
                        size={layout === 'tones' ? 120 : 180}
                        surface={surface}
                        alignment={alignment}
                        anchors={anchors}
                        safeZone={safeZone}
                        alphaBoundary={alphaBoundary}
                      />
                    </div>
                    <p className="mt-3 text-xs font-bold break-all">{slot.assetId} · {slot.baseStyle}</p>
                    <p className="text-[10px] text-slate-400">{slot.skinToneId ?? 'fixed background'}</p>
                    <p className={`text-[10px] font-bold mt-1 ${inspections[slot.slotId]?.status === 'loaded' ? 'text-emerald-300' : inspections[slot.slotId]?.status === 'invalid' ? 'text-red-300' : 'text-amber-300'}`}>
                      {inspections[slot.slotId]?.status ?? 'checking'}
                    </p>
                  </article>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <h3 className="text-sm font-bold">Canonical tone_03 measured differences</h3>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  {[
                    ['Outer skull bounds', '0 px'],
                    ['Eye line', '0 px'],
                    ['Chin position', '0 px'],
                    ['Ear bounds', '0 px'],
                    ['Neck anchor', '0 px'],
                    ['Lower termination', '0 px'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-white/5 p-3">
                      <span className="block text-slate-400">{label}</span>
                      <strong className="text-emerald-300">{value}</strong>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-slate-400">
                   Shared canvas: 1024×1024 · visible alpha bounds: x 255–768, y 108–869.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-xs">
                  <thead className="bg-white/5 text-slate-400">
                    <tr>
                      <th className="p-3">Asset / style / tone</th>
                      <th className="p-3">Master filename</th>
                      <th className="p-3">Runtime manifest path</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Dimensions</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Alpha contract</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BATCH_1_ARTWORK_SLOTS.map(slot => {
                      const result = inspections[slot.slotId];
                      return (
                        <tr key={slot.slotId} className="border-t border-white/10 align-top">
                          <td className="p-3"><strong>{slot.assetId}</strong><br />{slot.baseStyle} · {slot.skinToneId ?? 'n/a'}</td>
                          <td className="p-3 font-mono">{slot.masterPath}</td>
                          <td className="p-3 font-mono break-all">{slot.runtimePath}</td>
                          <td className="p-3 font-bold">{result?.status ?? 'checking'}{result?.errors.length ? <span className="block font-normal text-red-300 mt-1">{result.errors.join(' · ')}</span> : null}</td>
                          <td className="p-3">{result && 'width' in result ? `${result.width}×${result.height}` : '—'}</td>
                          <td className="p-3">{result && 'byteLength' in result ? `${(result.byteLength / 1024).toFixed(1)} KiB` : '—'}</td>
                          <td className="p-3">{result && 'hasTransparency' in result ? (result.hasTransparency ? 'transparent' : 'opaque') : (slot.requiresTransparency ? 'requires alpha' : 'must be opaque')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-sm font-bold mb-3">Runtime-size review · {selectedSlot.slotId}</h3>
                <div className="flex flex-wrap items-end gap-4">
                  {PARSONA_V2_REVIEW_SIZES.map(size => (
                    <div key={size} className="text-center">
                      <AssetPreview
                        slot={selectedSlot}
                        inspection={inspections[selectedSlot.slotId]}
                        size={size}
                        surface={surface}
                        alignment={alignment}
                        anchors={anchors}
                        safeZone={safeZone}
                        alphaBoundary={alphaBoundary}
                      />
                      <p className="mt-1 text-[10px] text-slate-400">{size}px</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-bold mb-3">Feminine and Masculine variants</h2>
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
                  <div className="flex justify-center"><Preview avatar={REPRESENTATIVE[0]} size={96} /></div>
                  <p className="text-xs font-semibold mt-2">{V2_LABELS[option ?? 'none'].en}</p>
                  <p className="text-[10px] text-slate-500">{V2_LABELS[option ?? 'none'].es}</p>
                  <p className="text-[10px] text-amber-300 mt-1">{option === null ? 'no layer' : 'pending'}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

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
