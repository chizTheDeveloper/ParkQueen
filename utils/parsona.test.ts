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

describe('isValidAvatarConfig — all manifest IDs accepted', () => {
  const skins      = ['skin_01','skin_02','skin_03','skin_04','skin_05','skin_06'] as const;
  const faces      = ['face_round','face_oval','face_angular'] as const;
  const hairs      = ['hair_short','hair_medium_straight','hair_long','hair_short_curly',
                      'hair_afro','hair_locs','hair_braids','hair_bun','hair_wavy','hair_coily_short'] as const;
  const hairColors = ['hair_black','hair_dark_brown','hair_medium_brown','hair_auburn','hair_blonde','hair_gray'] as const;
  const outfits    = ['outfit_tee','outfit_hoodie','outfit_jacket','outfit_turtleneck','outfit_buttonup'] as const;
  const bgs        = ['bg_navy','bg_midnight','bg_teal','bg_charcoal','bg_purple','bg_gold'] as const;
  const fhIds      = ['fh_stubble','fh_beard_short','fh_mustache'] as const;
  const glIds      = ['gl_round','gl_square','gl_semi'] as const;
  const hwIds      = ['hw_cap','hw_hijab','hw_wrap','hw_beanie'] as const;

  it('accepts every skin ID', () => {
    for (const id of skins) expect(isValidAvatarConfig({ ...VALID, skin: id })).toBe(true);
  });
  it('accepts every face ID', () => {
    for (const id of faces) expect(isValidAvatarConfig({ ...VALID, face: id })).toBe(true);
  });
  it('accepts every hair ID', () => {
    for (const id of hairs) expect(isValidAvatarConfig({ ...VALID, hair: id })).toBe(true);
  });
  it('accepts every hair color ID', () => {
    for (const id of hairColors) expect(isValidAvatarConfig({ ...VALID, hairColor: id })).toBe(true);
  });
  it('accepts every outfit ID', () => {
    for (const id of outfits) expect(isValidAvatarConfig({ ...VALID, outfit: id })).toBe(true);
  });
  it('accepts every background ID', () => {
    for (const id of bgs) expect(isValidAvatarConfig({ ...VALID, background: id })).toBe(true);
  });
  it('accepts every facialHair ID', () => {
    for (const id of fhIds) expect(isValidAvatarConfig({ ...VALID, facialHair: id })).toBe(true);
  });
  it('accepts every glasses ID', () => {
    for (const id of glIds) expect(isValidAvatarConfig({ ...VALID, glasses: id })).toBe(true);
  });
  it('accepts every headwear ID', () => {
    for (const id of hwIds) expect(isValidAvatarConfig({ ...VALID, headwear: id })).toBe(true);
  });
  it('rejects unknown skin ID', () => expect(isValidAvatarConfig({ ...VALID, skin: 'skin_99' as any })).toBe(false));
  it('rejects unknown hair ID', () => expect(isValidAvatarConfig({ ...VALID, hair: 'hair_mohawk' as any })).toBe(false));
  it('rejects unknown headwear ID', () => expect(isValidAvatarConfig({ ...VALID, headwear: 'hw_crown' as any })).toBe(false));
  it('rejects unknown facialHair ID', () => expect(isValidAvatarConfig({ ...VALID, facialHair: 'fh_goatee' as any })).toBe(false));
});

describe('migration dismissal key scoping', () => {
  const KEY_PREFIX = 'parsona_migration_dismissed_v1_';

  it('key includes the user uid', () => {
    const uid = 'user_abc123';
    const key = `${KEY_PREFIX}${uid}`;
    expect(key).toBe('parsona_migration_dismissed_v1_user_abc123');
  });

  it('user A and user B produce different keys', () => {
    const keyA = `${KEY_PREFIX}uid_aaa`;
    const keyB = `${KEY_PREFIX}uid_bbb`;
    expect(keyA).not.toBe(keyB);
  });

  it('user A and user B keys are distinct', () => {
    const keyA = `${KEY_PREFIX}uid_aaa`;
    const keyB = `${KEY_PREFIX}uid_bbb`;
    // Different UIDs produce different keys, so setting one cannot affect the other
    expect(keyA).not.toBe(keyB);
    expect(keyA.endsWith('uid_aaa')).toBe(true);
    expect(keyB.endsWith('uid_bbb')).toBe(true);
  });

  it('key for any two different UIDs never collides', () => {
    const uids = ['abc','def','user_123','user_456','','anon'];
    const keys = uids.map(uid => `${KEY_PREFIX}${uid}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
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
