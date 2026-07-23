import type { AvatarConfig } from './types';
import type { ParsedPreset } from './types';
import { PARSONA_VERSION } from './types';

// ─── Default Parsona presets ───────────────────────────────────────────────────
// Eight curated combinations — coherent, culturally thoughtful, visually distinct.
// Each covers a unique intersection of face shape, skin tone, hair type, and style.
// Skin coverage: skin_01×2, skin_02, skin_03, skin_04, skin_05×2, skin_06.
// Backgrounds: navy, midnight, teal, charcoal, purple, gold(royal blue), navy, purple.

export const PARSONA_PRESETS: ParsedPreset[] = [
  {
    id: 'preset_royal_night',
    label: 'Royal Night',
    labelEs: 'Noche Real',
    // Polished professional. Oval face, dark straight hair, round glasses, jacket.
    avatar: {
      version: PARSONA_VERSION,
      skin: 'skin_01',
      face: 'face_oval',
      hair: 'hair_medium_straight',
      hairColor: 'hair_dark_brown',
      facialHair: null,
      glasses: 'gl_round',
      headwear: null,
      outfit: 'outfit_jacket',
      background: 'bg_navy',
    },
  },
  {
    id: 'preset_cloud_nine',
    label: 'Cloud Nine',
    labelEs: 'Nueve Nubes',
    // Natural and warm. Round face, full afro, hoodie, deep midnight backdrop.
    avatar: {
      version: PARSONA_VERSION,
      skin: 'skin_03',
      face: 'face_round',
      hair: 'hair_afro',
      hairColor: 'hair_black',
      facialHair: null,
      glasses: null,
      headwear: null,
      outfit: 'outfit_hoodie',
      background: 'bg_midnight',
    },
  },
  {
    id: 'preset_golden_hour',
    label: 'Golden Hour',
    labelEs: 'Hora Dorada',
    // Warm and creative. Angular face, auburn braids, round glasses, tee, deep royal blue.
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
    // Dramatic and distinguished. Round face, locs, short beard, turtleneck, deep purple.
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
      background: 'bg_purple',
    },
  },
  {
    id: 'preset_silver_lining',
    label: 'Silver Lining',
    labelEs: 'Rayo de Plata',
    // Classic and refined. Oval face, bun, square glasses, button-up, charcoal.
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
    // Sharp and cool. Angular face, short blonde hair, stubble, jacket, teal.
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
    // Elegant and covered. Round face, hijab, tee, navy.
    avatar: {
      version: PARSONA_VERSION,
      skin: 'skin_05',
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
    // Bold and expressive. Round face, coily hair, half-rim glasses, tee, purple.
    avatar: {
      version: PARSONA_VERSION,
      skin: 'skin_06',
      face: 'face_round',
      hair: 'hair_coily_short',
      hairColor: 'hair_black',
      facialHair: null,
      glasses: 'gl_semi',
      headwear: null,
      outfit: 'outfit_tee',
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
