// ─── Parsona asset manifest ───────────────────────────────────────────────────
// All SVG data lives here as authored strings. Replace asset data to swap art.
// `COLOR` token is replaced by AvatarComposite with the selected hex color.
// ViewBox: 0 0 100 100. Head centroid: cx=50 cy=40. Circle-clipped by consumer.

import type {
  SkinId, FaceId, HairId, HairColorId,
  FacialHairId, GlassesId, HeadwearId, OutfitId, BackgroundId,
} from './types';

// ── Background ─────────────────────────────────────────────────────────────────
export interface BackgroundDef {
  id: BackgroundId;
  label: string; labelEs: string;
  color: string;        // fill for the background circle
  accent?: string;      // optional subtle dot pattern color
}
export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'bg_navy',     label: 'Navy',        labelEs: 'Azul marino',   color: '#0f1b2d' },
  { id: 'bg_midnight', label: 'Midnight',    labelEs: 'Medianoche',    color: '#0d0d1e' },
  { id: 'bg_teal',     label: 'Teal',        labelEs: 'Verde azulado', color: '#0d2626' },
  { id: 'bg_charcoal', label: 'Charcoal',    labelEs: 'Carbón',        color: '#1a1a1a' },
  { id: 'bg_purple',   label: 'Deep Purple', labelEs: 'Morado',        color: '#160d2e' },
  { id: 'bg_gold',     label: 'Gold',        labelEs: 'Dorado',        color: '#1a1408' },
];

// ── Skin tone ──────────────────────────────────────────────────────────────────
export interface SkinDef {
  id: SkinId;
  label: string; labelEs: string;
  color: string;
  shadowColor: string; // slightly darker, used for neck shadow
}
export const SKINS: SkinDef[] = [
  { id: 'skin_01', label: 'Warm Light',   labelEs: 'Claro cálido',     color: '#FCEBD8', shadowColor: '#e8c9a8' },
  { id: 'skin_02', label: 'Soft Beige',   labelEs: 'Beige suave',      color: '#F2C9A0', shadowColor: '#d9a87a' },
  { id: 'skin_03', label: 'Golden Tan',   labelEs: 'Tostado dorado',   color: '#D4946B', shadowColor: '#b87245' },
  { id: 'skin_04', label: 'Warm Brown',   labelEs: 'Marrón cálido',    color: '#B5693C', shadowColor: '#934f26' },
  { id: 'skin_05', label: 'Deep Brown',   labelEs: 'Marrón profundo',  color: '#7D4520', shadowColor: '#5e3018' },
  { id: 'skin_06', label: 'Rich Ebony',   labelEs: 'Ébano rico',       color: '#3E1F0E', shadowColor: '#2a1208' },
];

// ── Face shape ─────────────────────────────────────────────────────────────────
// Each face provides the SVG path for the head silhouette (skin-filled).
// `COLOR` → skin color. The face layer also owns the neck rect.
export interface FaceDef {
  id: FaceId;
  label: string; labelEs: string;
  // SVG elements for the head+neck shape
  svg: string;
}
export const FACES: FaceDef[] = [
  {
    id: 'face_round',
    label: 'Round', labelEs: 'Redondo',
    svg: `<ellipse cx="50" cy="40" rx="24" ry="26" fill="COLOR"/>
<rect x="43" y="62" width="14" height="11" rx="3" fill="COLOR"/>`,
  },
  {
    id: 'face_oval',
    label: 'Oval', labelEs: 'Ovalado',
    svg: `<ellipse cx="50" cy="40" rx="21" ry="29" fill="COLOR"/>
<rect x="43" y="66" width="14" height="10" rx="3" fill="COLOR"/>`,
  },
  {
    id: 'face_angular',
    label: 'Angular', labelEs: 'Angular',
    svg: `<path d="M26 40 Q26 14 50 13 Q74 14 74 40 L70 57 Q62 68 50 68 Q38 68 30 57 Z" fill="COLOR"/>
<rect x="43" y="65" width="14" height="10" rx="2" fill="COLOR"/>`,
  },
];

// ── Face features (hardcoded — not user-selectable) ───────────────────────────
// `SKIN` → shadow/eye shade token. These are injected by AvatarComposite.
export const FACE_FEATURES_SVG = `
<ellipse cx="41" cy="38" rx="3.5" ry="4" fill="#1a1a2e"/>
<ellipse cx="59" cy="38" rx="3.5" ry="4" fill="#1a1a2e"/>
<path d="M 44 50 Q 50 55 56 50" fill="none" stroke="#1a1a2e" stroke-width="1.8" stroke-linecap="round"/>
`;

// ── Hair ───────────────────────────────────────────────────────────────────────
// Each style has optional `back` (rendered before skin) and `front` (after skin).
// `COLOR` → hairColor.
export interface HairDef {
  id: HairId;
  label: string; labelEs: string;
  back?: string;   // SVG behind the head
  front: string;   // SVG on top of the head
  coversTop?: boolean; // hint: headwear should replace this
}
export const HAIR_STYLES: HairDef[] = [
  {
    id: 'hair_short',
    label: 'Short', labelEs: 'Corto',
    front: `<path d="M26 42 Q24 16 50 14 Q76 16 74 42 Q64 34 50 33 Q36 34 26 42 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_medium_straight',
    label: 'Straight, Medium', labelEs: 'Liso, medio',
    back: `<path d="M26 42 L22 68 Q22 76 28 78 L30 44 Q29 18 50 16 Q71 18 70 44 L72 78 Q78 76 78 68 L74 42 Q74 16 50 14 Q26 16 26 42 Z" fill="COLOR"/>`,
    front: `<path d="M26 42 Q24 16 50 14 Q76 16 74 42 Q64 34 50 33 Q36 34 26 42 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_long',
    label: 'Straight, Long', labelEs: 'Liso, largo',
    back: `<path d="M26 42 L20 80 Q20 90 28 92 L30 46 Q29 18 50 16 Q71 18 70 46 L72 92 Q80 90 80 80 L74 42 Q74 16 50 14 Q26 16 26 42 Z" fill="COLOR"/>`,
    front: `<path d="M26 42 Q24 16 50 14 Q76 16 74 42 Q64 34 50 33 Q36 34 26 42 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_short_curly',
    label: 'Short Curly', labelEs: 'Rizado corto',
    front: `<ellipse cx="50" cy="26" rx="25" ry="15" fill="COLOR"/>
<circle cx="32" cy="25" r="8" fill="COLOR"/>
<circle cx="44" cy="17" r="9" fill="COLOR"/>
<circle cx="56" cy="17" r="9" fill="COLOR"/>
<circle cx="68" cy="25" r="8" fill="COLOR"/>
<circle cx="50" cy="13" r="8" fill="COLOR"/>`,
  },
  {
    id: 'hair_afro',
    label: 'Afro', labelEs: 'Afro',
    back: `<ellipse cx="50" cy="33" rx="33" ry="27" fill="COLOR"/>`,
    front: ``,
  },
  {
    id: 'hair_locs',
    label: 'Locs', labelEs: 'Rastas',
    back: `<path d="M26 44 L22 68 Q22 76 28 78 L30 46 Q29 20 50 18 Q71 20 70 46 L72 78 Q78 76 78 68 L74 44 Q74 18 50 16 Q26 18 26 44 Z" fill="COLOR"/>
<rect x="21" y="62" width="7" height="22" rx="3.5" fill="COLOR"/>
<rect x="72" y="62" width="7" height="22" rx="3.5" fill="COLOR"/>`,
    front: `<path d="M26 44 Q24 18 50 16 Q76 18 74 44 Q64 36 50 35 Q36 36 26 44 Z" fill="COLOR"/>
<rect x="31" y="62" width="6" height="20" rx="3" fill="COLOR"/>
<rect x="63" y="62" width="6" height="20" rx="3" fill="COLOR"/>`,
  },
  {
    id: 'hair_braids',
    label: 'Braids', labelEs: 'Trenzas',
    back: `<path d="M26 44 L23 66 Q23 74 28 76 L30 46 Q29 18 50 16 Q71 18 70 46 L72 76 Q77 74 77 66 L74 44 Q74 16 50 14 Q26 16 26 44 Z" fill="COLOR"/>`,
    front: `<path d="M26 44 Q24 16 50 14 Q76 16 74 44 Q64 36 50 35 Q36 36 26 44 Z" fill="COLOR"/>
<rect x="23" y="52" width="9" height="28" rx="4.5" fill="COLOR"/>
<rect x="35" y="54" width="9" height="30" rx="4.5" fill="COLOR"/>
<rect x="56" y="54" width="9" height="30" rx="4.5" fill="COLOR"/>
<rect x="68" y="52" width="9" height="28" rx="4.5" fill="COLOR"/>`,
  },
  {
    id: 'hair_bun',
    label: 'Bun', labelEs: 'Moño',
    front: `<circle cx="50" cy="9" r="13" fill="COLOR"/>
<ellipse cx="50" cy="21" rx="9" ry="5" fill="COLOR"/>
<path d="M26 42 Q24 20 50 18 Q76 20 74 42 Q65 37 50 37 Q35 37 26 42 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_wavy',
    label: 'Wavy, Medium', labelEs: 'Ondulado, medio',
    back: `<path d="M24 44 L20 62 Q22 70 24 74 Q28 70 26 60 L26 46 Q26 18 50 16 Q74 18 74 46 L74 60 Q72 70 76 74 Q78 70 80 62 L76 44 Q76 16 50 14 Q24 16 24 44 Z" fill="COLOR"/>`,
    front: `<path d="M26 44 Q24 18 50 16 Q76 18 74 44 Q67 36 60 38 Q55 40 50 38 Q45 36 40 38 Q33 40 26 44 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_coily_short',
    label: 'Coily, Short', labelEs: 'Rizado corto natural',
    front: `<ellipse cx="50" cy="27" rx="26" ry="16" fill="COLOR"/>`,
  },
];

// ── Hair color ─────────────────────────────────────────────────────────────────
export interface HairColorDef {
  id: HairColorId;
  label: string; labelEs: string;
  color: string;
}
export const HAIR_COLORS: HairColorDef[] = [
  { id: 'hair_black',       label: 'Black',        labelEs: 'Negro',       color: '#1a1212' },
  { id: 'hair_dark_brown',  label: 'Dark Brown',   labelEs: 'Marrón oscuro', color: '#3d2314' },
  { id: 'hair_medium_brown',label: 'Medium Brown', labelEs: 'Marrón medio', color: '#6b3c1f' },
  { id: 'hair_auburn',      label: 'Auburn',       labelEs: 'Caoba',       color: '#8b3a1a' },
  { id: 'hair_blonde',      label: 'Blonde',       labelEs: 'Rubio',       color: '#c8a558' },
  { id: 'hair_gray',        label: 'Gray',         labelEs: 'Gris',        color: '#888888' },
];

// ── Facial hair ────────────────────────────────────────────────────────────────
// Rendered above skin, below glasses. COLOR → skin shadow/dark color.
export interface FacialHairDef {
  id: FacialHairId;
  label: string; labelEs: string;
  svg: string; // COLOR → hair color (inherits hairColor)
}
export const FACIAL_HAIR: FacialHairDef[] = [
  {
    id: 'fh_stubble',
    label: 'Stubble', labelEs: 'Barba incipiente',
    svg: `<ellipse cx="50" cy="55" rx="12" ry="8" fill="COLOR" opacity="0.55"/>`,
  },
  {
    id: 'fh_beard_short',
    label: 'Short Beard', labelEs: 'Barba corta',
    svg: `<path d="M 36 52 Q 36 64 50 66 Q 64 64 64 52 Q 58 58 50 58 Q 42 58 36 52 Z" fill="COLOR" opacity="0.85"/>`,
  },
  {
    id: 'fh_mustache',
    label: 'Mustache', labelEs: 'Bigote',
    svg: `<path d="M 40 48 Q 45 52 50 50 Q 55 52 60 48 Q 56 46 50 47 Q 44 46 40 48 Z" fill="COLOR"/>`,
  },
];

// ── Glasses ────────────────────────────────────────────────────────────────────
export interface GlassesDef {
  id: GlassesId;
  label: string; labelEs: string;
  svg: string;
}
const GL = '#1a1a2e'; // frame color
export const GLASSES: GlassesDef[] = [
  {
    id: 'gl_round',
    label: 'Round', labelEs: 'Redondos',
    svg: `<circle cx="40" cy="39" r="9" fill="none" stroke="${GL}" stroke-width="2.5"/>
<circle cx="60" cy="39" r="9" fill="none" stroke="${GL}" stroke-width="2.5"/>
<line x1="49" y1="39" x2="51" y2="39" stroke="${GL}" stroke-width="2.5"/>
<line x1="69" y1="38" x2="76" y2="37" stroke="${GL}" stroke-width="2"/>
<line x1="31" y1="38" x2="24" y2="37" stroke="${GL}" stroke-width="2"/>`,
  },
  {
    id: 'gl_square',
    label: 'Square', labelEs: 'Cuadrados',
    svg: `<rect x="29" y="33" width="19" height="12" rx="2" fill="none" stroke="${GL}" stroke-width="2.5"/>
<rect x="52" y="33" width="19" height="12" rx="2" fill="none" stroke="${GL}" stroke-width="2.5"/>
<line x1="48" y1="39" x2="52" y2="39" stroke="${GL}" stroke-width="2"/>
<line x1="71" y1="37" x2="77" y2="36" stroke="${GL}" stroke-width="2"/>
<line x1="29" y1="37" x2="23" y2="36" stroke="${GL}" stroke-width="2"/>`,
  },
  {
    id: 'gl_semi',
    label: 'Half Rim', labelEs: 'Medio aro',
    svg: `<path d="M 30 36 Q 40 29 50 36" fill="none" stroke="${GL}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M 50 36 Q 60 29 70 36" fill="none" stroke="${GL}" stroke-width="2.5" stroke-linecap="round"/>
<line x1="48" y1="36" x2="52" y2="36" stroke="${GL}" stroke-width="2"/>
<line x1="30" y1="36" x2="24" y2="37" stroke="${GL}" stroke-width="1.5"/>
<line x1="70" y1="36" x2="76" y2="37" stroke="${GL}" stroke-width="1.5"/>`,
  },
];

// ── Headwear ───────────────────────────────────────────────────────────────────
// Headwear renders above hair. `coversHair: true` → AvatarComposite skips hair layers
// and re-renders the face opening in skin color over the headwear.
export interface HeadwearDef {
  id: HeadwearId;
  label: string; labelEs: string;
  svg: string;           // COLOR → headwear fill color
  color: string;         // default fill color
  coversHair?: boolean;  // hijab/wrap covers all hair
}
export const HEADWEAR: HeadwearDef[] = [
  {
    id: 'hw_cap',
    label: 'Cap', labelEs: 'Gorra',
    color: '#1e3a5f',
    svg: `<path d="M24 34 Q24 10 50 9 Q76 10 76 34 Z" fill="COLOR"/>
<path d="M24 34 L12 34 Q9 34 9 37 Q9 41 14 41 L26 40" fill="COLOR" stroke="none"/>
<circle cx="50" cy="9" r="3.5" fill="COLOR"/>
<rect x="20" y="33" width="60" height="5" rx="2" fill="COLOR" opacity="0.6"/>`,
  },
  {
    id: 'hw_hijab',
    label: 'Hijab', labelEs: 'Hijab',
    color: '#2d4a6e',
    coversHair: true,
    svg: `<path d="M20 44 Q18 14 50 11 Q82 14 80 44 L80 76 Q66 90 50 90 Q34 90 20 76 Z" fill="COLOR"/>`,
  },
  {
    id: 'hw_wrap',
    label: 'Head Wrap', labelEs: 'Turbante',
    color: '#4a2d6e',
    coversHair: true,
    svg: `<ellipse cx="50" cy="26" rx="30" ry="20" fill="COLOR"/>
<path d="M20 26 Q20 12 50 10 Q80 12 80 26 Q70 18 50 18 Q30 18 20 26 Z" fill="COLOR" opacity="0.7"/>
<path d="M20 26 Q18 34 22 38" fill="none" stroke="COLOR" stroke-width="4" stroke-linecap="round"/>
<circle cx="50" cy="10" r="6" fill="COLOR" opacity="0.85"/>`,
  },
  {
    id: 'hw_beanie',
    label: 'Beanie', labelEs: 'Gorro',
    color: '#1e3a3a',
    svg: `<path d="M22 36 Q22 10 50 9 Q78 10 78 36 L76 42 Q62 36 50 36 Q38 36 24 42 Z" fill="COLOR"/>
<rect x="20" y="36" width="60" height="7" rx="3" fill="COLOR" opacity="0.7"/>`,
  },
];

// ── Outfit ─────────────────────────────────────────────────────────────────────
// Fills the lower portion of the avatar (y ≈ 64–100). `COLOR` → outfit color.
export interface OutfitDef {
  id: OutfitId;
  label: string; labelEs: string;
  color: string;  // default outfit color
  svg: string;
}
export const OUTFITS: OutfitDef[] = [
  {
    id: 'outfit_tee',
    label: 'Casual Tee', labelEs: 'Camiseta casual',
    color: '#1e3a5f',
    svg: `<path d="M14 100 L14 74 C14 66 24 62 36 61 L44 59 L50 64 L56 59 L64 61 C76 62 86 66 86 74 L86 100 Z" fill="COLOR"/>`,
  },
  {
    id: 'outfit_hoodie',
    label: 'Hoodie', labelEs: 'Sudadera',
    color: '#374151',
    svg: `<path d="M12 100 L12 73 C12 64 23 60 36 59 L44 57 L50 63 L56 57 L64 59 C77 60 88 64 88 73 L88 100 Z" fill="COLOR"/>
<rect x="37" y="77" width="26" height="15" rx="4" fill="COLOR" opacity="0.6"/>
<line x1="46" y1="63" x2="44" y2="76" stroke="COLOR" stroke-width="2" opacity="0.5"/>
<line x1="54" y1="63" x2="56" y2="76" stroke="COLOR" stroke-width="2" opacity="0.5"/>`,
  },
  {
    id: 'outfit_jacket',
    label: 'Jacket', labelEs: 'Chaqueta',
    color: '#111827',
    svg: `<path d="M14 100 L14 73 C14 65 25 62 38 61 L44 59 L50 65 L56 59 L62 61 C75 62 86 65 86 73 L86 100 Z" fill="COLOR"/>
<path d="M44 59 L40 68 L50 64 L60 68 L56 59" fill="COLOR" stroke="#ffffff12" stroke-width="1"/>
<circle cx="50" cy="76" r="2" fill="#ffffff18"/>
<circle cx="50" cy="83" r="2" fill="#ffffff18"/>`,
  },
  {
    id: 'outfit_turtleneck',
    label: 'Turtleneck', labelEs: 'Cuello alto',
    color: '#475569',
    svg: `<path d="M16 100 L16 73 C16 66 26 63 38 62 L44 60 L56 60 L62 62 C74 63 84 66 84 73 L84 100 Z" fill="COLOR"/>
<path d="M44 60 L44 53 Q44 49 50 49 Q56 49 56 53 L56 60 Q53 58 50 58 Q47 58 44 60 Z" fill="COLOR"/>`,
  },
  {
    id: 'outfit_buttonup',
    label: 'Button-Up', labelEs: 'Camisa de botones',
    color: '#e2e8f0',
    svg: `<path d="M14 100 L14 73 C14 66 24 62 37 61 L44 59 L50 65 L56 59 L63 61 C76 62 86 66 86 73 L86 100 Z" fill="COLOR"/>
<path d="M44 59 L42 67 L50 63 L58 67 L56 59" fill="COLOR" stroke="#00000018" stroke-width="1"/>
<line x1="50" y1="64" x2="50" y2="93" stroke="#00000018" stroke-width="1.5"/>
<circle cx="50" cy="71" r="1.8" fill="#00000022"/>
<circle cx="50" cy="79" r="1.8" fill="#00000022"/>
<circle cx="50" cy="87" r="1.8" fill="#00000022"/>`,
  },
];

// ─── Lookup helpers ────────────────────────────────────────────────────────────

export function findSkin(id: SkinId): SkinDef {
  return SKINS.find(s => s.id === id) ?? SKINS[0];
}
export function findFace(id: FaceId): FaceDef {
  return FACES.find(f => f.id === id) ?? FACES[0];
}
export function findHair(id: HairId): HairDef {
  return HAIR_STYLES.find(h => h.id === id) ?? HAIR_STYLES[0];
}
export function findHairColor(id: HairColorId): HairColorDef {
  return HAIR_COLORS.find(c => c.id === id) ?? HAIR_COLORS[0];
}
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
export function findOutfit(id: OutfitId): OutfitDef {
  return OUTFITS.find(o => o.id === id) ?? OUTFITS[0];
}
export function findBackground(id: BackgroundId): BackgroundDef {
  return BACKGROUNDS.find(b => b.id === id) ?? BACKGROUNDS[0];
}

/** Replace the COLOR token in authored SVG strings with an actual hex color. */
export function applyColor(svg: string, color: string): string {
  return svg.replace(/COLOR/g, color);
}

// ─── Valid ID sets (for Firestore validation) ──────────────────────────────────

export const VALID_SKIN_IDS      = new Set(SKINS.map(s => s.id));
export const VALID_FACE_IDS      = new Set(FACES.map(f => f.id));
export const VALID_HAIR_IDS      = new Set(HAIR_STYLES.map(h => h.id));
export const VALID_HAIR_COLOR_IDS= new Set(HAIR_COLORS.map(c => c.id));
export const VALID_FACIAL_HAIR   = new Set(FACIAL_HAIR.map(f => f.id));
export const VALID_GLASSES       = new Set(GLASSES.map(g => g.id));
export const VALID_HEADWEAR      = new Set(HEADWEAR.map(h => h.id));
export const VALID_OUTFIT_IDS    = new Set(OUTFITS.map(o => o.id));
export const VALID_BG_IDS        = new Set(BACKGROUNDS.map(b => b.id));
