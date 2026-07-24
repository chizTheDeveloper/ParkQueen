import { BASE_STYLE_IDS, SKIN_IDS } from './constants';
import { PARSONA_V2_MANIFEST } from './manifest';
import type { BaseStyleId, SkinToneId } from './types';

export const PARSONA_V2_REVIEW_SIZES = [180, 120, 96, 48, 40] as const;

export interface Batch1ArtworkSlot {
  slotId: string;
  assetId: string;
  baseStyle: BaseStyleId | 'shared';
  skinToneId: SkinToneId | null;
  runtimePath: string;
  runtimeFilename: string;
  masterFilename: string;
  masterPath: string;
  requiresTransparency: boolean;
}

export interface Batch1ArtworkMetadata {
  width: number;
  height: number;
  byteLength: number;
  hasTransparency: boolean;
  hasVisiblePixels: boolean;
}

export interface Batch1ArtworkResult extends Partial<Batch1ArtworkMetadata> {
  status: 'loaded' | 'missing' | 'invalid';
  errors: string[];
}

export function classifyBatch1ArtworkResponse(
  ok: boolean,
  contentType: string | null,
): 'ready' | 'missing' {
  return ok && contentType?.toLowerCase().startsWith('image/webp') ? 'ready' : 'missing';
}

const backgroundEntry = PARSONA_V2_MANIFEST.find(entry => entry.category === 'background')!;

const runtimeFilename = (path: string) => path.split('/').at(-1)!;

export const BATCH_1_ARTWORK_SLOTS: readonly Batch1ArtworkSlot[] = [
  {
    slotId: 'background:parqueen_navy:shared',
    assetId: backgroundEntry.id,
    baseStyle: 'shared',
    skinToneId: null,
    runtimePath: backgroundEntry.paths.feminine!,
    runtimeFilename: runtimeFilename(backgroundEntry.paths.feminine!),
    masterFilename: 'parqueen_navy.png',
    masterPath: 'backgrounds/parqueen_navy.png',
    requiresTransparency: false,
  },
  ...BASE_STYLE_IDS.flatMap(baseStyle => SKIN_IDS.map(skinToneId => {
    const entry = PARSONA_V2_MANIFEST.find(
      item => item.category === 'skin' && item.id === skinToneId,
    )!;
    const path = entry.paths[baseStyle]!;
    return {
      slotId: `skin:${skinToneId}:${baseStyle}`,
      assetId: entry.id,
      baseStyle,
      skinToneId,
      runtimePath: path,
      runtimeFilename: runtimeFilename(path),
      masterFilename: `${skinToneId}.png`,
      masterPath: `bases/${baseStyle}/${skinToneId}.png`,
      requiresTransparency: true,
    };
  })),
];

export function evaluateBatch1Artwork(
  slot: Batch1ArtworkSlot,
  metadata: Batch1ArtworkMetadata | null,
): Batch1ArtworkResult {
  if (!metadata) return { status: 'missing', errors: ['File not found'] };

  const errors: string[] = [];
  if (metadata.width !== 1024 || metadata.height !== 1024) errors.push('Canvas must be 1024×1024');
  if (slot.requiresTransparency && !metadata.hasTransparency) errors.push('Transparency required');
  if (!slot.requiresTransparency && metadata.hasTransparency) errors.push('Background must be opaque');
  if (!metadata.hasVisiblePixels) errors.push('Asset is fully transparent or empty');
  if (metadata.byteLength > 400 * 1024) errors.push('Runtime file exceeds 400 KiB');

  return {
    ...metadata,
    status: errors.length === 0 ? 'loaded' : 'invalid',
    errors,
  };
}
