// ─── Parsona asset manifest ───────────────────────────────────────────────────
// All SVG data lives here as authored strings. Replace asset data to swap art.
// `COLOR` token is replaced by AvatarComposite with the selected hex color.
// ViewBox: 0 0 100 100. Circle-clipped at cx=50 cy=50 r=50 by consumer.
//
// Geometry constants (same across ALL face shapes):
//   Eyes (almond):  left cx=42 cy=37   right cx=58 cy=37   (10×7 px)
//   Brows:          left peak (42,27)   right peak (58,27)
//   Nose hint:      cx=50  y≈46-49
//   Mouth:          endpoints y=53.5   center dip y=57
//
// Face-specific:
//   face_round   head center cy=40  rx=ry=24  neck x=43..57  ears cx=26/74
//   face_oval    head center cy=39  rx=19 ry=27  neck x=44..56  ears cx=31/69
//   face_angular head path  widest at cheekbone y=44 x=27/73  neck x=45..55  ears cx=24/76
//
// Layer render order (AvatarComposite):
//   background → hair_back → outfit → face/skin → face_features →
//   facial_hair → hair_front → glasses → headwear
//   [coversHair: headwear → face.svg(skin) → features → facial_hair → glasses]

import type {
  SkinId, FaceId, HairId, HairColorId,
  FacialHairId, GlassesId, HeadwearId, OutfitId, BackgroundId,
} from './types';

// ── Background ─────────────────────────────────────────────────────────────────
export interface BackgroundDef {
  id: BackgroundId;
  label: string; labelEs: string;
  color: string;
}
export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'bg_navy',     label: 'Navy',        labelEs: 'Azul marino',   color: '#0e1f3d' },
  { id: 'bg_midnight', label: 'Midnight',    labelEs: 'Medianoche',    color: '#080814' },
  { id: 'bg_teal',     label: 'Deep Teal',   labelEs: 'Verde profundo', color: '#082828' },
  { id: 'bg_charcoal', label: 'Charcoal',    labelEs: 'Carbón',        color: '#1c1c24' },
  { id: 'bg_purple',   label: 'Deep Purple', labelEs: 'Morado',        color: '#15082c' },
  { id: 'bg_gold',     label: 'Royal Blue',  labelEs: 'Azul real',     color: '#0e2056' },
];

// ── Skin tone ──────────────────────────────────────────────────────────────────
export interface SkinDef {
  id: SkinId;
  label: string; labelEs: string;
  color: string;
}
export const SKINS: SkinDef[] = [
  { id: 'skin_01', label: 'Tone 1', labelEs: 'Tono 1', color: '#FCEBD8' },
  { id: 'skin_02', label: 'Tone 2', labelEs: 'Tono 2', color: '#F2C9A0' },
  { id: 'skin_03', label: 'Tone 3', labelEs: 'Tono 3', color: '#D4946B' },
  { id: 'skin_04', label: 'Tone 4', labelEs: 'Tono 4', color: '#B5693C' },
  { id: 'skin_05', label: 'Tone 5', labelEs: 'Tono 5', color: '#7D4520' },
  { id: 'skin_06', label: 'Tone 6', labelEs: 'Tono 6', color: '#3E1F0E' },
];

// ── Face shape ─────────────────────────────────────────────────────────────────
// Three shapes with clearly distinct jaw/cheek/chin/ear/neck geometry.
// Ears are drawn FIRST (behind head) so they peek out naturally at the sides.
// All share the same FACE_FEATURES_SVG coordinate system.
export interface FaceDef {
  id: FaceId;
  label: string; labelEs: string;
  svg: string;
}
export const FACES: FaceDef[] = [
  {
    id: 'face_round',
    label: 'Round', labelEs: 'Redondo',
    // Nearly circular head (rx≈ry=24), widest cheeks, full rounded jaw, wide neck.
    // Ears at the very edge of the circle. Clearly the "softest" shape.
    svg: `<ellipse cx="26" cy="41" rx="4" ry="5.5" fill="COLOR"/>
<ellipse cx="74" cy="41" rx="4" ry="5.5" fill="COLOR"/>
<ellipse cx="50" cy="40" rx="24" ry="24" fill="COLOR"/>
<rect x="43" y="62" width="14" height="12" rx="5" fill="COLOR"/>`,
  },
  {
    id: 'face_oval',
    label: 'Oval', labelEs: 'Ovalado',
    // Classic egg-shaped head (rx=19, ry=27) — taller than wide, tapers to chin.
    // Standard ears, medium neck. Balanced/default proportions.
    svg: `<ellipse cx="31" cy="40" rx="3.5" ry="5.5" fill="COLOR"/>
<ellipse cx="69" cy="40" rx="3.5" ry="5.5" fill="COLOR"/>
<ellipse cx="50" cy="39" rx="19" ry="27" fill="COLOR"/>
<rect x="44" y="64" width="12" height="10" rx="3" fill="COLOR"/>`,
  },
  {
    id: 'face_angular',
    label: 'Angular', labelEs: 'Angular',
    // Cheekbones are the widest point (x=27/73 at y=44), then the jaw sweeps
    // sharply inward to a defined chin at y=68. Narrow neck, ears at cheekbone height.
    svg: `<ellipse cx="24" cy="42" rx="3" ry="5" fill="COLOR"/>
<ellipse cx="76" cy="42" rx="3" ry="5" fill="COLOR"/>
<path d="M30 38 Q30 14 50 13 Q70 14 70 38 L73 44 Q70 56 60 64 Q55 68 50 68 Q45 68 40 64 Q30 56 27 44 Z" fill="COLOR"/>
<rect x="45" y="65" width="10" height="11" rx="2" fill="COLOR"/>`,
  },
];

// ── Face features (shared across all face shapes) ─────────────────────────────
// Almond eyes 10×7 px at cx=42/58 cy=37. Brows at peak y=27.
// Mouth: restrained 3.5-unit dip (mature, not cartoon).
// Nose: very faint nostril hint at 25% opacity.
export const FACE_FEATURES_SVG = `
<path d="M36 30 Q42 27 48 30" fill="none" stroke="#1a1020" stroke-width="2.1" stroke-linecap="round"/>
<path d="M52 30 Q58 27 64 30" fill="none" stroke="#1a1020" stroke-width="2.1" stroke-linecap="round"/>
<path d="M37 37 Q42 33.5 47 37 Q42 40.5 37 37 Z" fill="#1a1020"/>
<path d="M53 37 Q58 33.5 63 37 Q58 40.5 53 37 Z" fill="#1a1020"/>
<ellipse cx="44" cy="35.5" rx="1.5" ry="1.2" fill="rgba(255,255,255,0.65)"/>
<ellipse cx="60" cy="35.5" rx="1.5" ry="1.2" fill="rgba(255,255,255,0.65)"/>
<path d="M47.5 46 Q50 49 52.5 46" fill="none" stroke="#1a1020" stroke-width="1.3" stroke-linecap="round" opacity="0.25"/>
<path d="M44 53.5 Q50 57 56 53.5" fill="none" stroke="#1a1020" stroke-width="2.2" stroke-linecap="round"/>
`;

// ── Hair ───────────────────────────────────────────────────────────────────────
// back  → renders BEHIND face/skin. Halo, hanging strands, long sides go here.
// front → renders ABOVE outfit/facial-hair. Scalp cap + any front-over-shoulder
//         strands live here so they correctly layer over clothing.
// COLOR → hairColor hex.
export interface HairDef {
  id: HairId;
  label: string; labelEs: string;
  back?: string;
  front: string;
}
export const HAIR_STYLES: HairDef[] = [
  {
    id: 'hair_short',
    label: 'Short', labelEs: 'Corto',
    // Close-cropped cap following the head curve with a natural hairline dip.
    front: `<path d="M28 43 Q27 15 50 13 Q73 15 72 43 Q65 36 58 35 Q54 34 50 34 Q46 34 42 35 Q35 36 28 43 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_medium_straight',
    label: 'Straight, Medium', labelEs: 'Liso, medio',
    // Back layer: sides fall to mid-neck. Front layer: scalp cap + two thin
    // strands that render ABOVE the outfit to simulate hair over shoulders.
    back: `<path d="M28 43 L24 70 Q24 79 30 81 L32 45 Q31 17 50 15 Q69 17 68 45 L70 81 Q76 79 76 70 L72 43 Q72 15 50 13 Q28 15 28 43 Z" fill="COLOR"/>`,
    front: `<path d="M28 43 Q27 17 50 15 Q73 17 72 43 Q63 37 50 36 Q37 37 28 43 Z" fill="COLOR"/>
<path d="M29 46 C27 58 26 68 28 75 Q29 78 32 77 C32 65 31 55 29 46 Z" fill="COLOR"/>
<path d="M71 46 C73 58 74 68 72 75 Q71 78 68 77 C68 65 69 55 71 46 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_long',
    label: 'Straight, Long', labelEs: 'Liso, largo',
    // Back: long sides to shoulder. Front: front strands render over outfit.
    back: `<path d="M27 43 L21 82 Q21 92 30 94 L32 44 Q31 17 50 15 Q69 17 68 44 L70 94 Q79 92 79 82 L73 43 Q73 15 50 13 Q27 15 27 43 Z" fill="COLOR"/>`,
    front: `<path d="M28 43 Q27 17 50 15 Q73 17 72 43 Q63 37 50 36 Q37 37 28 43 Z" fill="COLOR"/>
<path d="M29 46 C27 62 25 76 24 88 Q25 92 28 91 C29 79 30 65 30 46 Z" fill="COLOR"/>
<path d="M71 46 C73 62 75 76 76 88 Q75 92 72 91 C71 79 70 65 70 46 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_short_curly',
    label: 'Short Curly', labelEs: 'Rizado corto',
    // Irregular cluster of overlapping circles for natural curl texture.
    front: `<ellipse cx="50" cy="25" rx="24" ry="14" fill="COLOR"/>
<circle cx="30" cy="26" r="9" fill="COLOR"/>
<circle cx="43" cy="17" r="10" fill="COLOR"/>
<circle cx="57" cy="17" r="10" fill="COLOR"/>
<circle cx="70" cy="26" r="9" fill="COLOR"/>
<circle cx="50" cy="13" r="9" fill="COLOR"/>
<circle cx="36" cy="20" r="7" fill="COLOR"/>
<circle cx="64" cy="20" r="7" fill="COLOR"/>
<circle cx="50" cy="19" r="6" fill="COLOR"/>`,
  },
  {
    id: 'hair_afro',
    label: 'Afro', labelEs: 'Afro',
    // Full halo in back so face renders on top. Large irregular silhouette.
    back: `<ellipse cx="50" cy="29" rx="36" ry="30" fill="COLOR"/>
<circle cx="22" cy="34" r="14" fill="COLOR"/>
<circle cx="78" cy="34" r="14" fill="COLOR"/>
<circle cx="50" cy="9" r="16" fill="COLOR"/>
<circle cx="32" cy="15" r="11" fill="COLOR"/>
<circle cx="68" cy="15" r="11" fill="COLOR"/>`,
    front: ``,
  },
  {
    id: 'hair_locs',
    label: 'Locs', labelEs: 'Rastas',
    // Tapered tube paths (not rectangles). Knot-shadow ellipses suggest loc texture.
    back: `<path d="M28 43 L25 70 Q25 79 31 81 L33 45 Q32 18 50 16 Q68 18 67 45 L69 81 Q75 79 75 70 L72 43 Q72 16 50 14 Q28 16 28 43 Z" fill="COLOR"/>
<path d="M18 53 C17 65 17 77 19 86 Q20 89 24 88 C27 79 27 67 25 53 Q24 50 21 50 Q18 50 18 53 Z" fill="COLOR"/>
<path d="M74 53 C73 65 73 77 75 86 Q76 89 80 88 C83 79 83 67 81 53 Q80 50 77 50 Q74 50 74 53 Z" fill="COLOR"/>
<path d="M27 60 C26 68 26 76 28 83 Q29 85 32 84 C34 77 34 69 32 60 Q31 58 29 58 Q27 58 27 60 Z" fill="COLOR"/>
<path d="M65 60 C64 68 64 76 66 83 Q67 85 70 84 C72 77 72 69 70 60 Q69 58 67 58 Q65 58 65 60 Z" fill="COLOR"/>
<ellipse cx="21.5" cy="64" rx="4.5" ry="2.5" fill="rgba(0,0,0,0.1)"/>
<ellipse cx="21.5" cy="73" rx="4.5" ry="2.5" fill="rgba(0,0,0,0.1)"/>
<ellipse cx="21.5" cy="82" rx="4.5" ry="2.5" fill="rgba(0,0,0,0.1)"/>
<ellipse cx="78.5" cy="64" rx="4.5" ry="2.5" fill="rgba(0,0,0,0.1)"/>
<ellipse cx="78.5" cy="73" rx="4.5" ry="2.5" fill="rgba(0,0,0,0.1)"/>
<ellipse cx="78.5" cy="82" rx="4.5" ry="2.5" fill="rgba(0,0,0,0.1)"/>
<ellipse cx="29.5" cy="69" rx="3.5" ry="2" fill="rgba(0,0,0,0.08)"/>
<ellipse cx="29.5" cy="77" rx="3.5" ry="2" fill="rgba(0,0,0,0.08)"/>
<ellipse cx="68.5" cy="69" rx="3.5" ry="2" fill="rgba(0,0,0,0.08)"/>
<ellipse cx="68.5" cy="77" rx="3.5" ry="2" fill="rgba(0,0,0,0.08)"/>`,
    front: `<path d="M28 43 Q27 16 50 14 Q73 16 72 43 Q63 37 50 36 Q37 37 28 43 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_braids',
    label: 'Braids', labelEs: 'Trenzas',
    // Tapered tube side strands + chevron weave marks + center part line on scalp.
    back: `<path d="M28 43 L25 67 Q25 76 31 79 L33 45 Q32 17 50 15 Q68 17 67 45 L69 79 Q75 76 75 67 L72 43 Q72 15 50 13 Q28 15 28 43 Z" fill="COLOR"/>
<path d="M21 52 C20 63 20 73 22 81 Q23 84 26.5 83 C29 75 29 65 27 52 Q26 49 23 49 Q21 49 21 52 Z" fill="COLOR"/>
<path d="M73 52 C71 63 71 73 73 81 Q74 84 77.5 83 C80 75 80 65 78 52 Q77 49 75 49 Q73 49 73 52 Z" fill="COLOR"/>
<path d="M21.5 57 Q24 55 26.5 57 M21.5 62 Q24 60 26.5 62 M21.5 67 Q24 65 26.5 67 M21.5 72 Q24 70 26.5 72 M21.5 77 Q24 75 26.5 77" stroke="rgba(0,0,0,0.22)" stroke-width="0.9" fill="none"/>
<path d="M73.5 57 Q76 55 78.5 57 M73.5 62 Q76 60 78.5 62 M73.5 67 Q76 65 78.5 67 M73.5 72 Q76 70 78.5 72 M73.5 77 Q76 75 78.5 77" stroke="rgba(0,0,0,0.22)" stroke-width="0.9" fill="none"/>`,
    front: `<path d="M28 43 Q27 15 50 13 Q73 15 72 43 Q63 37 50 36 Q37 37 28 43 Z" fill="COLOR"/>
<line x1="50" y1="13" x2="50" y2="36" stroke="rgba(0,0,0,0.18)" stroke-width="1.5"/>`,
  },
  {
    id: 'hair_bun',
    label: 'Bun', labelEs: 'Moño',
    // Bun sphere connected by a filled teardrop shape to the scalp cap.
    front: `<circle cx="50" cy="7" r="11" fill="COLOR"/>
<path d="M42 16 Q41 22 50 22 Q59 22 58 16 Q58 7 50 7 Q42 7 42 16 Z" fill="COLOR"/>
<path d="M28 43 Q27 20 50 18 Q73 20 72 43 Q63 38 50 37 Q37 38 28 43 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_wavy',
    label: 'Wavy, Medium', labelEs: 'Ondulado, medio',
    // Back: gentle S-curve silhouette sides. Front: wavy strands over outfit.
    back: `<path d="M28 43 L23 66 Q24 75 27 78 Q30 74 28 64 L28 44 Q28 17 50 15 Q72 17 72 44 L72 64 Q70 74 73 78 Q76 75 77 66 L72 43 Q72 15 50 13 Q28 15 28 43 Z" fill="COLOR"/>`,
    front: `<path d="M28 43 Q27 18 50 16 Q73 18 72 43 Q65 37 58 39 Q54 40 50 38 Q46 36 42 39 Q35 41 28 43 Z" fill="COLOR"/>
<path d="M29 46 C27 56 30 62 27 70 C25 76 28 80 27 84 Q28 87 31 86 C31 82 28 78 30 72 C32 66 29 60 30 46 Z" fill="COLOR"/>
<path d="M71 46 C73 56 70 62 73 70 C75 76 72 80 73 84 Q72 87 69 86 C69 82 72 78 70 72 C68 66 71 60 70 46 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_coily_short',
    label: 'Coily, Short', labelEs: 'Coily, corto',
    // Dense natural dome — more irregular placement than short_curly.
    front: `<ellipse cx="50" cy="27" rx="25" ry="16" fill="COLOR"/>
<circle cx="31" cy="27" r="8" fill="COLOR"/>
<circle cx="69" cy="27" r="8" fill="COLOR"/>
<circle cx="40" cy="18" r="9" fill="COLOR"/>
<circle cx="60" cy="18" r="9" fill="COLOR"/>
<circle cx="50" cy="15" r="9" fill="COLOR"/>
<circle cx="35" cy="25" r="6" fill="COLOR"/>
<circle cx="65" cy="25" r="6" fill="COLOR"/>`,
  },
];

// ── Hair color ─────────────────────────────────────────────────────────────────
export interface HairColorDef {
  id: HairColorId;
  label: string; labelEs: string;
  color: string;
}
export const HAIR_COLORS: HairColorDef[] = [
  { id: 'hair_black',        label: 'Black',        labelEs: 'Negro',          color: '#1a1212' },
  { id: 'hair_dark_brown',   label: 'Dark Brown',   labelEs: 'Marrón oscuro',  color: '#3d2314' },
  { id: 'hair_medium_brown', label: 'Medium Brown', labelEs: 'Marrón medio',   color: '#6b3c1f' },
  { id: 'hair_auburn',       label: 'Auburn',       labelEs: 'Caoba',          color: '#8b3a1a' },
  { id: 'hair_blonde',       label: 'Blonde',       labelEs: 'Rubio',          color: '#c8a558' },
  { id: 'hair_gray',         label: 'Gray',         labelEs: 'Gris',           color: '#888888' },
];

// ── Facial hair ────────────────────────────────────────────────────────────────
// Renders above face features, below front hair.
// Positioned clearly below the mouth (mouth center y≈54-57) at chin/jaw.
export interface FacialHairDef {
  id: FacialHairId;
  label: string; labelEs: string;
  svg: string;
}
export const FACIAL_HAIR: FacialHairDef[] = [
  {
    id: 'fh_stubble',
    label: 'Stubble', labelEs: 'Barba incipiente',
    svg: `<ellipse cx="50" cy="61" rx="13" ry="7.5" fill="COLOR" opacity="0.62"/>`,
  },
  {
    id: 'fh_beard_short',
    label: 'Short Beard', labelEs: 'Barba corta',
    // Full lower-face shape at chin and jaw — substantial opacity so it reads on all skin tones.
    svg: `<path d="M36 58 Q35 70 50 72 Q65 70 64 58 Q58 64 50 64 Q42 64 36 58 Z" fill="COLOR" opacity="0.92"/>`,
  },
  {
    id: 'fh_mustache',
    label: 'Mustache', labelEs: 'Bigote',
    // Handlebar at upper lip (y≈51-57), above the mouth stroke.
    svg: `<path d="M41 53 Q46 57.5 50 55.5 Q54 57.5 59 53 Q55 51 50 52 Q45 51 41 53 Z" fill="COLOR"/>`,
  },
];

// ── Glasses ────────────────────────────────────────────────────────────────────
// Lens centers aligned to eye centers: left cx=42 cy=37, right cx=58 cy=37.
// Round glasses r=7.5: lens extends from cx±7.5, fully enclosing the 10px almond eye.
export interface GlassesDef {
  id: GlassesId;
  label: string; labelEs: string;
  svg: string;
}
const GL = '#1a1020';
const GL_LENS = 'rgba(160,210,255,0.09)';
export const GLASSES: GlassesDef[] = [
  {
    id: 'gl_round',
    label: 'Round', labelEs: 'Redondos',
    svg: `<circle cx="42" cy="37" r="7.5" fill="${GL_LENS}" stroke="${GL}" stroke-width="2.3"/>
<circle cx="58" cy="37" r="7.5" fill="${GL_LENS}" stroke="${GL}" stroke-width="2.3"/>
<line x1="49.5" y1="37" x2="50.5" y2="37" stroke="${GL}" stroke-width="2.3"/>
<line x1="66.5" y1="36.5" x2="75" y2="36" stroke="${GL}" stroke-width="1.8"/>
<line x1="33.5" y1="36.5" x2="25" y2="36" stroke="${GL}" stroke-width="1.8"/>`,
  },
  {
    id: 'gl_square',
    label: 'Square', labelEs: 'Cuadrados',
    // 17×13 rect centered on each eye: cx=42 → x=33.5; cx=58 → x=49.5.
    svg: `<rect x="33.5" y="31" width="17" height="13" rx="2.5" fill="${GL_LENS}" stroke="${GL}" stroke-width="2.3"/>
<rect x="49.5" y="31" width="17" height="13" rx="2.5" fill="${GL_LENS}" stroke="${GL}" stroke-width="2.3"/>
<line x1="49.5" y1="37.5" x2="50.5" y2="37.5" stroke="${GL}" stroke-width="2.3"/>
<line x1="66.5" y1="36" x2="75" y2="35.5" stroke="${GL}" stroke-width="1.8"/>
<line x1="33.5" y1="36" x2="25" y2="35.5" stroke="${GL}" stroke-width="1.8"/>`,
  },
  {
    id: 'gl_semi',
    label: 'Half Rim', labelEs: 'Medio aro',
    // Upper arc only — academic half-rim. Centered on eye positions.
    svg: `<path d="M34 37 Q42 30 50 37" fill="none" stroke="${GL}" stroke-width="2.4" stroke-linecap="round"/>
<path d="M50 37 Q58 30 66 37" fill="none" stroke="${GL}" stroke-width="2.4" stroke-linecap="round"/>
<line x1="50" y1="37" x2="50" y2="36.5" stroke="${GL}" stroke-width="2"/>
<line x1="34" y1="37" x2="26" y2="36" stroke="${GL}" stroke-width="1.8"/>
<line x1="66" y1="37" x2="74" y2="36" stroke="${GL}" stroke-width="1.8"/>`,
  },
];

// ── Headwear ───────────────────────────────────────────────────────────────────
// coversHair:true → AvatarComposite skips hair layers and re-renders face
// (using the actual face.svg) + features + facial hair + glasses on top.
export interface HeadwearDef {
  id: HeadwearId;
  label: string; labelEs: string;
  svg: string;
  color: string;
  coversHair?: boolean;
}
export const HEADWEAR: HeadwearDef[] = [
  {
    id: 'hw_cap',
    label: 'Cap', labelEs: 'Gorra',
    color: '#1e3a5f',
    // Fitted cap with brim extending left and a button detail at crown.
    svg: `<path d="M27 38 Q27 11 50 10 Q73 11 73 38 Z" fill="COLOR"/>
<path d="M27 38 L12 37 Q9 37 9 40 Q9 44 14 44 L27 43" fill="COLOR"/>
<circle cx="50" cy="10" r="4" fill="COLOR" opacity="0.65"/>
<rect x="23" y="37" width="54" height="5.5" rx="2.5" fill="COLOR" opacity="0.6"/>`,
  },
  {
    id: 'hw_hijab',
    label: 'Hijab', labelEs: 'Hijab',
    color: '#2d4a6e',
    coversHair: true,
    // Generous drape from crown to below shoulders.
    svg: `<path d="M18 46 Q16 14 50 11 Q84 14 82 46 L82 80 Q66 94 50 94 Q34 94 18 80 Z" fill="COLOR"/>`,
  },
  {
    id: 'hw_wrap',
    label: 'Head Wrap', labelEs: 'Turbante',
    color: '#4a2d6e',
    coversHair: true,
    // Wrapped crown with fabric twist and front-knot detail.
    svg: `<ellipse cx="50" cy="24" rx="32" ry="22" fill="COLOR"/>
<path d="M18 24 Q18 10 50 8 Q82 10 82 24 Q70 17 50 16 Q30 17 18 24 Z" fill="COLOR" opacity="0.6"/>
<ellipse cx="50" cy="8" rx="8" ry="6" fill="COLOR" opacity="0.85"/>
<path d="M18 24 Q16 34 22 38" fill="none" stroke="COLOR" stroke-width="5" stroke-linecap="round" opacity="0.75"/>`,
  },
  {
    id: 'hw_beanie',
    label: 'Beanie', labelEs: 'Gorro',
    color: '#1e3a3a',
    // Dome with ribbed cuff band at bottom edge.
    svg: `<path d="M23 39 Q23 10 50 9 Q77 10 77 39 L75 45 Q62 38 50 38 Q38 38 25 45 Z" fill="COLOR"/>
<rect x="21" y="39" width="58" height="7" rx="3.5" fill="COLOR" opacity="0.65"/>`,
  },
];

// ── Outfit ─────────────────────────────────────────────────────────────────────
// Five premium silhouettes with ParQueen palette: royal blue, slate, deep navy,
// deep cyan, and silver-white. Rendered BEFORE face so the neck seam is covered.
//
// Silhouette tips:
//   outfit_tee         — clean round neckline, simple shoulder slope
//   outfit_hoodie      — wider relaxed shoulders, kangaroo pocket band, drawstrings
//   outfit_jacket      — sharp structured shoulders, lapels visible below face, button row
//   outfit_turtleneck  — narrow fitted body, tight neckline, distinctive cyan color
//   outfit_buttonup    — collar points peek outside face at y≈60, light color, placket
export interface OutfitDef {
  id: OutfitId;
  label: string; labelEs: string;
  color: string;
  svg: string;
}
export const OUTFITS: OutfitDef[] = [
  {
    id: 'outfit_tee',
    label: 'Casual Tee', labelEs: 'Camiseta casual',
    color: '#1d4ed8',
    // Royal blue crew-neck. U-neckline is the cleanest shape.
    svg: `<path d="M12 100 L12 74 C12 64 23 60 37 58 L44 56 L50 63 L56 56 L63 58 C77 60 88 64 88 74 L88 100 Z" fill="COLOR"/>`,
  },
  {
    id: 'outfit_hoodie',
    label: 'Hoodie', labelEs: 'Sudadera',
    color: '#1e293b',
    // Slate hoodie. Wider shoulders (relaxed fit). Pocket band + drawstring strings.
    svg: `<path d="M9 100 L9 72 C9 61 22 57 37 55 L43 53 L50 61 L57 53 L63 55 C78 57 91 61 91 72 L91 100 Z" fill="COLOR"/>
<rect x="36" y="77" width="28" height="16" rx="4" fill="COLOR" opacity="0.45"/>
<path d="M46 63 L44 78" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-linecap="round"/>
<path d="M54 63 L56 78" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" stroke-linecap="round"/>`,
  },
  {
    id: 'outfit_jacket',
    label: 'Jacket', labelEs: 'Chaqueta',
    color: '#0f172a',
    // Near-black structured jacket. Sharp shoulders. Lapels create V below face.
    svg: `<path d="M10 100 L10 72 C10 62 22 58 36 56 L43 54 L50 63 L57 54 L64 56 C78 58 90 62 90 72 L90 100 Z" fill="COLOR"/>
<path d="M43 54 L38 68 L50 63 L62 68 L57 54" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.13)" stroke-width="1" stroke-linejoin="round"/>
<circle cx="50" cy="73" r="2" fill="rgba(255,255,255,0.15)"/>
<circle cx="50" cy="81" r="2" fill="rgba(255,255,255,0.15)"/>
<circle cx="50" cy="89" r="2" fill="rgba(255,255,255,0.15)"/>`,
  },
  {
    id: 'outfit_turtleneck',
    label: 'Turtleneck', labelEs: 'Cuello alto',
    color: '#0e7490',
    // Deep cyan — the most visually distinctive color in the set.
    // Slim, fitted body with narrower neckline opening than the tee.
    svg: `<path d="M16 100 L16 73 C16 64 26 61 39 59 L45 57 L55 57 L61 59 C74 61 84 64 84 73 L84 100 Z" fill="COLOR"/>
<path d="M45 57 L45 51 Q45 48 50 48 Q55 48 55 51 L55 57 Q52 55 50 55 Q48 55 45 57 Z" fill="COLOR"/>`,
  },
  {
    id: 'outfit_buttonup',
    label: 'Button-Up', labelEs: 'Camisa de botones',
    color: '#dde3ed',
    // Silver-white smart-casual. Collar points extend to x≈37/63 — just outside
    // the face coverage zone — so they peek out on both sides at 96px+.
    svg: `<path d="M13 100 L13 73 C13 64 23 60 37 58 L43 56 L50 63 L57 56 L63 58 C77 60 87 64 87 73 L87 100 Z" fill="COLOR"/>
<path d="M43 56 L37 63 L50 63" fill="none" stroke="rgba(0,0,0,0.14)" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M57 56 L63 63 L50 63" fill="none" stroke="rgba(0,0,0,0.14)" stroke-width="1.2" stroke-linejoin="round"/>
<line x1="50" y1="63" x2="50" y2="96" stroke="rgba(0,0,0,0.1)" stroke-width="1.5"/>
<circle cx="50" cy="69" r="2.2" fill="rgba(0,0,0,0.18)"/>
<circle cx="50" cy="77" r="2.2" fill="rgba(0,0,0,0.18)"/>
<circle cx="50" cy="85" r="2.2" fill="rgba(0,0,0,0.18)"/>`,
  },
];

// ─── Lookup helpers ────────────────────────────────────────────────────────────
export function findSkin(id: SkinId): SkinDef { return SKINS.find(s => s.id === id) ?? SKINS[0]; }
export function findFace(id: FaceId): FaceDef { return FACES.find(f => f.id === id) ?? FACES[0]; }
export function findHair(id: HairId): HairDef { return HAIR_STYLES.find(h => h.id === id) ?? HAIR_STYLES[0]; }
export function findHairColor(id: HairColorId): HairColorDef { return HAIR_COLORS.find(c => c.id === id) ?? HAIR_COLORS[0]; }
export function findFacialHair(id: FacialHairId | null): FacialHairDef | null {
  if (!id) return null;
  return FACIAL_HAIR.find(f => f.id === id) ?? null;
}
export function findGlasses(id: GlassesId | null): GlassesDef | null {
  if (!id) return null;
  return GLASSES.find(g => g.id === id) ?? null;
}
export function findHeadwear(id: HeadwearId | null): HeadwearDef | null {
  if (!id) return null;
  return HEADWEAR.find(h => h.id === id) ?? null;
}
export function findOutfit(id: OutfitId): OutfitDef { return OUTFITS.find(o => o.id === id) ?? OUTFITS[0]; }
export function findBackground(id: BackgroundId): BackgroundDef { return BACKGROUNDS.find(b => b.id === id) ?? BACKGROUNDS[0]; }

/** Replace every COLOR token in an authored SVG string with an actual hex color. */
export function applyColor(svg: string, color: string): string {
  return svg.replace(/COLOR/g, color);
}

// ─── Valid ID sets (consumed by parsona/validation.ts) ─────────────────────────
export const VALID_SKIN_IDS       = new Set(SKINS.map(s => s.id));
export const VALID_FACE_IDS       = new Set(FACES.map(f => f.id));
export const VALID_HAIR_IDS       = new Set(HAIR_STYLES.map(h => h.id));
export const VALID_HAIR_COLOR_IDS = new Set(HAIR_COLORS.map(c => c.id));
export const VALID_FACIAL_HAIR    = new Set(FACIAL_HAIR.map(f => f.id));
export const VALID_GLASSES        = new Set(GLASSES.map(g => g.id));
export const VALID_HEADWEAR       = new Set(HEADWEAR.map(h => h.id));
export const VALID_OUTFIT_IDS     = new Set(OUTFITS.map(o => o.id));
export const VALID_BG_IDS         = new Set(BACKGROUNDS.map(b => b.id));
