import type { AvatarConfig } from './types';
import type { ParsedPreset } from './types';
import { PARSONA_VERSION } from './types';

// ─── Default Parsona presets ───────────────────────────────────────────────────
// Shown during signup and used as the deterministic fallback for users without
// a saved avatar. Each preset covers a different combination without implying
// demographic categories.

export const PARSONA_PRESETS: ParsedPreset[] = [
  {
    id: 'preset_royal_night',
    label: 'Royal Night',
    labelEs: 'Noche Real',
    avatar: {
      version: PARSONA_VERSION,
      skin: 'skin_01',
      face: 'face_round',
      hair: 'hair_medium_straight',
      hairColor: 'hair_dark_brown',
      facialHair: null,
      glasses: null,
      headwear: null,
      outfit: 'outfit_jacket',
      background: 'bg_navy',
    },
  },
  {
    id: 'preset_cloud_nine',
    label: 'Cloud Nine',
    labelEs: 'Nueve Nubes',
    avatar: {
      version: PARSONA_VERSION,
      skin: 'skin_03',
      face: 'face_oval',
      hair: 'hair_afro',
      hairColor: 'hair_black',
      facialHair: null,
      glasses: null,
      headwear: null,
      outfit: 'outfit_hoodie',
      background: 'bg_purple',
    },
  },
  {
    id: 'preset_golden_hour',
    label: 'Golden Hour',
    labelEs: 'Hora Dorada',
    avatar: {
      version: PARSONA_VERSION,
      skin: 'skin_04',
      face: 'face_angular',
      hair: 'hair_braids',
      hairColor: 'hair_auburn',
      facialHair: null,
      glasses: 'gl_round',
      headwear: null,
      outfit: 'outfit_tee',
      background: 'bg_gold',
    },
  },
  {
    id: 'preset_midnight_rider',
    label: 'Midnight Rider',
    labelEs: 'Jinete Nocturno',
    avatar: {
      version: PARSONA_VERSION,
      skin: 'skin_05',
      face: 'face_round',
      hair: 'hair_locs',
      hairColor: 'hair_dark_brown',
      facialHair: 'fh_beard_short',
      glasses: null,
      headwear: null,
      outfit: 'outfit_turtleneck',
      background: 'bg_midnight',
    },
  },
  {
    id: 'preset_silver_lining',
    label: 'Silver Lining',
    labelEs: 'Rayo de Plata',
    avatar: {
      version: PARSONA_VERSION,
      skin: 'skin_02',
      face: 'face_oval',
      hair: 'hair_bun',
      hairColor: 'hair_medium_brown',
      facialHair: null,
      glasses: 'gl_square',
      headwear: null,
      outfit: 'outfit_buttonup',
      background: 'bg_charcoal',
    },
  },
  {
    id: 'preset_ocean_deep',
    label: 'Ocean Deep',
    labelEs: 'Mar Profundo',
    avatar: {
      version: PARSONA_VERSION,
      skin: 'skin_01',
      face: 'face_angular',
      hair: 'hair_short',
      hairColor: 'hair_blonde',
      facialHair: 'fh_stubble',
      glasses: null,
      headwear: null,
      outfit: 'outfit_jacket',
      background: 'bg_teal',
    },
  },
  {
    id: 'preset_wrapped_up',
    label: 'Wrapped Up',
    labelEs: 'Bien Cubierta',
    avatar: {
      version: PARSONA_VERSION,
      skin: 'skin_03',
      face: 'face_round',
      hair: 'hair_short',
      hairColor: 'hair_black',
      facialHair: null,
      glasses: null,
      headwear: 'hw_hijab',
      outfit: 'outfit_tee',
      background: 'bg_navy',
    },
  },
  {
    id: 'preset_purple_reign',
    label: 'Purple Reign',
    labelEs: 'Reino Morado',
    avatar: {
      version: PARSONA_VERSION,
      skin: 'skin_06',
      face: 'face_round',
      hair: 'hair_coily_short',
      hairColor: 'hair_black',
      facialHair: null,
      glasses: 'gl_semi',
      headwear: null,
      outfit: 'outfit_hoodie',
      background: 'bg_purple',
    },
  },
];

/**
 * Returns a deterministic preset for a user with no saved avatar.
 * Uses a simple character-code sum so the same user always gets the same preset.
 */
export function getDefaultAvatar(userId: string): AvatarConfig {
  const hash = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return PARSONA_PRESETS[hash % PARSONA_PRESETS.length].avatar;
}
