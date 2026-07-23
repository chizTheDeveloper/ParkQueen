// ─── PARSONA ART LAB ──────────────────────────────────────────────────────────
// DEV ONLY — never imported in production.
// Access: http://localhost:5173/?qa=parsona-art-lab
// No Firestore access. All data from local asset manifest.

import React, { useState } from 'react';
import { AvatarComposite } from '../components/AvatarComposite';
import {
  SKINS, FACES, HAIR_STYLES, HAIR_COLORS,
  FACIAL_HAIR, GLASSES, HEADWEAR, OUTFITS, BACKGROUNDS,
  findHeadwear,
} from '../parsona/assets';
import { PARSONA_PRESETS } from '../parsona/presets';
import type {
  AvatarConfig, SkinId, FaceId, HairId, HairColorId,
  FacialHairId, GlassesId, HeadwearId, OutfitId, BackgroundId,
} from '../parsona/types';

const DEFAULT_AVATAR: AvatarConfig = {
  version: 1,
  skin: 'skin_03',
  face: 'face_round',
  hair: 'hair_medium_straight',
  hairColor: 'hair_dark_brown',
  facialHair: null,
  glasses: null,
  headwear: null,
  outfit: 'outfit_tee',
  background: 'bg_navy',
};

// ─── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-2 mb-3 pt-6 border-t border-white/10">
      <h2 className="text-sm font-bold text-white tracking-wide uppercase">{title}</h2>
      {count !== undefined && (
        <span className="text-[10px] text-white/40 font-mono">{count} options</span>
      )}
    </div>
  );
}

function AvatarCard({
  avatar, label, id, sizes = [48, 96], bgClass = 'bg-[#0f1b2d]',
}: {
  avatar: AvatarConfig; label: string; id?: string; sizes?: number[]; bgClass?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/8 min-w-0">
      <div className={`flex items-center gap-3 rounded-lg p-2 ${bgClass}`}>
        {sizes.map(s => (
          <AvatarComposite key={s} avatar={avatar} size={s} aria-label={label} className="rounded-full" />
        ))}
      </div>
      <span className="text-[10px] text-white/60 font-medium text-center leading-tight">{label}</span>
      {id && <span className="text-[9px] text-white/30 font-mono">{id}</span>}
    </div>
  );
}

function ControlSelect<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T | null; label: string }[];
  onChange: (v: T | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-white/50 uppercase tracking-wide font-semibold">{label}</span>
      <select
        value={value ?? '__null__'}
        onChange={e => onChange((e.target.value === '__null__' ? null : e.target.value) as T | null)}
        className="bg-white/10 border border-white/15 rounded-lg text-xs text-white py-1.5 px-2"
      >
        {options.map(o => (
          <option key={String(o.value)} value={o.value ?? '__null__'}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function ParsonaArtLabView() {
  const [draft, setDraft] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [bgVariant, setBgVariant] = useState<'dark' | 'light'>('dark');
  const [previewSizes, setPreviewSizes] = useState<number[]>([48, 96, 160]);

  const bg = bgVariant === 'dark' ? 'bg-[#0a0a12]' : 'bg-[#e8e8f0]';
  const cardBg = bgVariant === 'dark' ? 'bg-[#0f1b2d]' : 'bg-[#d0d8e8]';
  const update = <K extends keyof AvatarConfig>(key: K, val: AvatarConfig[K]) =>
    setDraft(prev => ({ ...prev, [key]: val }));

  const hw = draft.headwear ? findHeadwear(draft.headwear) : null;
  const coversHair = hw?.coversHair ?? false;

  return (
    <div className={`min-h-screen ${bg} text-white`}>

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#060610]/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <div>
            <h1 className="text-sm font-bold text-white">🎨 Parsona Art Lab</h1>
            <p className="text-[10px] text-white/40">DEV ONLY — ?qa=parsona-art-lab</p>
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setBgVariant(v => v === 'dark' ? 'light' : 'dark')}
              className="px-3 py-1.5 text-xs rounded-lg bg-white/10 border border-white/15 text-white/80"
            >
              {bgVariant === 'dark' ? '☀️ Light BG' : '🌙 Dark BG'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-16">

        {/* ── Live preview + controls ──────────────────────────────────────── */}
        <div className="py-6 grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">

          {/* Live preview */}
          <div className="flex flex-col items-center gap-4">
            <div className={`flex items-center gap-4 p-5 rounded-2xl ${cardBg}`}>
              {previewSizes.map(s => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <AvatarComposite avatar={draft} size={s} aria-label="Preview" className="rounded-full" />
                  <span className="text-[9px] text-white/30 font-mono">{s}px</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {([32, 48, 96, 160] as number[]).map(s => (
                <button
                  key={s}
                  onClick={() => setPreviewSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s].sort((a,b) => a-b))}
                  className={`px-2 py-1 text-[10px] rounded font-mono ${previewSizes.includes(s) ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/50'}`}
                >
                  {s}px
                </button>
              ))}
            </div>
          </div>

          {/* Controls grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 content-start">
            <ControlSelect
              label="Skin"
              value={draft.skin}
              options={SKINS.map(s => ({ value: s.id as SkinId, label: `${s.label} (${s.id})` }))}
              onChange={v => v && update('skin', v)}
            />
            <ControlSelect
              label="Face"
              value={draft.face}
              options={FACES.map(f => ({ value: f.id as FaceId, label: `${f.label} (${f.id})` }))}
              onChange={v => v && update('face', v)}
            />
            <ControlSelect
              label="Hair"
              value={draft.hair}
              options={HAIR_STYLES.map(h => ({ value: h.id as HairId, label: `${h.label} (${h.id})` }))}
              onChange={v => v && update('hair', v)}
            />
            <ControlSelect
              label="Hair Color"
              value={draft.hairColor}
              options={HAIR_COLORS.map(c => ({ value: c.id as HairColorId, label: `${c.label} (${c.id})` }))}
              onChange={v => v && update('hairColor', v)}
            />
            <ControlSelect
              label="Facial Hair"
              value={draft.facialHair}
              options={[
                { value: null, label: 'None' },
                ...FACIAL_HAIR.map(f => ({ value: f.id as FacialHairId, label: `${f.label} (${f.id})` })),
              ]}
              onChange={v => update('facialHair', v)}
            />
            <ControlSelect
              label="Glasses"
              value={draft.glasses}
              options={[
                { value: null, label: 'None' },
                ...GLASSES.map(g => ({ value: g.id as GlassesId, label: `${g.label} (${g.id})` })),
              ]}
              onChange={v => update('glasses', v)}
            />
            <ControlSelect
              label="Headwear"
              value={draft.headwear}
              options={[
                { value: null, label: 'None' },
                ...HEADWEAR.map(h => ({ value: h.id as HeadwearId, label: `${h.label}${h.coversHair ? ' ✱' : ''} (${h.id})` })),
              ]}
              onChange={v => update('headwear', v)}
            />
            <ControlSelect
              label="Outfit"
              value={draft.outfit}
              options={OUTFITS.map(o => ({ value: o.id as OutfitId, label: `${o.label} (${o.id})` }))}
              onChange={v => v && update('outfit', v)}
            />
            <ControlSelect
              label="Background"
              value={draft.background}
              options={BACKGROUNDS.map(b => ({ value: b.id as BackgroundId, label: `${b.label} (${b.id})` }))}
              onChange={v => v && update('background', v)}
            />
          </div>
        </div>

        {coversHair && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-xs text-yellow-300">
            ✱ coversHair=true — hair back/front layers hidden; {FACES.find(f => f.id === draft.face)?.label ?? draft.face} face re-rendered on top of headwear
          </div>
        )}

        {/* ── Skin tones ───────────────────────────────────────────────────── */}
        <SectionHeader title="Skin Tones" count={SKINS.length} />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {SKINS.map(s => (
            <AvatarCard
              key={s.id}
              avatar={{ ...draft, skin: s.id as SkinId }}
              label={s.label}
              id={s.id}
              sizes={[48, 96]}
              bgClass={cardBg}
            />
          ))}
        </div>

        {/* ── Face shapes ───────────────────────────────────────────────────── */}
        <SectionHeader title="Face Shapes" count={FACES.length} />
        <div className="grid grid-cols-3 gap-4">
          {FACES.map(f => (
            <AvatarCard
              key={f.id}
              avatar={{ ...draft, face: f.id as FaceId }}
              label={f.label}
              id={f.id}
              sizes={[48, 96, 160]}
              bgClass={cardBg}
            />
          ))}
        </div>

        {/* ── Hair styles ───────────────────────────────────────────────────── */}
        <SectionHeader title="Hair Styles" count={HAIR_STYLES.length} />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {HAIR_STYLES.map(h => (
            <AvatarCard
              key={h.id}
              avatar={{ ...draft, hair: h.id as HairId }}
              label={h.label}
              id={h.id}
              sizes={[48, 96]}
              bgClass={cardBg}
            />
          ))}
        </div>

        {/* ── Hair styles × all hair colors ────────────────────────────────── */}
        <SectionHeader title="Hair Colors" count={HAIR_COLORS.length} />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {HAIR_COLORS.map(c => (
            <AvatarCard
              key={c.id}
              avatar={{ ...draft, hairColor: c.id as HairColorId }}
              label={c.label}
              id={c.id}
              sizes={[48, 96]}
              bgClass={cardBg}
            />
          ))}
        </div>

        {/* ── Facial hair ───────────────────────────────────────────────────── */}
        <SectionHeader title="Facial Hair" count={FACIAL_HAIR.length + 1} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <AvatarCard
            avatar={{ ...draft, facialHair: null }}
            label="None"
            id="null"
            sizes={[48, 96]}
            bgClass={cardBg}
          />
          {FACIAL_HAIR.map(f => (
            <AvatarCard
              key={f.id}
              avatar={{ ...draft, facialHair: f.id as FacialHairId }}
              label={f.label}
              id={f.id}
              sizes={[48, 96]}
              bgClass={cardBg}
            />
          ))}
        </div>

        {/* ── Glasses ───────────────────────────────────────────────────────── */}
        <SectionHeader title="Glasses" count={GLASSES.length + 1} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <AvatarCard
            avatar={{ ...draft, glasses: null }}
            label="None"
            id="null"
            sizes={[48, 96]}
            bgClass={cardBg}
          />
          {GLASSES.map(g => (
            <AvatarCard
              key={g.id}
              avatar={{ ...draft, glasses: g.id as GlassesId }}
              label={g.label}
              id={g.id}
              sizes={[48, 96]}
              bgClass={cardBg}
            />
          ))}
        </div>

        {/* ── Headwear ──────────────────────────────────────────────────────── */}
        <SectionHeader title="Headwear" count={HEADWEAR.length + 1} />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <AvatarCard
            avatar={{ ...draft, headwear: null }}
            label="None"
            id="null"
            sizes={[48, 96]}
            bgClass={cardBg}
          />
          {HEADWEAR.map(h => (
            <AvatarCard
              key={h.id}
              avatar={{ ...draft, headwear: h.id as HeadwearId }}
              label={h.coversHair ? `${h.label} ✱` : h.label}
              id={h.id}
              sizes={[48, 96]}
              bgClass={cardBg}
            />
          ))}
        </div>

        {/* ── Outfits ───────────────────────────────────────────────────────── */}
        <SectionHeader title="Outfits" count={OUTFITS.length} />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {OUTFITS.map(o => (
            <AvatarCard
              key={o.id}
              avatar={{ ...draft, outfit: o.id as OutfitId }}
              label={o.label}
              id={o.id}
              sizes={[48, 96]}
              bgClass={cardBg}
            />
          ))}
        </div>

        {/* ── Backgrounds ───────────────────────────────────────────────────── */}
        <SectionHeader title="Backgrounds" count={BACKGROUNDS.length} />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {BACKGROUNDS.map(b => (
            <AvatarCard
              key={b.id}
              avatar={{ ...draft, background: b.id as BackgroundId }}
              label={b.label}
              id={b.id}
              sizes={[48, 96]}
              bgClass={cardBg}
            />
          ))}
        </div>

        {/* ── All presets ───────────────────────────────────────────────────── */}
        <SectionHeader title="All 8 Presets" count={PARSONA_PRESETS.length} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {PARSONA_PRESETS.map(p => (
            <AvatarCard
              key={p.id}
              avatar={p.avatar}
              label={p.label}
              id={p.id}
              sizes={[48, 96, 160]}
              bgClass={cardBg}
            />
          ))}
        </div>

        {/* ── Combination stress tests ──────────────────────────────────────── */}
        <SectionHeader title="Combination Stress Tests" />
        <p className="text-xs text-white/40 mb-3">All face × skin × hair combinations at 48px. Checks for clipping, z-order issues, and proportions.</p>
        <div className="space-y-4">
          {FACES.map(face => (
            <div key={face.id}>
              <p className="text-[10px] font-bold text-white/50 mb-2 uppercase">{face.label}</p>
              <div className="flex flex-wrap gap-2">
                {SKINS.map(skin => (
                  HAIR_STYLES.slice(0, 5).map(hair => (
                    <AvatarComposite
                      key={`${face.id}-${skin.id}-${hair.id}`}
                      avatar={{ ...DEFAULT_AVATAR, face: face.id as FaceId, skin: skin.id as SkinId, hair: hair.id as HairId }}
                      size={48}
                      aria-label={`${face.label} ${skin.label} ${hair.label}`}
                      className="rounded-full"
                    />
                  ))
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Hair layering stress test ─────────────────────────────────────── */}
        <SectionHeader title="Hair Layering — Back vs Front" />
        <p className="text-xs text-white/40 mb-3">Tests that back-layer strands (braids/locs/long) don't cover the face, and front-layer cap sits correctly.</p>
        <div className="flex flex-wrap gap-3">
          {['hair_braids', 'hair_locs', 'hair_long', 'hair_wavy', 'hair_medium_straight'].map(hId => (
            HAIR_COLORS.map(c => (
              <AvatarComposite
                key={`${hId}-${c.id}`}
                avatar={{ ...DEFAULT_AVATAR, hair: hId as HairId, hairColor: c.id as HairColorId }}
                size={96}
                aria-label={`${hId} ${c.id}`}
                className="rounded-full"
              />
            ))
          ))}
        </div>

        {/* ── Headwear × face × skin ───────────────────────────────────────── */}
        <SectionHeader title="Headwear × Face × Skin" />
        <p className="text-xs text-white/40 mb-3">coversHair variants shown across all face shapes and skin tones.</p>
        <div className="flex flex-wrap gap-3">
          {HEADWEAR.map(hw => (
            FACES.map(face => (
              SKINS.map(skin => (
                <AvatarComposite
                  key={`${hw.id}-${face.id}-${skin.id}`}
                  avatar={{ ...DEFAULT_AVATAR, headwear: hw.id as HeadwearId, face: face.id as FaceId, skin: skin.id as SkinId }}
                  size={64}
                  aria-label={`${hw.label} ${face.label} ${skin.label}`}
                  className="rounded-full"
                />
              ))
            ))
          ))}
        </div>

        {/* ── Glasses × face × skin ────────────────────────────────────────── */}
        <SectionHeader title="Glasses Alignment — All Face × Skin" />
        <div className="flex flex-wrap gap-3">
          {GLASSES.map(gl => (
            FACES.map(face => (
              SKINS.map(skin => (
                <AvatarComposite
                  key={`${gl.id}-${face.id}-${skin.id}`}
                  avatar={{ ...DEFAULT_AVATAR, glasses: gl.id as GlassesId, face: face.id as FaceId, skin: skin.id as SkinId }}
                  size={64}
                  aria-label={`${gl.label} ${face.label}`}
                  className="rounded-full"
                />
              ))
            ))
          ))}
        </div>

        {/* ── Small size (48px) full grid ───────────────────────────────────── */}
        <SectionHeader title="48px Full Grid — All Assets at Production Size" />
        <div className="space-y-3">
          <p className="text-xs text-white/40 -mt-2">This is the size used in option tiles and the HeaderBar. Should all be clearly readable.</p>
          <div className="flex flex-wrap gap-2">
            {HAIR_STYLES.map(h => (
              SKINS.map(s => (
                <AvatarComposite
                  key={`${h.id}-${s.id}`}
                  avatar={{ ...DEFAULT_AVATAR, hair: h.id as HairId, skin: s.id as SkinId }}
                  size={48}
                  aria-label={`${h.label} ${s.label}`}
                  className="rounded-full"
                />
              ))
            ))}
          </div>
        </div>

        <div className="h-20" />
      </div>
    </div>
  );
}
