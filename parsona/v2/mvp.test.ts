import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { PARSONA_V2_LAYER_ORDER } from './types';

const MVP_MODULE_PATH = 'parsona/v2/mvp.ts';
const MVP_RUNTIME_PATHS = [
  'backgrounds/parqueen_navy.webp',
  ...['feminine', 'masculine'].flatMap(style => [
    `hair/${style}/short_fade.back.webp`,
    `hair/${style}/short_fade.front.webp`,
    `hair/${style}/long_hair.back.webp`,
    `hair/${style}/long_hair.front.webp`,
    `tops/${style}/crew_neck.webp`,
    `tops/${style}/hoodie.webp`,
    `accessories/${style}/round_glasses.webp`,
  ]),
] as const;

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function inspectPng(path: string) {
  const file = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.subarray(offset + 4, offset + 8).toString('ascii');
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[9]).toBe(6);
    }
    if (type === 'IDAT') idat.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }

  const encoded = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let source = 0;
  let hasTransparency = false;
  let hasVisiblePixels = false;
  for (let y = 0; y < height; y += 1) {
    const filter = encoded[source++];
    for (let x = 0; x < stride; x += 1) {
      const raw = encoded[source++];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      const value = filter === 0 ? raw
        : filter === 1 ? raw + left
        : filter === 2 ? raw + up
        : filter === 3 ? raw + Math.floor((left + up) / 2)
        : raw + paeth(left, up, upperLeft);
      pixels[y * stride + x] = value & 0xff;
    }
  }
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) hasTransparency = true;
    if (pixels[index] > 0) hasVisiblePixels = true;
  }
  return { width, height, hasTransparency, hasVisiblePixels };
}

async function loadMvp() {
  const modulePath = './mvp';
  return import(/* @vite-ignore */ modulePath);
}

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    removeItem: () => { value = null; },
    value: () => value,
  };
}

describe('Parsona v2 DEV-only MVP', () => {
  it('defines the approved 16-combination MVP option subset', async () => {
    expect(existsSync(MVP_MODULE_PATH)).toBe(true);
    if (!existsSync(MVP_MODULE_PATH)) return;
    const mvp = await loadMvp();
    expect(mvp.MVP_HAIR_IDS).toEqual(['short_fade', 'long_hair']);
    expect(mvp.MVP_TOP_IDS).toEqual(['crew_neck', 'hoodie']);
    expect(mvp.MVP_ACCESSORY_IDS).toEqual([null, 'round_glasses']);
    expect(mvp.enumerateMvpCombinations()).toHaveLength(16);
    expect(new Set(mvp.enumerateMvpCombinations().map(JSON.stringify)).size).toBe(16);
  });

  it('resolves every MVP combination in canonical layer order', async () => {
    expect(existsSync(MVP_MODULE_PATH)).toBe(true);
    if (!existsSync(MVP_MODULE_PATH)) return;
    const mvp = await loadMvp();
    for (const avatar of mvp.enumerateMvpCombinations()) {
      const layers = mvp.resolveMvpV2Layers(avatar);
      expect(layers).not.toBeNull();
      const populated = PARSONA_V2_LAYER_ORDER.filter(key => layers?.[key]);
      expect(populated).toEqual(
        avatar.accessory
          ? ['background', 'backHair', 'top', 'base', 'frontHair', 'accessory']
          : ['background', 'backHair', 'top', 'base', 'frontHair'],
      );
      for (const path of Object.values(layers ?? {})) {
        expect(existsSync(`public${String(path)}`), String(path)).toBe(true);
      }
    }
  });

  it('exports exactly the provisional MVP layers with the correct alpha contracts', () => {
    expect(MVP_RUNTIME_PATHS).toHaveLength(15);
    const actualRuntime = readdirSync('public/parsona-v2', { recursive: true })
      .map(String)
      .filter(path => /^(?:backgrounds|hair|tops|accessories)[\\/].+\.webp$/.test(path))
      .map(path => path.replaceAll('\\', '/'))
      .sort();
    expect(actualRuntime).toEqual([...MVP_RUNTIME_PATHS].sort());
    for (const runtimePath of MVP_RUNTIME_PATHS) {
      const runtime = `public/parsona-v2/${runtimePath}`;
      const master = `artwork/parsona-v2/masters/${runtimePath.replace(/\.webp$/, '.png')}`;
      expect(existsSync(runtime), runtime).toBe(true);
      expect(existsSync(master), master).toBe(true);
      const metadata = inspectPng(master);
      expect(metadata).toMatchObject({
        width: 1024,
        height: 1024,
        hasVisiblePixels: true,
        hasTransparency: runtimePath !== 'backgrounds/parqueen_navy.webp',
      });
      expect(readFileSync(runtime).length).toBeLessThanOrEqual(400 * 1024);
    }
  });

  it('exposes only artwork-backed choices and never substitutes unavailable IDs', async () => {
    expect(existsSync(MVP_MODULE_PATH)).toBe(true);
    if (!existsSync(MVP_MODULE_PATH)) return;
    const mvp = await loadMvp();
    expect(mvp.isMvpAvatarConfig({ ...mvp.MVP_DEFAULT_AVATAR, hair: 'short_curls' })).toBe(false);
    expect(mvp.resolveMvpV2Layers({ ...mvp.MVP_DEFAULT_AVATAR, hair: 'short_curls' })).toBeNull();
  });

  it('saves and restores a schema-valid local draft', async () => {
    expect(existsSync(MVP_MODULE_PATH)).toBe(true);
    if (!existsSync(MVP_MODULE_PATH)) return;
    const mvp = await loadMvp();
    const storage = memoryStorage();
    const draft = {
      ...mvp.MVP_DEFAULT_AVATAR,
      baseStyle: 'masculine',
      hair: 'long_hair',
      accessory: 'round_glasses',
      top: 'hoodie',
    };
    expect(mvp.saveMvpDraft(storage, draft)).toBe(true);
    expect(mvp.loadMvpDraft(storage)).toEqual(draft);
  });

  it('discards an invalid local draft and returns the deterministic MVP default', async () => {
    expect(existsSync(MVP_MODULE_PATH)).toBe(true);
    if (!existsSync(MVP_MODULE_PATH)) return;
    const mvp = await loadMvp();
    const storage = memoryStorage(JSON.stringify({ version: 2, hair: 'not-real' }));
    expect(mvp.loadMvpDraft(storage)).toEqual(mvp.MVP_DEFAULT_AVATAR);
    expect(storage.value()).toBeNull();
  });

  it('randomizes and resets only within the artwork-backed subset', async () => {
    expect(existsSync(MVP_MODULE_PATH)).toBe(true);
    if (!existsSync(MVP_MODULE_PATH)) return;
    const mvp = await loadMvp();
    for (const random of [0, 0.24, 0.51, 0.99]) {
      expect(mvp.isMvpAvatarConfig(mvp.randomizeMvpAvatar(() => random))).toBe(true);
    }
    expect(mvp.resetMvpAvatar()).toEqual(mvp.MVP_DEFAULT_AVATAR);
  });

  it('keeps the MVP implementation independent from Firebase and Firestore', () => {
    const paths = ['parsona/v2/mvp.ts', 'views/ParsonaV2MvpCreator.tsx'];
    for (const path of paths) {
      expect(existsSync(path)).toBe(true);
      if (!existsSync(path)) continue;
      expect(readFileSync(path, 'utf8')).not.toMatch(/firebase|firestore|setDoc|updateDoc|addDoc/i);
    }
  });
});
