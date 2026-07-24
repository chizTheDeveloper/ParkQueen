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
import { AVATAR_V2_KEYS, PARSONA_V2_LAYER_ORDER } from './types';
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

export interface V2ArtworkFileMetadata {
  path: string;
  width: number;
  height: number;
  byteLength: number;
  hasTransparency: boolean;
  hasVisiblePixels: boolean;
}

export interface V2ArtworkValidationOptions {
  requireAllFiles?: boolean;
  layerOrder?: readonly string[];
}

const ARTWORK_CANVAS_SIZE = 1024;
const MAX_ARTWORK_BYTES = 400 * 1024;

export function validateV2Manifest(
  entries: readonly V2AssetManifestEntry[],
  files?: readonly V2ArtworkFileMetadata[],
  options: V2ArtworkValidationOptions = {},
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  const categoriesByPath = new Map<string, V2AssetManifestEntry['category']>();

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
      categoriesByPath.set(path, entry.category);
    }
  }

  if (files) {
    const filesByPath = new Map<string, V2ArtworkFileMetadata>();
    for (const file of files) {
      if (filesByPath.has(file.path)) errors.push(`Duplicate file: ${file.path}`);
      filesByPath.set(file.path, file);
      if (!paths.has(file.path)) errors.push(`Unexpected asset: ${file.path}`);
    }

    for (const path of paths) {
      const file = filesByPath.get(path);
      const entryRequiresFile = entries.some(entry =>
        Object.values(entry.paths).includes(path)
        && (entry.status === 'review' || entry.status === 'approved'));
      if (!file) {
        if (options.requireAllFiles || entryRequiresFile) errors.push(`Missing asset: ${path}`);
        continue;
      }
      if (file.width !== ARTWORK_CANVAS_SIZE || file.height !== ARTWORK_CANVAS_SIZE) {
        errors.push(`Wrong canvas dimensions: ${path}`);
      }
      if (categoriesByPath.get(path) === 'background' && file.hasTransparency) {
        errors.push(`Background must be opaque: ${path}`);
      }
      if (categoriesByPath.get(path) !== 'background' && !file.hasTransparency) {
        errors.push(`Transparency required: ${path}`);
      }
      if (!file.hasVisiblePixels) errors.push(`Empty asset: ${path}`);
      if (file.byteLength > MAX_ARTWORK_BYTES) errors.push(`Asset exceeds 400 KiB: ${path}`);
    }
  }

  if (
    options.layerOrder
    && (
      options.layerOrder.length !== PARSONA_V2_LAYER_ORDER.length
      || options.layerOrder.some((layer, index) => layer !== PARSONA_V2_LAYER_ORDER[index])
    )
  ) {
    errors.push('Incorrect layer order');
  }

  return errors;
}

export function resolveAvatarForDisplay(raw: unknown, userId: string): AvatarConfig | AvatarConfigV2 {
  if (isValidAvatarConfigV2(raw) && resolveApprovedV2Layers(raw)) {
    return raw;
  }
  return getDefaultAvatar(userId);
}
