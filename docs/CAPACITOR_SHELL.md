# Capacitor native shell (Phase 1)

Phase 1 adds a Capacitor iOS/Android shell around the existing Vite/React web app. The web/Firebase Hosting path is unchanged.

## Provisional application ID

- **Proposed:** `app.parqueen` (reverse-DNS from `parqueen.app`)
- Firebase Console currently has **only** the web app registered; no iOS/Android app IDs were reserved at Phase 1 creation.
- Confirm with Juan before treating this ID as permanent (Apple/Google/Firebase registration).

## Prerequisites

- Node 20+ / npm
- `npm ci` then `npm run build` (writes `dist/`)
- **Android:** Android Studio + SDK (not required for `cap sync` generation)
- **iOS:** macOS + Xcode (not available on Windows CI agents)

## Commands

```bash
npm ci
npm run build          # web/Hosting build — unchanged
npm run cap:sync       # build + copy web assets into ios/ and android/
npm run cap:copy       # build + copy only
npm run cap:open:android
npm run cap:open:ios   # macOS only
```

## Invariants

- `webDir` is `dist` — shell loads the same Vite output Hosting uses.
- Do **not** set `server.url` in `capacitor.config.ts`.
- Do **not** set `VITE_QA_AUTH=true` for store/native release builds.
- Phase 1 does **not** add phone auth, push, camera, geolocation, or App Check bridges.
- Do not commit `GoogleService-Info.plist`, `google-services.json`, keystores, or provisioning profiles.

## Out of scope (Phase 2+)

Native phone auth, push/FCM/APNs, camera, geolocation adapters, App Check attestation bridge, Mapbox native SDK, store signing.
