import { PARSONA_V2_LAYER_ORDER, type ResolvedV2Layers } from './types';

export const PREMIUM_MVP_STORAGE_KEY = 'parqueen.parsona-v2.premium-preset';
export const PREMIUM_MVP_PRESETS = {
  feminine: { baseStyle: 'feminine', skin: 'tone_03', hair: 'long_hair', top: 'hoodie', accessory: 'round_glasses', background: 'parqueen_navy' },
  masculine: { baseStyle: 'masculine', skin: 'tone_03', hair: 'short_fade', top: 'crew_neck', accessory: null, background: 'parqueen_navy' },
} as const;
export type PremiumPresetId = keyof typeof PREMIUM_MVP_PRESETS;

export function isPremiumPresetId(value: unknown): value is PremiumPresetId {
  return value === 'feminine' || value === 'masculine';
}
export function loadPremiumPreset(storage: Pick<Storage, 'getItem' | 'removeItem'>): PremiumPresetId {
  const value = storage.getItem(PREMIUM_MVP_STORAGE_KEY);
  if (isPremiumPresetId(value)) return value;
  if (value !== null) storage.removeItem(PREMIUM_MVP_STORAGE_KEY);
  return 'feminine';
}
export function savePremiumPreset(storage: Pick<Storage, 'setItem'>, value: unknown): boolean {
  if (!isPremiumPresetId(value)) return false;
  storage.setItem(PREMIUM_MVP_STORAGE_KEY, value);
  return true;
}
export function premiumPresetLayers(id: PremiumPresetId, asset: (path: string) => string): ResolvedV2Layers {
  const prefix = id;
  return {
    background: asset('parqueen-navy.webp'),
    backHair: asset(`${prefix}/back-hair.webp`),
    top: asset(`${prefix}/top.webp`),
    base: asset(`${prefix}/base.webp`),
    frontHair: asset(`${prefix}/front-hair.webp`),
    ...(id === 'feminine' ? { accessory: asset('feminine/accessory.webp') } : {}),
  };
}
export const PREMIUM_MVP_LAYER_ORDER = PARSONA_V2_LAYER_ORDER;
