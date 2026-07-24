import { describe, expect, it } from 'vitest';
import {
  ACCESSORY_IDS,
  BACKGROUND_IDS,
  BASE_STYLE_IDS,
  DEFAULT_AVATAR_V2,
  HAIR_IDS,
  PARSONA_V2_COMBINATION_COUNT,
  PARSONA_V2_PUBLIC_ENABLED,
  SKIN_IDS,
  TOP_IDS,
} from './constants';
import { enumerateV2Combinations, validateAllV2Combinations } from './combinations';
import { PARSONA_V2_MANIFEST } from './manifest';
import { getApprovedOptions, resolveApprovedV2Layers } from './selectors';
import {
  isValidAvatarConfigV2,
  resolveAvatarForDisplay,
  validateV2Manifest,
} from './validation';
import { getDefaultAvatar } from '../presets';

describe('Parsona v2 domain', () => {
  it('defines the exact approved option IDs and dormant public flag', () => {
    expect(PARSONA_V2_PUBLIC_ENABLED).toBe(false);
    expect(BASE_STYLE_IDS).toEqual(['feminine', 'masculine']);
    expect(SKIN_IDS).toEqual(['tone_01', 'tone_02', 'tone_03', 'tone_04', 'tone_05']);
    expect(HAIR_IDS).toEqual([
      'short_fade', 'short_curls', 'medium_textured', 'long_hair', 'braids_locs',
    ]);
    expect(ACCESSORY_IDS).toEqual([
      null, 'round_glasses', 'square_glasses', 'cap_beanie', 'head_covering',
    ]);
    expect(TOP_IDS).toEqual([
      'crew_neck', 'hoodie', 'structured_jacket', 'turtleneck', 'smart_casual',
    ]);
    expect(BACKGROUND_IDS).toEqual(['parqueen_navy']);
    expect(PARSONA_V2_COMBINATION_COUNT).toBe(1250);
  });

  it.each(BASE_STYLE_IDS)('accepts a complete %s configuration', baseStyle => {
    expect(isValidAvatarConfigV2({ ...DEFAULT_AVATAR_V2, baseStyle })).toBe(true);
  });

  it.each(SKIN_IDS)('accepts skin %s', skin => {
    expect(isValidAvatarConfigV2({ ...DEFAULT_AVATAR_V2, skin })).toBe(true);
  });

  it.each(HAIR_IDS)('accepts hair %s', hair => {
    expect(isValidAvatarConfigV2({ ...DEFAULT_AVATAR_V2, hair })).toBe(true);
  });

  it.each(ACCESSORY_IDS)('accepts accessory %s', accessory => {
    expect(isValidAvatarConfigV2({ ...DEFAULT_AVATAR_V2, accessory })).toBe(true);
  });

  it.each(TOP_IDS)('accepts top %s', top => {
    expect(isValidAvatarConfigV2({ ...DEFAULT_AVATAR_V2, top })).toBe(true);
  });

  it.each([
    ['baseStyle', 'unknown'],
    ['skin', 'tone_06'],
    ['hair', 'mohawk'],
    ['accessory', 'https://evil.example/a.webp'],
    ['top', '../secret'],
    ['background', 'other'],
  ] as const)('rejects invalid %s', (key, value) => {
    expect(isValidAvatarConfigV2({ ...DEFAULT_AVATAR_V2, [key]: value })).toBe(false);
  });

  it('rejects missing and extra keys', () => {
    const { top: _top, ...missing } = DEFAULT_AVATAR_V2;
    expect(isValidAvatarConfigV2(missing)).toBe(false);
    expect(isValidAvatarConfigV2({ ...DEFAULT_AVATAR_V2, demographic: 'x' })).toBe(false);
  });

  it('enumerates and validates all 1,250 configurations', () => {
    const combinations = enumerateV2Combinations();
    expect(combinations).toHaveLength(1250);
    expect(new Set(combinations.map(value => JSON.stringify(value))).size).toBe(1250);
    expect(combinations.every(isValidAvatarConfigV2)).toBe(true);
    expect(validateAllV2Combinations()).toEqual({ total: 1250, valid: 1250, invalid: 0 });
  });

  it('ships complete bilingual labels and descriptions', () => {
    for (const entry of PARSONA_V2_MANIFEST) {
      expect(entry.label.en.trim()).not.toBe('');
      expect(entry.label.es.trim()).not.toBe('');
      expect(entry.description.en.trim()).not.toBe('');
      expect(entry.description.es.trim()).not.toBe('');
      expect(entry.version).toBe(2);
    }
  });

  it('validates local, unique, production-safe manifest paths', () => {
    expect(validateV2Manifest(PARSONA_V2_MANIFEST)).toEqual([]);
    const first = PARSONA_V2_MANIFEST[0];
    expect(validateV2Manifest([
      first,
      { ...first, id: `${first.id}_url`, paths: { feminine: 'https://evil.example/a.webp', masculine: null } },
    ])).toContainEqual(expect.stringContaining('local'));
    expect(validateV2Manifest([
      { ...first, id: `${first.id}_extension`, paths: { feminine: '/parsona-v2/a.svg', masculine: null } },
    ])).toContainEqual(expect.stringContaining('local'));
    expect(validateV2Manifest([
      { ...first, id: `${first.id}_traversal`, paths: { feminine: '/parsona-v2/../a.webp', masculine: null } },
    ])).toContainEqual(expect.stringContaining('local'));
    const skin = PARSONA_V2_MANIFEST.find(entry => entry.category === 'skin')!;
    expect(validateV2Manifest([
      skin,
      { ...skin, id: `${skin.id}_duplicate` },
    ])).toContainEqual(expect.stringContaining('Duplicate path'));
  });

  it('rejects incomplete or malformed artwork intake metadata', () => {
    const missing = validateV2Manifest(
      PARSONA_V2_MANIFEST,
      [],
      { requireAllFiles: true },
    );
    expect(missing.filter(error => error.startsWith('Missing asset:'))).toHaveLength(49);

    const skin = PARSONA_V2_MANIFEST.find(entry => entry.category === 'skin')!;
    const skinPath = skin.paths.feminine!;
    const malformed = validateV2Manifest(
      [skin],
      [
        {
          path: skinPath,
          width: 512,
          height: 1024,
          byteLength: 500_000,
          hasTransparency: false,
          hasVisiblePixels: false,
        },
        {
          path: '/parsona-v2/bases/feminine/unexpected.webp',
          width: 1024,
          height: 1024,
          byteLength: 1,
          hasTransparency: true,
          hasVisiblePixels: true,
        },
      ],
      {
        requireAllFiles: true,
        layerOrder: ['background', 'top', 'backHair', 'base', 'frontHair', 'accessory', 'foreground'],
      },
    );

    expect(malformed).toContain(`Wrong canvas dimensions: ${skinPath}`);
    expect(malformed).toContain(`Transparency required: ${skinPath}`);
    expect(malformed).toContain(`Empty asset: ${skinPath}`);
    expect(malformed).toContain(`Asset exceeds 400 KiB: ${skinPath}`);
    expect(malformed).toContain('Unexpected asset: /parsona-v2/bases/feminine/unexpected.webp');
    expect(malformed).toContain('Incorrect layer order');
  });

  it('requires an opaque background and transparent base layers', () => {
    const background = PARSONA_V2_MANIFEST.find(entry => entry.category === 'background')!;
    const skin = PARSONA_V2_MANIFEST.find(entry => entry.category === 'skin')!;
    const backgroundPath = background.paths.feminine!;
    const skinPath = skin.paths.feminine!;
    const errors = validateV2Manifest(
      [background, skin],
      [
        {
          path: backgroundPath,
          width: 1024,
          height: 1024,
          byteLength: 1,
          hasTransparency: true,
          hasVisiblePixels: true,
        },
        {
          path: skinPath,
          width: 1024,
          height: 1024,
          byteLength: 1,
          hasTransparency: false,
          hasVisiblePixels: true,
        },
      ],
    );

    expect(errors).toContain(`Background must be opaque: ${backgroundPath}`);
    expect(errors).toContain(`Transparency required: ${skinPath}`);
  });

  it('requires both style variants before any option is approved', () => {
    const hair = PARSONA_V2_MANIFEST.find(entry => entry.category === 'hair')!;
    const approved = { ...hair, status: 'approved' as const };
    expect(validateV2Manifest([approved])).toEqual([]);
    expect(validateV2Manifest([{
      ...approved,
      paths: { ...approved.paths, masculineFront: null },
    }])).toContainEqual(expect.stringContaining('base-style variant'));
  });

  it('keeps all unfinished assets out of approved production selectors', () => {
    expect(PARSONA_V2_MANIFEST.every(entry => entry.status === 'pending')).toBe(true);
    expect(getApprovedOptions('skin')).toEqual([]);
    expect(resolveApprovedV2Layers(DEFAULT_AVATAR_V2)).toBeNull();
  });

  it('falls incomplete v2 back to a deterministic valid v1 avatar', () => {
    const first = resolveAvatarForDisplay(DEFAULT_AVATAR_V2, 'user-42');
    const second = resolveAvatarForDisplay(DEFAULT_AVATAR_V2, 'user-42');
    expect(first).toEqual(second);
    expect(first).toEqual(getDefaultAvatar('user-42'));
    expect(first.version).toBe(1);
  });
});
