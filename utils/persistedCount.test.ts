import { describe, expect, it } from 'vitest';
import { parsePersistedCount } from './persistedCount';

describe('parsePersistedCount', () => {
  it.each([
    [null, 0],
    ['', 0],
    ['0', 0],
    ['3', 3],
    ['3junk', 0],
    ['garbage', 0],
    ['-1', 0],
    ['1.5', 0],
    [String(Number.MAX_SAFE_INTEGER + 1), 0],
  ])('parses %s as %s', (value, expected) => {
    expect(parsePersistedCount(value)).toBe(expected);
  });
});
