import {
  ACCESSORY_IDS,
  BACKGROUND_IDS,
  BASE_STYLE_IDS,
  HAIR_IDS,
  SKIN_IDS,
  TOP_IDS,
} from './constants';
import type { AvatarConfigV2 } from './types';
import { isValidAvatarConfigV2 } from './validation';

export function enumerateV2Combinations(): AvatarConfigV2[] {
  const combinations: AvatarConfigV2[] = [];
  for (const baseStyle of BASE_STYLE_IDS)
    for (const skin of SKIN_IDS)
      for (const hair of HAIR_IDS)
        for (const accessory of ACCESSORY_IDS)
          for (const top of TOP_IDS)
            for (const background of BACKGROUND_IDS)
              combinations.push({ version: 2, baseStyle, skin, hair, accessory, top, background });
  return combinations;
}
export function validateAllV2Combinations() {
  const combinations = enumerateV2Combinations();
  const valid = combinations.filter(isValidAvatarConfigV2).length;
  return { total: combinations.length, valid, invalid: combinations.length - valid };
}
