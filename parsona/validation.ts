import type { AvatarConfig } from './types';
import { PARSONA_VERSION, AVATAR_KEYS } from './types';
import {
  VALID_SKIN_IDS, VALID_FACE_IDS, VALID_HAIR_IDS, VALID_HAIR_COLOR_IDS,
  VALID_FACIAL_HAIR, VALID_GLASSES, VALID_HEADWEAR,
  VALID_OUTFIT_IDS, VALID_BG_IDS,
} from './assets';

/**
 * Validates an avatar object from Firestore or user input.
 * Returns true only when all fields are known valid IDs.
 * Unknown IDs (from old versions or corrupted data) return false → caller falls
 * back to a default preset rather than crashing.
 */
export function isValidAvatarConfig(value: unknown): value is AvatarConfig {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;

  // Reject any key not in the accepted schema
  for (const key of Object.keys(obj)) {
    if (!(AVATAR_KEYS as readonly string[]).includes(key)) return false;
  }

  if (obj.version !== PARSONA_VERSION) return false;
  if (!(VALID_SKIN_IDS as Set<string>).has(obj.skin as string)) return false;
  if (!(VALID_FACE_IDS as Set<string>).has(obj.face as string)) return false;
  if (!(VALID_HAIR_IDS as Set<string>).has(obj.hair as string)) return false;
  if (!(VALID_HAIR_COLOR_IDS as Set<string>).has(obj.hairColor as string)) return false;

  // Nullable optional fields
  if (obj.facialHair !== null && !(VALID_FACIAL_HAIR as Set<string>).has(obj.facialHair as string)) return false;
  if (obj.glasses !== null && !(VALID_GLASSES as Set<string>).has(obj.glasses as string)) return false;
  if (obj.headwear !== null && !(VALID_HEADWEAR as Set<string>).has(obj.headwear as string)) return false;

  if (!(VALID_OUTFIT_IDS as Set<string>).has(obj.outfit as string)) return false;
  if (!(VALID_BG_IDS as Set<string>).has(obj.background as string)) return false;

  return true;
}

/**
 * Resolves an avatar from Firestore data. Falls back to the supplied default
 * rather than throwing on invalid/missing data.
 */
export function resolveAvatar(
  raw: unknown,
  fallback: AvatarConfig,
): AvatarConfig {
  return isValidAvatarConfig(raw) ? raw : fallback;
}

/** URL and path pattern — used to reject file paths / URLs in avatar values */
const URL_PATTERN = /https?:\/\/|\/[a-z]/i;

/**
 * Guard for string fields in avatar objects — rejects URLs and paths.
 * Used in Firestore Rules tests and server-side validation.
 */
export function isCleanStringOrNull(v: unknown): boolean {
  if (v === null) return true;
  if (typeof v !== 'string') return false;
  if (v.length > 64) return false;
  if (URL_PATTERN.test(v)) return false;
  return true;
}
