# ParQueen Dependency and SDK Inventory

Assessment date: 2026-07-24  
Node: 24.18.0 | npm: 11.16.0 | Firebase CLI: installed  
Vulnerability baseline: after `npm audit fix` (no `--force`, no `--legacy-peer-deps`)

---

## Dependency audit baseline

| Severity | Count | Root cause |
|---|---|---|
| Critical | 1 | `tar` in `expo` toolchain (see below) |
| High | 42 | `expo` (38), `react-native` (4 remaining), `vite@5` (1), `undici` (1) |
| Moderate | 23 | Transitive dev tooling (expo/react-native/Firebase internal) |
| Low | 1 | Transitive |
| **Total** | **67** | All in dev/dormant dependency chains |

---

## Runtime production dependencies

These packages are bundled by Vite and served to users.

| Package | Version pinned | Purpose | Vulnerability status |
|---|---|---|---|
| `react` | `18.2.0` | UI framework | No audit finding |
| `react-dom` | `18.2.0` | DOM renderer | No audit finding |
| `firebase` | `^10.8.0` → installed `10.14.1` | Auth, Firestore, Storage, FCM, Hosting | No direct finding; internal transitive via `@firebase/util` install script (non-exec in production) |
| `mapbox-gl` | `^3.18.1` | Maps and geocoding | No audit finding |
| `geofire-common` | `^6.0.0` | Geohash utilities | No audit finding |
| `libphonenumber-js` | `^1.13.9` | Phone number parsing/formatting | No audit finding |
| `lucide-react` | `^0.344.0` | Icon set | No audit finding |
| `recharts` | `^2.12.2` | Analytics charts | No audit finding |

**Dormant runtime deps (declared but not exercised by the shipped Vite app):**

| Package | Version | Declared purpose | Risk |
|---|---|---|---|
| `expo` | `~50.0.14` | Expo toolchain (app was scaffolded with Expo) | **Critical/High** — see below. Not loaded by Vite. |
| `expo-camera` | `~14.1.1` | Native camera (unused in web) | Dormant |
| `expo-location` | `~16.5.5` | Native location (web uses browser API) | Dormant |
| `expo-status-bar` | `~1.11.1` | Expo status bar | Dormant |
| `react-native` | `0.73.6` | Native runtime (web uses react-native-web) | High — see below |
| `react-native-web` | `~0.19.10` | RN-to-DOM bridge | Loaded by Vite indirectly |
| `react-native-webview` | `13.8.6` | Native WebView (unused in web) | Dormant |
| `firebase-admin` | `^13.6.1` | Server-side SDK (belongs in functions/, not root) | No audit finding |
| `leaflet` | `^1.9.4` | Map library (replaced by Mapbox; confirmed dormant) | No audit finding |

---

## Dev dependencies

| Package | Version | Purpose | Vulnerability status |
|---|---|---|---|
| `@firebase/rules-unit-testing` | `^3.0.4` (downgraded from `^5.0.1`) | Firestore emulator test harness | Compatible with `firebase@10.x`; no finding |
| `@babel/core` | `^7.20.0` | Babel transpilation | No finding |
| `@types/mapbox-gl` | `^3.4.1` | TypeScript types | No finding |
| `@types/react` | `~18.2.45` | TypeScript types | No finding |
| `@vitejs/plugin-react` | `^4.2.1` | Vite React plugin | No finding |
| `tailwindcss` | `^3.3.0` | CSS framework | No finding |
| `typescript` | `^5.1.3` | Type checker | No finding |
| `vite` | `^5.1.4` | Build tool/dev server | **HIGH** — see below |
| `vitest` | `^4.1.9` | Test runner | No finding |

---

## Critical and High vulnerability analysis

### CRITICAL: `tar` (node-tar)

- **Via:** Expo toolchain → `@expo/cli` → `cacache` → `tar`
- **CVEs:** Hardlink/symlink path traversal, race conditions, DoS via PAX records, infinite loop, uncaught exception
- **Exploitability in production:** None. `tar` is a build/install-time tool within Expo's dev CLI. It is not loaded by the Vite production bundle, is not served to users, and is not called at application runtime.
- **Fix available:** `expo@57.0.8` — breaking major version upgrade
- **Decision:** Accept. Upgrade `expo` to v57 as part of native packaging work (required before any iOS/Android submission anyway). Track as TM-15 (upgraded from Phase B resolution of `@firebase/rules-unit-testing` conflict).

### HIGH: Expo dependency subtree (38 packages)

All 38 packages (`@expo/cli`, `@expo/config`, `@expo/config-plugins`, `expo-asset`, `expo-constants`, `expo-modules-autolinking`, `brace-expansion`, `cacache`, `chromium-edge-launcher`, `del`, `glob`, `minimatch`, `postcss`, `rimraf`, `semver`, `sucrase`, `tempy`, `@xmldom/xmldom`, `@react-native/dev-middleware`, `babel-preset-expo`, etc.) share the same root: `expo@~50.0.14`.

- **Exploitability in production:** None. The Vite web app does not execute Expo CLI or Expo SDK modules.
- **Fix:** `expo@57.0.8` (breaking major). Blocked pending native packaging architecture decision (see `docs/STORE_SUBMISSION_READINESS.md`).

### HIGH: React Native dependency subtree (4 packages)

`@react-native-community/cli-platform-android`, `cli-platform-ios`, `@react-native/babel-plugin-codegen`, `@react-native/babel-preset`, `@react-native/codegen`, `jscodeshift`, `node-dir`, `temp`, `react-native` itself.

- **Exploitability in production:** None. `react-native-web` handles the web runtime; the native React Native toolchain is not exercised.
- **Fix:** `react-native@0.86.0` (breaking major). Paired with Expo upgrade path.

### HIGH: `vite` build tool

- **Installed:** `^5.1.4`
- **Fix available:** `vite@8.1.5` (breaking major upgrade from v5)
- **Exploitability in production:** Low. Vite runs only on developer machines and CI. The compiled production output has no dependency on the Vite runtime.
- **Decision:** Accept for now. Plan Vite v8 migration as a separate task before next major release cycle; note the jump spans v6 and v7 and will require plugin compatibility verification.

### HIGH: `undici` (HTTP client)

- **Context:** Pulled in by React Native / Metro toolchain for HTTP operations during dev server
- **Exploitability in production:** None in the web app runtime. Development-time only.
- **Fix:** Non-breaking fix reported available by `npm audit`; blocked by peer constraints in the current graph. Resolves with the Expo/React Native major upgrade.

---

## Phase B fix: `@firebase/rules-unit-testing` peer dependency

### Problem

`@firebase/rules-unit-testing@5.0.1` (committed at `b267d69`) declares a peer dependency on `firebase@^12.0.0`. The application depends on `firebase@10.14.1`. npm 11 correctly rejects this incompatible graph with `ERESOLVE`, preventing `npm ci` from succeeding on a fresh CI runner or reviewer clone.

### Resolution

Downgraded to `@firebase/rules-unit-testing@3.0.4`, which:
- Declares peer dependency `firebase@'^10.0.0'` — compatible with installed `firebase@10.14.1`
- Passes all 70 existing Firestore Rules unit tests without modification
- Allows `npm ci` to succeed without `--force`, `--legacy-peer-deps`, or any override flags

Version 3.0.4 is the latest `3.x` release and tracks the Firebase 10 release line.

### Verification

After fresh `npm install` with downgraded constraint:

| Gate | Result |
|---|---|
| `npm ci` | PASS — clean install, no ERESOLVE |
| `npx tsc --noEmit` | PASS |
| `npm test` | PASS — 19 files, 674 tests |
| `npm run build` | PASS — production bundle |
| `npm run test:rules` | PASS — 70 tests |
| `npm audit` (no flags) | 67 vulnerabilities; 1 critical, all in dormant Expo/RN toolchain (see above) |

---

## Install scripts

Three packages with post-install scripts flagged by npm:

| Package | Script | Risk assessment |
|---|---|---|
| `esbuild@0.21.5` | Install binary download | Standard esbuild binary install; no elevation |
| `@firebase/util@1.15.0` | Firebase postinstall setup | Firebase SDK internal; no elevation |
| `protobufjs@7.6.5` | `node scripts/postinstall` | Protobuf JS codegen; no elevation |

None are user-facing or executed at application runtime.

---

## Third-party SDK runtime behavior

| SDK | Where initialized | Auth mechanism | Network scope |
|---|---|---|---|
| Firebase JS SDK (`firebase@10.14.1`) | `config/firebase.ts` | API key + Firebase App (no App Check at present) | `firestore.googleapis.com`, `firebase.googleapis.com`, FCM |
| Mapbox GL JS (`mapbox-gl@3.18.1`) | `config/mapbox.ts` | Public access token | `api.mapbox.com`, tile CDN |
| Firebase Admin (`firebase-admin@13.6.1`) | `functions/index.js` | ADC / service account in Cloud Functions | Server-side only |

---

## Recommendations

1. **Expo + React Native major upgrade** — required before any native packaging and resolves the entire critical/high vulnerability tree. Coordinate with store submission architecture decision.
2. **Vite v8 migration** — plan as a standalone task; spans two major versions (v6 → v7 → v8), verify plugin compatibility.
3. **Remove `firebase-admin` from root `package.json`** — it belongs only in `functions/package.json`. Currently appears in root dependencies and is included in the Vite dependency graph scan unnecessarily.
4. **Remove dormant `leaflet`** — replaced by Mapbox, confirmed unused. Reduces audit surface.
5. **Remove `react-native-webview`** — no usage in web app; dormant native dependency.
6. **Consider removing Expo entirely from root** — the shipped product is a Vite web app. Expo tooling in root dependencies inflates the vulnerability surface and complicates `npm audit` signal. If native packaging is pursued, use a separate workspace or project structure.
