import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { loadPremiumPreset, PREMIUM_MVP_LAYER_ORDER, PREMIUM_MVP_PRESETS, premiumPresetLayers, savePremiumPreset } from './premiumMvp';
import { PARSONA_V2_LAYER_ORDER } from './types';

const storage = (initial: string | null = null) => {
  let value = initial;
  return { getItem: () => value, setItem: (_k: string, v: string) => { value = v; }, removeItem: () => { value = null; }, value: () => value };
};
describe('DEV-only premium MVP presets', () => {
  it('contains exactly the two approved presets', () => expect(Object.keys(PREMIUM_MVP_PRESETS)).toEqual(['feminine', 'masculine']));
  it('resolves complete layered assets in canonical order', () => {
    expect(PREMIUM_MVP_LAYER_ORDER).toEqual(PARSONA_V2_LAYER_ORDER);
    expect(Object.keys(premiumPresetLayers('feminine', x => x))).toEqual(['background', 'backHair', 'top', 'base', 'frontHair', 'accessory']);
    expect(Object.keys(premiumPresetLayers('masculine', x => x))).toEqual(['background', 'backHair', 'top', 'base', 'frontHair']);
  });
  it('saves and restores only valid preset ids', () => { const s = storage(); expect(savePremiumPreset(s, 'masculine')).toBe(true); expect(loadPremiumPreset(s)).toBe('masculine'); });
  it('falls back safely for invalid stored values', () => { const s = storage('long_hair'); expect(loadPremiumPreset(s)).toBe('feminine'); expect(s.value()).toBeNull(); });
  it('retains only runtime assets referenced by the two approved presets', () => {
    const assetRoot = path.join(process.cwd(), 'views', 'parsona-premium-experiment-assets');
    const files = readdirSync(assetRoot, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => path.relative(assetRoot, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
      .sort();
    const referenced = [...new Set(
      (Object.keys(PREMIUM_MVP_PRESETS) as Array<keyof typeof PREMIUM_MVP_PRESETS>)
        .flatMap(id => Object.values(premiumPresetLayers(id, value => value))),
    )].sort();

    expect(files).toEqual(referenced);

    const masterRoot = path.join(process.cwd(), 'artwork', 'parsona-v2-experiments', 'premium-mvp');
    const masters = readdirSync(masterRoot, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => path.relative(masterRoot, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
      .sort();
    expect(masters).toEqual(referenced.map(file => file.replace(/\.webp$/, '.png')));
  });
});
