import { execSync } from 'node:child_process';

// Build-time only (Node, run from vite.config.ts) — never imported by client
// code. The one place both the browser Sentry SDK's `release` field and the
// Sentry Vite plugin's `release.name` read their value from, so the two
// cannot diverge: vite.config.ts calls this once and threads the same string
// into both places.
export function resolveAppRelease(
  env: NodeJS.ProcessEnv = process.env,
  gitHeadSha: () => string = () => execSync('git rev-parse HEAD', { cwd: process.cwd() }).toString().trim(),
): string {
  if (env.SENTRY_RELEASE) return env.SENTRY_RELEASE;
  if (env.GITHUB_SHA) return env.GITHUB_SHA;
  try {
    return gitHeadSha();
  } catch {
    return 'dev';
  }
}

/**
 * Whether the Sentry Vite plugin has everything it needs to create a release
 * and upload source maps. Production source maps must only ever be
 * generated when this is true (see vite.config.ts) — a local/CI build
 * without these credentials must still succeed, just without source-map
 * generation or upload.
 */
export function hasSentryUploadConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT);
}
