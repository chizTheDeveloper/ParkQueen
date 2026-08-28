import { describe, it, expect, vi } from 'vitest';
import { resolveAppRelease, hasSentryUploadConfig } from './sentryRelease';

describe('resolveAppRelease', () => {
  it('prefers an explicit SENTRY_RELEASE override above everything else', () => {
    const gitHeadSha = vi.fn(() => 'git-sha-should-not-be-used');
    expect(resolveAppRelease({ SENTRY_RELEASE: 'explicit-release', GITHUB_SHA: 'ci-sha' }, gitHeadSha))
      .toBe('explicit-release');
    expect(gitHeadSha).not.toHaveBeenCalled();
  });

  it('uses a CI-provided GITHUB_SHA when no explicit override is set', () => {
    const gitHeadSha = vi.fn(() => 'git-sha-should-not-be-used');
    expect(resolveAppRelease({ GITHUB_SHA: 'ci-sha-123' }, gitHeadSha)).toBe('ci-sha-123');
    expect(gitHeadSha).not.toHaveBeenCalled();
  });

  it('falls back to the local git HEAD SHA when neither env var is set', () => {
    const gitHeadSha = vi.fn(() => 'abc123def456');
    expect(resolveAppRelease({}, gitHeadSha)).toBe('abc123def456');
    expect(gitHeadSha).toHaveBeenCalledTimes(1);
  });

  it('falls back to "dev" if the git lookup itself fails (e.g. no git CLI / not a repo)', () => {
    const gitHeadSha = vi.fn(() => { throw new Error('not a git repository'); });
    expect(resolveAppRelease({}, gitHeadSha)).toBe('dev');
  });

  it('with real defaults, resolves to the actual current git HEAD SHA in this repo', () => {
    // No mocks — proves the real default `gitHeadSha` implementation works
    // against this actual checkout, not just the injected-stub paths above.
    const release = resolveAppRelease({});
    expect(release).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe('hasSentryUploadConfig', () => {
  it('is true only when all three of SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT are present', () => {
    expect(hasSentryUploadConfig({ SENTRY_AUTH_TOKEN: 't', SENTRY_ORG: 'o', SENTRY_PROJECT: 'p' })).toBe(true);
  });

  it('is false when any one of the three is missing', () => {
    expect(hasSentryUploadConfig({ SENTRY_ORG: 'o', SENTRY_PROJECT: 'p' })).toBe(false);
    expect(hasSentryUploadConfig({ SENTRY_AUTH_TOKEN: 't', SENTRY_PROJECT: 'p' })).toBe(false);
    expect(hasSentryUploadConfig({ SENTRY_AUTH_TOKEN: 't', SENTRY_ORG: 'o' })).toBe(false);
  });

  it('is false when none are present (the ordinary local/CI build)', () => {
    expect(hasSentryUploadConfig({})).toBe(false);
  });

  it('is false for empty-string values, not just missing ones', () => {
    expect(hasSentryUploadConfig({ SENTRY_AUTH_TOKEN: '', SENTRY_ORG: 'o', SENTRY_PROJECT: 'p' })).toBe(false);
  });
});
