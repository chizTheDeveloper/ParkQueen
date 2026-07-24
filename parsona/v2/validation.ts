import type { AvatarConfig } from '../types';
import { getDefaultAvatar } from '../presets';
import {
  ACCESSORY_IDS,
  BACKGROUND_IDS,
  BASE_STYLE_IDS,
  HAIR_IDS,
  SKIN_IDS,
  TOP_IDS,
} from './constants';
import type { AvatarConfigV2, V2AssetManifestEntry } from './types';
import { AVATAR_V2_KEYS } from './types';
import { resolveApprovedV2Layers } from './selectors';

function includes<T>(values: readonly T[], value: unknown): value is T {
  return values.includes(value as T);
}

export function isValidAvatarConfigV2(value: unknown): value is AvatarConfigV2 {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== AVATAR_V2_KEYS.length) return false;
  if (!keys.every(key => (AVATAR_V2_KEYS as readonly string[]).includes(key))) return false;
  return obj.version === 2
    && includes(BASE_STYLE_IDS, obj.baseStyle)
    && includes(SKIN_IDS, obj.skin)
    && includes(HAIR_IDS, obj.hair)
    && includes(ACCESSORY_IDS, obj.accessory)
    && includes(TOP_IDS, obj.top)
    && includes(BACKGROUND_IDS, obj.background);
}

const LOCAL_PATH = /^\/parsona-v2\/[a-z0-9_./-]+\.(?:webp|png)$/;

export function isSafeLocalAssetPath(path: string): boolean {
  return LOCAL_PATH.test(path)
    && !path.includes('..')
    && !path.includes('?')
    && !path.includes('#');
}

export function validateV2Manifest(entries: readonly V2AssetManifestEntry[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const entry of entries) {
    const key = `${entry.category}:${entry.id}`;
    if (ids.has(key)) errors.push(`Duplicate ID: ${key}`);
    ids.add(key);
    if (!entry.label.en.trim() || !entry.label.es.trim()) errors.push(`Missing label: ${key}`);
    if (!entry.description.en.trim() || !entry.description.es.trim()) errors.push(`Missing description: ${key}`);
    if (entry.version !== 2) errors.push(`Invalid version: ${key}`);

    if (entry.status === 'approved') {
      const hasBothStyles = entry.compatibleBaseStyles.includes('feminine')
        && entry.compatibleBaseStyles.includes('masculine');
      const hasRequiredPaths = entry.category === 'hair'
        ? Boolean(
            entry.paths.feminineBack
            && entry.paths.masculineBack
            && entry.paths.feminineFront
            && entry.paths.masculineFront
          )
        : Boolean(entry.paths.feminine && entry.paths.masculine);
      if (!hasBothStyles || !hasRequiredPaths) {
        errors.push(`Approved option missing base-style variant: ${key}`);
      }
    }
    for (const path of Object.values(entry.paths)) {
      if (path === null || path === undefined) continue;
      if (!isSafeLocalAssetPath(path)) errors.push(`Asset path must be local: ${path}`);
      if (paths.has(path) && entry.category !== 'background') errors.push(`Duplicate path: ${path}`);
      paths.add(path);
    }
  }
  return errors;
}

export function resolveAvatarForDisplay(raw: unknown, userId: string): AvatarConfig | AvatarConfigV2 {
  if (isValidAvatarConfigV2(raw) && resolveApprovedV2Layers(raw)) {
    return raw;
  }
  return getDefaultAvatar(userId);
}
