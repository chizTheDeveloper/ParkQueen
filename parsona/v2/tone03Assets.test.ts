import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BATCH_1_ARTWORK_SLOTS, evaluateBatch1Artwork } from './artworkReview';

const GEOMETRY_PATH = 'artwork/parsona-v2/source/tone_03.geometry.json';
const PNG_PATHS = [
  'artwork/parsona-v2/masters/bases/feminine/tone_03.png',
  'artwork/parsona-v2/masters/bases/masculine/tone_03.png',
] as const;
const WEBP_PATHS = [
  'public/parsona-v2/bases/feminine/tone_03.webp',
  'public/parsona-v2/bases/masculine/tone_03.webp',
] as const;

interface RasterMetadata {
  width: number;
  height: number;
  hasTransparency: boolean;
  hasVisiblePixels: boolean;
  alphaBounds: { left: number; top: number; right: number; bottom: number };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function inspectRgbaPng(path: string): RasterMetadata {
  const file = readFileSync(path);
  expect(file.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
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
      expect(data[8]).toBe(8);
      expect(data[9]).toBe(6);
      expect(data[12]).toBe(0);
    }
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
    if (type === 'IEND') break;
  }

  const encoded = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = encoded[sourceOffset++];
    for (let x = 0; x < stride; x += 1) {
      const raw = encoded[sourceOffset++];
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

  let hasTransparency = false;
  let hasVisiblePixels = false;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[y * stride + x * 4 + 3];
      if (alpha < 255) hasTransparency = true;
      if (alpha > 0) {
        hasVisiblePixels = true;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return { width, height, hasTransparency, hasVisiblePixels, alphaBounds: { left, top, right, bottom } };
}

function inspectWebp(path: string) {
  const file = readFileSync(path);
  expect(file.subarray(0, 4).toString('ascii')).toBe('RIFF');
  expect(file.subarray(8, 12).toString('ascii')).toBe('WEBP');
  expect(file.subarray(12, 16).toString('ascii')).toBe('VP8X');
  return {
    width: 1 + file.readUIntLE(24, 3),
    height: 1 + file.readUIntLE(27, 3),
    hasTransparency: (file[20] & 0x10) !== 0,
    byteLength: file.length,
  };
}

describe('canonical Parsona tone_03 production bases', () => {
  it('exports only the two requested PNG masters and WebP runtime assets', () => {
    const expected = [GEOMETRY_PATH, ...PNG_PATHS, ...WEBP_PATHS];
    expect(expected.every(existsSync)).toBe(true);
    if (!expected.every(existsSync)) return;

    const masterFiles = readdirSync('artwork/parsona-v2/masters/bases', { recursive: true })
      .filter(file => String(file).endsWith('.png'));
    const runtimeFiles = readdirSync('public/parsona-v2/bases', { recursive: true })
      .filter(file => String(file).endsWith('.webp'));
    expect(masterFiles).toHaveLength(2);
    expect(runtimeFiles).toHaveLength(2);
  });

  it('keeps every shared construction anchor identical', () => {
    expect(existsSync(GEOMETRY_PATH)).toBe(true);
    if (!existsSync(GEOMETRY_PATH)) return;
    const geometry = JSON.parse(readFileSync(GEOMETRY_PATH, 'utf8'));
    expect(geometry.canvas).toEqual({ width: 1024, height: 1024 });
    expect(geometry.sharedAnchors).toEqual({
      centerX: 512,
      skullTop: 80,
      skullLeft: 300,
      skullRight: 724,
      eyeLine: 390,
      noseLine: 510,
      mouthLine: 600,
      chinLine: 700,
      earTop: 360,
      earBottom: 548,
      neckCenter: 512,
      neckBottomLeft: 384,
      neckBottomRight: 640,
      terminationLine: 940,
    });
    expect(geometry.measuredDifferences).toEqual({
      outerSkullBounds: 0,
      eyeLine: 0,
      chin: 0,
      ears: 0,
      neckAnchor: 0,
      termination: 0,
    });
  });

  it('renders matching transparent alpha bounds on both 1024 px masters', () => {
    expect(PNG_PATHS.every(existsSync)).toBe(true);
    if (!PNG_PATHS.every(existsSync)) return;
    const [feminine, masculine] = PNG_PATHS.map(inspectRgbaPng);
    expect(feminine).toEqual(masculine);
    expect(feminine).toEqual({
      width: 1024,
      height: 1024,
      hasTransparency: true,
      hasVisiblePixels: true,
      alphaBounds: { left: 246, top: 80, right: 777, bottom: 939 },
    });
  });

  it('exports transparent WebPs under the runtime size ceiling', () => {
    expect(WEBP_PATHS.every(existsSync)).toBe(true);
    if (!WEBP_PATHS.every(existsSync)) return;
    for (const path of WEBP_PATHS) {
      expect(inspectWebp(path)).toMatchObject({
        width: 1024,
        height: 1024,
        hasTransparency: true,
      });
      expect(readFileSync(path).length).toBeLessThanOrEqual(400 * 1024);
    }
  });

  it('continues to report the other eight base slots as missing', () => {
    const remaining = BATCH_1_ARTWORK_SLOTS.filter(
      slot => slot.skinToneId !== null && slot.skinToneId !== 'tone_03',
    );
    expect(remaining).toHaveLength(8);
    expect(remaining.every(slot => evaluateBatch1Artwork(slot, null).status === 'missing')).toBe(true);
  });
});
