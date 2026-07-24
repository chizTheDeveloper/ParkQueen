import { PARSONA_V2_MANIFEST } from './manifest';
import type {
  AvatarConfigV2,
  BaseStyleId,
  ResolvedV2Layers,
  V2AssetCategory,
  V2AssetManifestEntry,
  V2AssetPaths,
} from './types';

export function getApprovedOptions(category: V2AssetCategory): readonly V2AssetManifestEntry[] {
  return PARSONA_V2_MANIFEST.filter(
    entry => entry.category === category && entry.status === 'approved',
  );
}

function findApproved(category: V2AssetCategory, id: string): V2AssetManifestEntry | null {
  return PARSONA_V2_MANIFEST.find(
    entry => entry.category === category && entry.id === id && entry.status === 'approved',
  ) ?? null;
}

function pathFor(paths: V2AssetPaths, style: BaseStyleId): string | null {
  return paths[style];
}

export function resolveApprovedV2Layers(config: AvatarConfigV2): ResolvedV2Layers | null {
  const background = findApproved('background', config.background);
  const skin = findApproved('skin', config.skin);
  const hair = findApproved('hair', config.hair);
  const top = findApproved('top', config.top);
  const accessory = config.accessory ? findApproved('accessory', config.accessory) : null;
  if (!background || !skin || !hair || !top || (config.accessory && !accessory)) return null;

  const backgroundPath = pathFor(background.paths, config.baseStyle);
  const basePath = pathFor(skin.paths, config.baseStyle);
  const topPath = pathFor(top.paths, config.baseStyle);
  if (!backgroundPath || !basePath || !topPath) return null;

  const backHair = hair.paths[`${config.baseStyle}Back` as keyof V2AssetPaths];
  const frontHair = hair.paths[`${config.baseStyle}Front` as keyof V2AssetPaths];
  const foreground = hair.paths[`${config.baseStyle}Foreground` as keyof V2AssetPaths];

  return {
    background: backgroundPath,
    base: basePath,
    top: topPath,
    ...(typeof backHair === 'string' ? { backHair } : {}),
    ...(typeof frontHair === 'string' ? { frontHair } : {}),
    ...(accessory && pathFor(accessory.paths, config.baseStyle)
      ? { accessory: pathFor(accessory.paths, config.baseStyle)! }
      : {}),
    ...(typeof foreground === 'string' ? { foreground } : {}),
  };
}
