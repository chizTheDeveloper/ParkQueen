import { describe, expect, it } from 'vitest';
import {
  BATCH_1_ARTWORK_SLOTS,
  PARSONA_V2_REVIEW_SIZES,
  classifyBatch1ArtworkResponse,
  evaluateBatch1Artwork,
} from './artworkReview';

describe('Parsona v2 Batch 1 artwork review contract', () => {
  it('defines one opaque background and ten transparent base slots with unique IDs and paths', () => {
    expect(BATCH_1_ARTWORK_SLOTS).toHaveLength(11);
    expect(new Set(BATCH_1_ARTWORK_SLOTS.map(slot => slot.slotId)).size).toBe(11);
    expect(new Set(BATCH_1_ARTWORK_SLOTS.map(slot => slot.runtimePath)).size).toBe(11);

    const [background, ...bases] = BATCH_1_ARTWORK_SLOTS;
    expect(background).toMatchObject({
      assetId: 'parqueen_navy',
      baseStyle: 'shared',
      skinToneId: null,
      runtimePath: '/parsona-v2/backgrounds/parqueen_navy.webp',
      masterFilename: 'parqueen_navy.png',
      masterPath: 'backgrounds/parqueen_navy.png',
      requiresTransparency: false,
    });
    expect(bases).toHaveLength(10);
    expect(bases.every(slot => slot.requiresTransparency)).toBe(true);
    expect(new Set(BATCH_1_ARTWORK_SLOTS.map(slot => slot.masterPath)).size).toBe(11);
    expect(bases.map(slot => slot.masterPath)).toEqual([
      'bases/feminine/tone_01.png',
      'bases/feminine/tone_02.png',
      'bases/feminine/tone_03.png',
      'bases/feminine/tone_04.png',
      'bases/feminine/tone_05.png',
      'bases/masculine/tone_01.png',
      'bases/masculine/tone_02.png',
      'bases/masculine/tone_03.png',
      'bases/masculine/tone_04.png',
      'bases/masculine/tone_05.png',
    ]);
  });

  it('keeps the required review sizes in descending production-review order', () => {
    expect(PARSONA_V2_REVIEW_SIZES).toEqual([180, 120, 96, 48, 40]);
  });

  it('reports missing and opacity-invalid files explicitly', () => {
    const background = BATCH_1_ARTWORK_SLOTS[0];
    const base = BATCH_1_ARTWORK_SLOTS[1];

    expect(evaluateBatch1Artwork(background, null)).toMatchObject({ status: 'missing' });
    expect(evaluateBatch1Artwork(background, {
      width: 1024,
      height: 1024,
      byteLength: 1,
      hasTransparency: true,
      hasVisiblePixels: true,
    })).toMatchObject({ status: 'invalid' });
    expect(evaluateBatch1Artwork(base, {
      width: 1024,
      height: 1024,
      byteLength: 1,
      hasTransparency: false,
      hasVisiblePixels: true,
    })).toMatchObject({ status: 'invalid' });
  });

  it('treats the Vite HTML fallback for an absent WebP as missing', () => {
    expect(classifyBatch1ArtworkResponse(true, 'text/html; charset=utf-8')).toBe('missing');
    expect(classifyBatch1ArtworkResponse(false, null)).toBe('missing');
    expect(classifyBatch1ArtworkResponse(true, 'image/webp')).toBe('ready');
  });
});
