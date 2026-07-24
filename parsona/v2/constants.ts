import type {
  AccessoryId,
  AvatarConfigV2,
  BaseStyleId,
  HairStyleId,
  LocalizedText,
  SkinToneId,
  TopId,
  V2BackgroundId,
} from './types';

export const PARSONA_V2_PUBLIC_ENABLED = false as const;

export const BASE_STYLE_IDS = ['feminine', 'masculine'] as const satisfies readonly BaseStyleId[];
export const SKIN_IDS = ['tone_01', 'tone_02', 'tone_03', 'tone_04', 'tone_05'] as const satisfies readonly SkinToneId[];
export const HAIR_IDS = [
  'short_fade', 'short_curls', 'medium_textured', 'long_hair', 'braids_locs',
] as const satisfies readonly HairStyleId[];
export const ACCESSORY_IDS = [
  null, 'round_glasses', 'square_glasses', 'cap_beanie', 'head_covering',
] as const satisfies readonly (AccessoryId | null)[];
export const TOP_IDS = [
  'crew_neck', 'hoodie', 'structured_jacket', 'turtleneck', 'smart_casual',
] as const satisfies readonly TopId[];
export const BACKGROUND_IDS = ['parqueen_navy'] as const satisfies readonly V2BackgroundId[];

export const PARSONA_V2_COMBINATION_COUNT =
  BASE_STYLE_IDS.length * SKIN_IDS.length * HAIR_IDS.length *
  ACCESSORY_IDS.length * TOP_IDS.length * BACKGROUND_IDS.length;

export const DEFAULT_AVATAR_V2: AvatarConfigV2 = {
  version: 2,
  baseStyle: 'feminine',
  skin: 'tone_03',
  hair: 'medium_textured',
  accessory: null,
  top: 'crew_neck',
  background: 'parqueen_navy',
};
export const V2_LABELS: Record<string, LocalizedText> = {
  feminine: { en: 'Feminine', es: 'Femenino' },
  masculine: { en: 'Masculine', es: 'Masculino' },
  tone_01: { en: 'Tone 1', es: 'Tono 1' },
  tone_02: { en: 'Tone 2', es: 'Tono 2' },
  tone_03: { en: 'Tone 3', es: 'Tono 3' },
  tone_04: { en: 'Tone 4', es: 'Tono 4' },
  tone_05: { en: 'Tone 5', es: 'Tono 5' },
  short_fade: { en: 'Short fade', es: 'Degradado corto' },
  short_curls: { en: 'Short curls', es: 'Rizos cortos' },
  medium_textured: { en: 'Medium textured', es: 'Texturizado medio' },
  long_hair: { en: 'Long hair', es: 'Cabello largo' },
  braids_locs: { en: 'Braids or locs', es: 'Trenzas o rastas' },
  none: { en: 'None', es: 'Ninguno' },
  round_glasses: { en: 'Round glasses', es: 'Gafas redondas' },
  square_glasses: { en: 'Square glasses', es: 'Gafas cuadradas' },
  cap_beanie: { en: 'Cap or beanie', es: 'Gorra o gorro' },
  head_covering: { en: 'Head covering', es: 'Cobertura para la cabeza' },
  crew_neck: { en: 'Crew neck', es: 'Cuello redondo' },
  hoodie: { en: 'Hoodie', es: 'Sudadera' },
  structured_jacket: { en: 'Structured jacket', es: 'Chaqueta estructurada' },
  turtleneck: { en: 'Turtleneck', es: 'Cuello alto' },
  smart_casual: { en: 'Smart casual', es: 'Casual elegante' },
  parqueen_navy: { en: 'ParQueen navy', es: 'Azul marino ParQueen' },
};
