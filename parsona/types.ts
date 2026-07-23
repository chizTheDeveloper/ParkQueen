// ─── Parsona avatar system ────────────────────────────────────────────────────
// Assets are identified by stable string IDs. These IDs map to entries in the
// asset manifest (parsona/assets.ts). Never store display labels or file paths.

export const PARSONA_VERSION = 1 as const;

export type SkinId =
  | 'skin_01' | 'skin_02' | 'skin_03'
  | 'skin_04' | 'skin_05' | 'skin_06';

export type FaceId = 'face_round' | 'face_oval' | 'face_angular';

export type HairId =
  | 'hair_short'
  | 'hair_medium_straight'
  | 'hair_long'
  | 'hair_short_curly'
  | 'hair_afro'
  | 'hair_locs'
  | 'hair_braids'
  | 'hair_bun'
  | 'hair_wavy'
  | 'hair_coily_short';

export type HairColorId =
  | 'hair_black'
  | 'hair_dark_brown'
  | 'hair_medium_brown'
  | 'hair_auburn'
  | 'hair_blonde'
  | 'hair_gray';

export type FacialHairId = 'fh_stubble' | 'fh_beard_short' | 'fh_mustache';
export type GlassesId = 'gl_round' | 'gl_square' | 'gl_semi';
export type HeadwearId = 'hw_cap' | 'hw_hijab' | 'hw_wrap' | 'hw_beanie';

export type OutfitId =
  | 'outfit_tee'
  | 'outfit_hoodie'
  | 'outfit_jacket'
  | 'outfit_turtleneck'
  | 'outfit_buttonup';

export type BackgroundId =
  | 'bg_navy'
  | 'bg_midnight'
  | 'bg_teal'
  | 'bg_charcoal'
  | 'bg_purple'
  | 'bg_gold';

/** Stored in Firestore at users/{uid}.avatar — no display labels, no inferred identity. */
export interface AvatarConfig {
  version: typeof PARSONA_VERSION;
  skin: SkinId;
  face: FaceId;
  hair: HairId;
  hairColor: HairColorId;
  facialHair: FacialHairId | null;
  glasses: GlassesId | null;
  headwear: HeadwearId | null;
  outfit: OutfitId;
  background: BackgroundId;
}

/** A named preset that ships a complete AvatarConfig. */
export interface ParsedPreset {
  id: string;
  label: string;
  labelEs: string;
  avatar: AvatarConfig;
}

/** Keys accepted for AvatarConfig validation. */
export const AVATAR_KEYS: ReadonlyArray<keyof AvatarConfig> = [
  'version', 'skin', 'face', 'hair', 'hairColor',
  'facialHair', 'glasses', 'headwear', 'outfit', 'background',
];
