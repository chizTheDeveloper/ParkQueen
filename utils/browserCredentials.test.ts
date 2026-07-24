import { describe, expect, it } from 'vitest';
import { requiredBrowserCredential } from './browserCredentials';

describe('requiredBrowserCredential', () => {
  it('returns a configured value', () => {
    expect(requiredBrowserCredential('VITE_EXAMPLE', 'configured')).toBe('configured');
  });

  it.each([undefined, '', '   '])('rejects a missing value without including a credential', value => {
    expect(() => requiredBrowserCredential('VITE_EXAMPLE', value)).toThrow(
      'VITE_EXAMPLE is required',
    );
  });
});
