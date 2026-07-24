import { BASE_STYLE_IDS } from './constants';
import { PARSONA_V2_MANIFEST } from './manifest';
import type {
  AccessoryId,
  AvatarConfigV2,
  BaseStyleId,
  HairStyleId,
  ResolvedV2Layers,
  TopId,
  V2AssetManifestEntry,
  V2AssetPaths,
} from './types';
import { isValidAvatarConfigV2 } from './validation';

export const MVP_HAIR_IDS = ['short_fade', 'long_hair'] as const satisfies readonly HairStyleId[];
export const MVP_TOP_IDS = ['crew_neck', 'hoodie'] as const satisfies readonly TopId[];
export const MVP_ACCESSORY_IDS = [null, 'round_glasses'] as const satisfies readonly (AccessoryId | null)[];
export const MVP_DRAFT_STORAGE_KEY = 'parqueen.parsona-v2.mvp-draft';

export const MVP_DEFAULT_AVATAR: AvatarConfigV2 = {
  version: 2,
  baseStyle: 'feminine',
  skin: 'tone_03',
  hair: 'short_fade',
  accessory: null,
  top: 'crew_neck',
  background: 'parqueen_navy',
};

interface MvpStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function includes<T>(values: readonly T[], value: unknown): value is T {
  return values.includes(value as T);
}

export function isMvpAvatarConfig(value: unknown): value is AvatarConfigV2 {
  return isValidAvatarConfigV2(value)
    && value.skin === 'tone_03'
    && value.background === 'parqueen_navy'
    && includes(MVP_HAIR_IDS, value.hair)
    && includes(MVP_TOP_IDS, value.top)
    && includes(MVP_ACCESSORY_IDS, value.accessory);
}

export function enumerateMvpCombinations(): AvatarConfigV2[] {
  return BASE_STYLE_IDS.flatMap(baseStyle =>
    MVP_HAIR_IDS.flatMap(hair =>
      MVP_TOP_IDS.flatMap(top =>
        MVP_ACCESSORY_IDS.map(accessory => ({
          ...MVP_DEFAULT_AVATAR,
          baseStyle,
          hair,
          top,
          accessory,
        })),
      ),
    ),
  );
}

function entry(category: V2AssetManifestEntry['category'], id: string) {
  return PARSONA_V2_MANIFEST.find(item => item.category === category && item.id === id) ?? null;
}

function pathFor(paths: V2AssetPaths, style: BaseStyleId): string | null {
  return paths[style];
}

export function resolveMvpV2Layers(value: unknown): ResolvedV2Layers | null {
  if (!isMvpAvatarConfig(value)) return null;
  const background = entry('background', value.background);
  const skin = entry('skin', value.skin);
  const hair = entry('hair', value.hair);
  const top = entry('top', value.top);
  const accessory = value.accessory ? entry('accessory', value.accessory) : null;
  if (!background || !skin || !hair || !top || (value.accessory && !accessory)) return null;

  const backgroundPath = pathFor(background.paths, value.baseStyle);
  const basePath = pathFor(skin.paths, value.baseStyle);
  const topPath = pathFor(top.paths, value.baseStyle);
  const backHair = hair.paths[`${value.baseStyle}Back` as keyof V2AssetPaths];
  const frontHair = hair.paths[`${value.baseStyle}Front` as keyof V2AssetPaths];
  const accessoryPath = accessory ? pathFor(accessory.paths, value.baseStyle) : null;
  if (!backgroundPath || !basePath || !topPath || !backHair || !frontHair) return null;

  return {
    background: backgroundPath,
    backHair,
    top: topPath,
    base: basePath,
    frontHair,
    ...(accessoryPath ? { accessory: accessoryPath } : {}),
  };
}

export function loadMvpDraft(storage: MvpStorage): AvatarConfigV2 {
  try {
    const raw = storage.getItem(MVP_DRAFT_STORAGE_KEY);
    if (!raw) return { ...MVP_DEFAULT_AVATAR };
    const parsed: unknown = JSON.parse(raw);
    if (isMvpAvatarConfig(parsed)) return parsed;
  } catch {
    // Invalid DEV-local data is discarded below.
  }
  storage.removeItem(MVP_DRAFT_STORAGE_KEY);
  return { ...MVP_DEFAULT_AVATAR };
}

export function saveMvpDraft(storage: MvpStorage, value: unknown): boolean {
  if (!isMvpAvatarConfig(value)) return false;
  storage.setItem(MVP_DRAFT_STORAGE_KEY, JSON.stringify(value));
  return true;
}

export function randomizeMvpAvatar(random: () => number = Math.random): AvatarConfigV2 {
  const pick = <T,>(values: readonly T[]): T =>
    values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  return {
    ...MVP_DEFAULT_AVATAR,
    baseStyle: pick(BASE_STYLE_IDS),
    hair: pick(MVP_HAIR_IDS),
    top: pick(MVP_TOP_IDS),
    accessory: pick(MVP_ACCESSORY_IDS),
  };
}

export function resetMvpAvatar(): AvatarConfigV2 {
  return { ...MVP_DEFAULT_AVATAR };
}
