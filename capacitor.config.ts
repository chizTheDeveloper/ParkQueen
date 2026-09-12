import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Phase 1 Capacitor shell config.
 * Provisional appId `app.parqueen` (derived from parqueen.app) — confirm before treating as permanent.
 * Loads the Vite `dist/` bundle only. Do not set `server.url` (no live-reload / no remote Hosting shell).
 */
const config: CapacitorConfig = {
  appId: 'app.parqueen',
  appName: 'ParQueen',
  webDir: 'dist',
};

export default config;
