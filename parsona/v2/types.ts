export const PARSONA_V2_VERSION = 2 as const;

export type BaseStyleId = 'feminine' | 'masculine';
export type SkinToneId = 'tone_01' | 'tone_02' | 'tone_03' | 'tone_04' | 'tone_05';
export type HairStyleId =
  | 'short_fade'
  | 'short_curls'
  | 'medium_textured'
  | 'long_hair'
  | 'braids_locs';
export type AccessoryId =
  | 'round_glasses'
  | 'square_glasses'
  | 'cap_beanie'
  | 'head_covering';
export type TopId =
  | 'crew_neck'
  | 'hoodie'
  | 'structured_jacket'
  | 'turtleneck'
  | 'smart_casual';
export type V2BackgroundId = 'parqueen_navy';

export interface AvatarConfigV2 {
  version: typeof PARSONA_V2_VERSION;
  baseStyle: BaseStyleId;
  skin: SkinToneId;
  hair: HairStyleId;
  accessory: AccessoryId | null;
  top: TopId;
  background: V2BackgroundId;
}
export const AVATAR_V2_KEYS: ReadonlyArray<keyof AvatarConfigV2> = [
  'version', 'baseStyle', 'skin', 'hair', 'accessory', 'top', 'background',
];

export type AssetStatus = 'pending' | 'review' | 'approved';
export type V2AssetCategory = 'background' | 'skin' | 'hair' | 'accessory' | 'top';

export interface LocalizedText {
  en: string;
  es: string;
}

export interface V2AssetPaths {
  feminine: string | null;
  masculine: string | null;
  feminineBack?: string | null;
  masculineBack?: string | null;
  feminineFront?: string | null;
  masculineFront?: string | null;
  feminineForeground?: string | null;
  masculineForeground?: string | null;
}

export interface V2AssetManifestEntry {
  id: string;
  category: V2AssetCategory;
  compatibleBaseStyles: readonly BaseStyleId[];
  paths: V2AssetPaths;
  label: LocalizedText;
  description: LocalizedText;
  status: AssetStatus;
  version: typeof PARSONA_V2_VERSION;
}

export interface ResolvedV2Layers {
  background: string;
  backHair?: string;
  top: string;
  base: string;
  frontHair?: string;
  accessory?: string;
  foreground?: string;
}
