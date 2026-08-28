/// <reference types="vitest" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { resolveAppRelease, hasSentryUploadConfig } from './sentryRelease';

export default defineConfig(({ mode }) => {
    // Third argument '' loads every env var regardless of VITE_ prefix — Vite
    // only auto-exposes VITE_-prefixed vars to client code (import.meta.env)
    // on its own; this is purely so this Node-side config can read the
    // build-only Sentry credentials (SENTRY_AUTH_TOKEN/ORG/PROJECT), which
    // must never reach the client bundle or `define`.
    const env = loadEnv(mode, process.cwd(), '');
    const release = resolveAppRelease(env);
    const uploadConfigPresent = hasSentryUploadConfig(env);

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // Only active when real upload credentials are present — an ordinary
        // local/CI build without them must still succeed, just without
        // source-map generation/upload (see build.sourcemap below).
        ...(uploadConfigPresent ? [sentryVitePlugin({
          org: env.SENTRY_ORG,
          project: env.SENTRY_PROJECT,
          authToken: env.SENTRY_AUTH_TOKEN,
          release: { name: release },
          telemetry: false,
          sourcemaps: {
            // Maps are only ever generated (build.sourcemap: 'hidden') when
            // this plugin is active, so this glob only ever matches maps
            // produced for this exact upload — never leaves them in dist/.
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
        })] : []),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      define: {
        __APP_RELEASE__: JSON.stringify(release),
      },
      build: {
        // 'hidden' generates maps (for the plugin to upload) without adding a
        // //# sourceMappingURL= comment to the shipped JS, so browsers never
        // discover them — and they're deleted from dist/ after upload above.
        // Without upload credentials, no maps are generated at all.
        sourcemap: uploadConfigPresent ? 'hidden' : false,
      },
      test: {
        environment: 'node',
        globals: true,
        exclude: ['**/node_modules/**', 'firestore.rules.test.ts', 'storage.rules.test.ts', 'functions/*.integration.test.*'],
      },
    };
});
