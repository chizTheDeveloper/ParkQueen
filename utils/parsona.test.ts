import { describe, it, expect } from 'vitest';
import { isValidAvatarConfig, resolveAvatar, isCleanStringOrNull } from '../parsona/validation';
import { getDefaultAvatar } from '../parsona/presets';
import type { AvatarConfig } from '../parsona/types';

const VALID: AvatarConfig = {
  version: 1,
  skin: 'skin_01',
  face: 'face_round',
  hair: 'hair_short',
  hairColor: 'hair_black',
  facialHair: null,
  glasses: null,
  headwear: null,
  outfit: 'outfit_tee',
  background: 'bg_navy',
};

describe('isValidAvatarConfig', () => {
  it('accepts a valid config', () => {
    expect(isValidAvatarConfig(VALID)).toBe(true);
  });

  it('accepts null optional fields', () => {
    expect(isValidAvatarConfig({ ...VALID, facialHair: null, glasses: null, headwear: null })).toBe(true);
  });

  it('accepts non-null optional fields', () => {
    expect(isValidAvatarConfig({ ...VALID, facialHair: 'fh_stubble', glasses: 'gl_round', headwear: 'hw_cap' })).toBe(true);
  });

  it('rejects wrong version', () => {
    expect(isValidAvatarConfig({ ...VALID, version: 2 as any })).toBe(false);
  });

  it('rejects unknown skin id', () => {
    expect(isValidAvatarConfig({ ...VALID, skin: 'skin_99' as any })).toBe(false);
  });

  it('rejects extra keys', () => {
    expect(isValidAvatarConfig({ ...VALID, extra: 'bad' } as any)).toBe(false);
  });

  it('rejects missing keys', () => {
    const { outfit: _omit, ...partial } = VALID;
    expect(isValidAvatarConfig(partial)).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidAvatarConfig(null)).toBe(false);
  });

  it('rejects string', () => {
    expect(isValidAvatarConfig('https://example.com/img.jpg')).toBe(false);
  });
});

describe('resolveAvatar', () => {
  it('returns valid config as-is', () => {
    expect(resolveAvatar(VALID, VALID)).toEqual(VALID);
  });

  it('falls back on invalid config', () => {
    const fallback = { ...VALID, skin: 'skin_02' as const };
    expect(resolveAvatar({ bad: true }, fallback)).toEqual(fallback);
  });

  it('falls back on null', () => {
    expect(resolveAvatar(null, VALID)).toEqual(VALID);
  });
});

describe('isCleanStringOrNull', () => {
  it('accepts null', () => {
    expect(isCleanStringOrNull(null)).toBe(true);
  });

  it('accepts a short id string', () => {
    expect(isCleanStringOrNull('fh_stubble')).toBe(true);
  });

  it('rejects a URL', () => {
    expect(isCleanStringOrNull('https://evil.com/img.jpg')).toBe(false);
  });

  it('rejects strings over 64 chars', () => {
    expect(isCleanStringOrNull('a'.repeat(65))).toBe(false);
  });

  it('rejects path strings', () => {
    expect(isCleanStringOrNull('/etc/passwd')).toBe(false);
  });
});

describe('getDefaultAvatar', () => {
  it('returns a valid config for any userId', () => {
    expect(isValidAvatarConfig(getDefaultAvatar('user_abc123'))).toBe(true);
    expect(isValidAvatarConfig(getDefaultAvatar(''))).toBe(true);
    expect(isValidAvatarConfig(getDefaultAvatar('zzzzzzzzzzzzz'))).toBe(true);
  });

  it('is deterministic', () => {
    const a = getDefaultAvatar('user_abc');
    const b = getDefaultAvatar('user_abc');
    expect(a).toEqual(b);
  });

  it('varies across different user ids', () => {
    const results = new Set(
      ['u1','u2','u3','u4','u5','u6','u7','u8'].map(id => getDefaultAvatar(id).background)
    );
    // At least 2 different backgrounds across 8 varied ids
    expect(results.size).toBeGreaterThanOrEqual(2);
  });
});
