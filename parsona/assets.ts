// ─── Parsona asset manifest ───────────────────────────────────────────────────
// All SVG data lives here as authored strings. Replace asset data to swap art.
// `COLOR` token is replaced by AvatarComposite with the selected hex color.
// ViewBox: 0 0 100 100. Head centroid: cx=50 cy=40. Circle-clipped by consumer.
//
// Layer render order (AvatarComposite):
//   background → hair_back → outfit → face/skin → face_features →
//   facial_hair → hair_front → glasses → headwear
//   (coversHair: headwear → face_opening → features → facial_hair → glasses)

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
// Each face SVG provides the head + neck shape filled with COLOR (skin).
// Head center: cx=50, cy=40. Neck connects at the bottom of the head.
export interface FaceDef {
  id: FaceId;
  label: string; labelEs: string;
  svg: string;
}
export const FACES: FaceDef[] = [
  {
    id: 'face_round',
    label: 'Round', labelEs: 'Redondo',
    // Head: rx=23 ry=25, chin at y≈65. Neck rect slightly narrower.
    svg: `<ellipse cx="50" cy="40" rx="23" ry="25" fill="COLOR"/>
<rect x="44" y="62" width="12" height="12" rx="3" fill="COLOR"/>`,
  },
  {
    id: 'face_oval',
    label: 'Oval', labelEs: 'Ovalado',
    // Taller, narrower — classic portrait oval.
    svg: `<ellipse cx="50" cy="40" rx="20" ry="28" fill="COLOR"/>
<rect x="44" y="65" width="12" height="11" rx="3" fill="COLOR"/>`,
  },
  {
    id: 'face_angular',
    label: 'Angular', labelEs: 'Angular',
    // Strong jaw with defined cheekbones.
    svg: `<path d="M28 40 Q28 15 50 14 Q72 15 72 40 L68 56 Q61 67 50 67 Q39 67 32 56 Z" fill="COLOR"/>
<rect x="44" y="64" width="12" height="11" rx="2" fill="COLOR"/>`,
  },
];

// ── Face features (shared, not user-selectable) ───────────────────────────────
// Coordinate reference (round face): eyes cy=39, mouth cy=54.
// Facial hair renders ABOVE this layer. Front hair renders ABOVE facial hair.
// Glasses render ABOVE front hair.
export const FACE_FEATURES_SVG = `
<path d="M35 32 Q41 29 47 32" fill="none" stroke="#1a1a2e" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>
<path d="M53 32 Q59 29 65 32" fill="none" stroke="#1a1a2e" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>
<ellipse cx="41" cy="39" rx="5" ry="5.5" fill="#1a1a2e"/>
<ellipse cx="59" cy="39" rx="5" ry="5.5" fill="#1a1a2e"/>
<circle cx="43.5" cy="37" r="1.5" fill="rgba(255,255,255,0.55)"/>
<circle cx="61.5" cy="37" r="1.5" fill="rgba(255,255,255,0.55)"/>
<path d="M50 46 Q47.5 50 48.5 52 Q50 53 51.5 52 Q52.5 50 50 46" fill="none" stroke="#1a1a2e" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
<path d="M43 54 Q50 59.5 57 54" fill="none" stroke="#1a1a2e" stroke-width="2.3" stroke-linecap="round"/>
`;

// ── Hair ───────────────────────────────────────────────────────────────────────
// `back`  → renders BEHIND the face/skin layer (below face shape).
// `front` → renders ABOVE facial-hair but keeps only the crown cap;
//           hanging strands that would cover the face MUST go in `back`.
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
    // Tight cap — no back layer needed.
    front: `<path d="M27 42 Q25 17 50 15 Q75 17 73 42 Q63 35 50 34 Q37 35 27 42 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_medium_straight',
    label: 'Straight, Medium', labelEs: 'Liso, medio',
    // Back layer: hair falls to mid-neck on the sides.
    back: `<path d="M27 42 L23 70 Q23 78 29 80 L31 45 Q30 18 50 16 Q70 18 69 45 L71 80 Q77 78 77 70 L73 42 Q73 17 50 15 Q27 17 27 42 Z" fill="COLOR"/>`,
    front: `<path d="M27 42 Q25 17 50 15 Q75 17 73 42 Q63 35 50 34 Q37 35 27 42 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_long',
    label: 'Straight, Long', labelEs: 'Liso, largo',
    // Back layer: hair falls below shoulders.
    back: `<path d="M27 42 L21 82 Q21 92 29 94 L31 45 Q30 18 50 16 Q70 18 69 45 L71 94 Q79 92 79 82 L73 42 Q73 17 50 15 Q27 17 27 42 Z" fill="COLOR"/>`,
    front: `<path d="M27 42 Q25 17 50 15 Q75 17 73 42 Q63 35 50 34 Q37 35 27 42 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_short_curly',
    label: 'Short Curly', labelEs: 'Rizado corto',
    // Clustered curls forming a tight cap.
    front: `<ellipse cx="50" cy="26" rx="24" ry="14" fill="COLOR"/>
<circle cx="31" cy="25" r="8" fill="COLOR"/>
<circle cx="43" cy="17" r="9" fill="COLOR"/>
<circle cx="57" cy="17" r="9" fill="COLOR"/>
<circle cx="69" cy="25" r="8" fill="COLOR"/>
<circle cx="50" cy="13" r="8" fill="COLOR"/>`,
  },
  {
    id: 'hair_afro',
    label: 'Afro', labelEs: 'Afro',
    // Large halo — back layer so face renders on top of it.
    back: `<ellipse cx="50" cy="32" rx="34" ry="28" fill="COLOR"/>`,
    front: ``,
  },
  {
    id: 'hair_locs',
    label: 'Locs', labelEs: 'Rastas',
    // All hanging loc strands go in back layer; only crown cap stays in front.
    back: `<path d="M27 44 L23 70 Q23 78 29 80 L31 46 Q30 20 50 18 Q70 20 69 46 L71 80 Q77 78 77 70 L73 44 Q73 18 50 16 Q27 18 27 44 Z" fill="COLOR"/>
<rect x="20" y="54" width="8" height="30" rx="4" fill="COLOR"/>
<rect x="72" y="54" width="8" height="30" rx="4" fill="COLOR"/>
<rect x="29" y="62" width="7" height="24" rx="3.5" fill="COLOR" opacity="0.85"/>
<rect x="64" y="62" width="7" height="24" rx="3.5" fill="COLOR" opacity="0.85"/>`,
    front: `<path d="M27 44 Q25 18 50 16 Q75 18 73 44 Q63 36 50 35 Q37 36 27 44 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_braids',
    label: 'Braids', labelEs: 'Trenzas',
    // Side-hanging braids in back layer; only the scalp cap in front.
    // This prevents strands from covering eyes, nose, or mouth.
    back: `<path d="M27 44 L24 68 Q24 76 30 78 L32 46 Q31 18 50 16 Q69 18 68 46 L70 78 Q76 76 76 68 L73 44 Q73 16 50 14 Q27 16 27 44 Z" fill="COLOR"/>
<rect x="21" y="50" width="10" height="36" rx="5" fill="COLOR"/>
<rect x="69" y="50" width="10" height="36" rx="5" fill="COLOR"/>`,
    front: `<path d="M27 44 Q25 16 50 14 Q75 16 73 44 Q63 36 50 35 Q37 36 27 44 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_bun',
    label: 'Bun', labelEs: 'Moño',
    // High bun sits above the head.
    front: `<circle cx="50" cy="9" r="11" fill="COLOR"/>
<ellipse cx="50" cy="19" rx="9" ry="5" fill="COLOR"/>
<path d="M27 42 Q25 20 50 18 Q75 20 73 42 Q64 38 50 37 Q36 38 27 42 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_wavy',
    label: 'Wavy, Medium', labelEs: 'Ondulado, medio',
    // Wavy side hair falls to mid-neck.
    back: `<path d="M25 44 L21 64 Q23 72 25 76 Q29 72 27 62 L27 46 Q27 18 50 16 Q73 18 73 46 L73 62 Q71 72 75 76 Q77 72 79 64 L75 44 Q75 16 50 14 Q25 16 25 44 Z" fill="COLOR"/>`,
    front: `<path d="M27 44 Q25 18 50 16 Q75 18 73 44 Q66 36 60 38 Q55 40 50 38 Q45 36 40 38 Q34 40 27 44 Z" fill="COLOR"/>`,
  },
  {
    id: 'hair_coily_short',
    label: 'Coily, Short', labelEs: 'Coily, corto',
    // Dense natural coils — low dome shape.
    front: `<ellipse cx="50" cy="27" rx="25" ry="15" fill="COLOR"/>
<circle cx="33" cy="26" r="6" fill="COLOR"/>
<circle cx="67" cy="26" r="6" fill="COLOR"/>`,
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
// Renders ABOVE face features, BELOW front hair.
// Positioned below the mouth (y≈54–59) to avoid covering eyes/nose/mouth.
// COLOR → hairColor (inherits user's selected hair color).
export interface FacialHairDef {
  id: FacialHairId;
  label: string; labelEs: string;
  svg: string;
}
export const FACIAL_HAIR: FacialHairDef[] = [
  {
    id: 'fh_stubble',
    label: 'Stubble', labelEs: 'Barba incipiente',
    // Chin-area coverage — clearly below mouth (mouth center at y≈54).
    svg: `<ellipse cx="50" cy="60" rx="12" ry="7" fill="COLOR" opacity="0.5"/>`,
  },
  {
    id: 'fh_beard_short',
    label: 'Short Beard', labelEs: 'Barba corta',
    // Full lower-face beard, starts just below mouth.
    svg: `<path d="M37 57 Q36 68 50 70 Q64 68 63 57 Q57 63 50 63 Q43 63 37 57 Z" fill="COLOR" opacity="0.9"/>`,
  },
  {
    id: 'fh_mustache',
    label: 'Mustache', labelEs: 'Bigote',
    // Upper-lip mustache, sits just above mouth center (y≈51–55).
    svg: `<path d="M41 53 Q45.5 57 50 55 Q54.5 57 59 53 Q55 51 50 52 Q45 51 41 53 Z" fill="COLOR"/>`,
  },
];

// ── Glasses ────────────────────────────────────────────────────────────────────
// Renders ABOVE front hair, BELOW headwear.
// Centered on eyes: left eye cx=41 cy=39, right eye cx=59 cy=39.
export interface GlassesDef {
  id: GlassesId;
  label: string; labelEs: string;
  svg: string;
}
const GL = '#1a1a2e';
const GL_LENS = 'rgba(180,220,255,0.07)';
export const GLASSES: GlassesDef[] = [
  {
    id: 'gl_round',
    label: 'Round', labelEs: 'Redondos',
    svg: `<circle cx="41" cy="39" r="8.5" fill="${GL_LENS}" stroke="${GL}" stroke-width="2.4"/>
<circle cx="59" cy="39" r="8.5" fill="${GL_LENS}" stroke="${GL}" stroke-width="2.4"/>
<line x1="49.5" y1="39" x2="50.5" y2="39" stroke="${GL}" stroke-width="2.4"/>
<line x1="68.5" y1="38" x2="76" y2="37.5" stroke="${GL}" stroke-width="1.8"/>
<line x1="31.5" y1="38" x2="24" y2="37.5" stroke="${GL}" stroke-width="1.8"/>`,
  },
  {
    id: 'gl_square',
    label: 'Square', labelEs: 'Cuadrados',
    // Lens centers at (41,39) and (59,39), w=20 h=14.
    svg: `<rect x="30" y="32" width="20" height="14" rx="2.5" fill="${GL_LENS}" stroke="${GL}" stroke-width="2.4"/>
<rect x="50" y="32" width="20" height="14" rx="2.5" fill="${GL_LENS}" stroke="${GL}" stroke-width="2.4"/>
<line x1="50" y1="39" x2="50" y2="39" stroke="${GL}" stroke-width="2.4"/>
<line x1="68" y1="37" x2="76" y2="36.5" stroke="${GL}" stroke-width="1.8"/>
<line x1="30" y1="37" x2="22" y2="36.5" stroke="${GL}" stroke-width="1.8"/>`,
  },
  {
    id: 'gl_semi',
    label: 'Half Rim', labelEs: 'Medio aro',
    // Top-arc only — classic academic half-rim style.
    svg: `<path d="M32 40 Q41 31 50 40" fill="none" stroke="${GL}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M50 40 Q59 31 68 40" fill="none" stroke="${GL}" stroke-width="2.5" stroke-linecap="round"/>
<line x1="50" y1="40" x2="50" y2="39.5" stroke="${GL}" stroke-width="2"/>
<line x1="32" y1="40" x2="24" y2="39" stroke="${GL}" stroke-width="1.8"/>
<line x1="68" y1="40" x2="76" y2="39" stroke="${GL}" stroke-width="1.8"/>`,
  },
];

// ── Headwear ───────────────────────────────────────────────────────────────────
// Renders as the topmost layer (above glasses normally; see AvatarComposite).
// `coversHair: true` → AvatarComposite skips hair layers and re-renders face
// opening + features + facial hair + glasses on top of the headwear.
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
    svg: `<path d="M26 35 Q26 10 50 9 Q74 10 74 35 Z" fill="COLOR"/>
<path d="M26 35 L13 35 Q10 35 10 38 Q10 42 15 42 L27 41" fill="COLOR"/>
<circle cx="50" cy="9" r="3.5" fill="COLOR" opacity="0.7"/>
<rect x="22" y="34" width="56" height="5" rx="2.5" fill="COLOR" opacity="0.65"/>`,
  },
  {
    id: 'hw_hijab',
    label: 'Hijab', labelEs: 'Hijab',
    color: '#2d4a6e',
    coversHair: true,
    svg: `<path d="M19 45 Q17 14 50 11 Q83 14 81 45 L81 78 Q66 92 50 92 Q34 92 19 78 Z" fill="COLOR"/>`,
  },
  {
    id: 'hw_wrap',
    label: 'Head Wrap', labelEs: 'Turbante',
    color: '#4a2d6e',
    coversHair: true,
    svg: `<ellipse cx="50" cy="25" rx="31" ry="21" fill="COLOR"/>
<path d="M19 25 Q19 11 50 9 Q81 11 81 25 Q70 18 50 17 Q30 18 19 25 Z" fill="COLOR" opacity="0.65"/>
<path d="M19 25 Q17 34 22 38" fill="none" stroke="COLOR" stroke-width="4.5" stroke-linecap="round" opacity="0.8"/>
<circle cx="50" cy="9" r="7" fill="COLOR" opacity="0.8"/>`,
  },
  {
    id: 'hw_beanie',
    label: 'Beanie', labelEs: 'Gorro',
    color: '#1e3a3a',
    svg: `<path d="M23 37 Q23 10 50 9 Q77 10 77 37 L75 43 Q62 37 50 37 Q38 37 25 43 Z" fill="COLOR"/>
<rect x="21" y="37" width="58" height="7" rx="3.5" fill="COLOR" opacity="0.7"/>`,
  },
];

// ── Outfit ─────────────────────────────────────────────────────────────────────
// Fills the lower portion (y ≈ 59–100). COLOR → outfit color.
// Outfit renders BEFORE the face shape so the face covers the collar seam.
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
    color: '#1e3a5f',
    svg: `<path d="M13 100 L13 74 C13 65 24 61 37 60 L44 58 L50 64 L56 58 L63 60 C76 61 87 65 87 74 L87 100 Z" fill="COLOR"/>`,
  },
  {
    id: 'outfit_hoodie',
    label: 'Hoodie', labelEs: 'Sudadera',
    color: '#374151',
    svg: `<path d="M11 100 L11 73 C11 63 22 59 37 58 L44 56 L50 63 L56 56 L63 58 C78 59 89 63 89 73 L89 100 Z" fill="COLOR"/>
<rect x="38" y="77" width="24" height="15" rx="4" fill="COLOR" opacity="0.55"/>
<line x1="46" y1="63" x2="44" y2="77" stroke="COLOR" stroke-width="2" opacity="0.45"/>
<line x1="54" y1="63" x2="56" y2="77" stroke="COLOR" stroke-width="2" opacity="0.45"/>`,
  },
  {
    id: 'outfit_jacket',
    label: 'Jacket', labelEs: 'Chaqueta',
    color: '#111827',
    svg: `<path d="M13 100 L13 73 C13 64 25 61 38 60 L44 58 L50 64 L56 58 L62 60 C75 61 87 64 87 73 L87 100 Z" fill="COLOR"/>
<path d="M44 58 L40 68 L50 64 L60 68 L56 58" fill="COLOR" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
<circle cx="50" cy="75" r="2" fill="rgba(255,255,255,0.15)"/>
<circle cx="50" cy="83" r="2" fill="rgba(255,255,255,0.15)"/>`,
  },
  {
    id: 'outfit_turtleneck',
    label: 'Turtleneck', labelEs: 'Cuello alto',
    color: '#475569',
    // Collar extends up from shoulder; face shape renders on top, covering overlap.
    svg: `<path d="M15 100 L15 73 C15 65 25 62 38 61 L44 59 L56 59 L62 61 C75 62 85 65 85 73 L85 100 Z" fill="COLOR"/>
<path d="M44 59 L44 54 Q44 50 50 50 Q56 50 56 54 L56 59 Q53 57 50 57 Q47 57 44 59 Z" fill="COLOR"/>`,
  },
  {
    id: 'outfit_buttonup',
    label: 'Button-Up', labelEs: 'Camisa de botones',
    color: '#d1d5db',
    svg: `<path d="M13 100 L13 73 C13 65 24 61 37 60 L44 58 L50 64 L56 58 L63 60 C76 61 87 65 87 73 L87 100 Z" fill="COLOR"/>
<path d="M44 58 L42 67 L50 63 L58 67 L56 58" fill="COLOR" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>
<line x1="50" y1="64" x2="50" y2="94" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>
<circle cx="50" cy="71" r="2" fill="rgba(0,0,0,0.18)"/>
<circle cx="50" cy="79" r="2" fill="rgba(0,0,0,0.18)"/>
<circle cx="50" cy="87" r="2" fill="rgba(0,0,0,0.18)"/>`,
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

// ─── Valid ID sets (used by Firestore rules validation) ────────────────────────
export const VALID_SKIN_IDS       = new Set(SKINS.map(s => s.id));
export const VALID_FACE_IDS       = new Set(FACES.map(f => f.id));
export const VALID_HAIR_IDS       = new Set(HAIR_STYLES.map(h => h.id));
export const VALID_HAIR_COLOR_IDS = new Set(HAIR_COLORS.map(c => c.id));
export const VALID_FACIAL_HAIR    = new Set(FACIAL_HAIR.map(f => f.id));
export const VALID_GLASSES        = new Set(GLASSES.map(g => g.id));
export const VALID_HEADWEAR       = new Set(HEADWEAR.map(h => h.id));
export const VALID_OUTFIT_IDS     = new Set(OUTFITS.map(o => o.id));
export const VALID_BG_IDS         = new Set(BACKGROUNDS.map(b => b.id));
