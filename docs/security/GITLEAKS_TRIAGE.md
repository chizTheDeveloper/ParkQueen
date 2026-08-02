# ParQueen Gitleaks triage

- Reviewer: Codex
- Review date: 2026-08-02
- Gitleaks: 8.28.0
- Production source reviewed: `origin/main` at `f92edddbfc42f4a5f6cacf5be7a736e6eb75fc52`
- Scopes: clean current main tree; commits reachable from `origin/main`; all refs inventory
- Handling: credential identities are masked and represented by redacted SHA-256 fragments only

## Scan results before remediation

| Scope | Findings |
|---|---:|
| Current main tree, excluding generated/vendor artifacts | 6 |
| `origin/main` history only | 12 |
| All refs inventory | 13 |

## Finding classification

| Fingerprint | Masked identity / SHA-256 | Classification | Provider status and rationale |
|---|---|---|---|
| `356c61f346d5c439f5a776b85167c7a0362cfc92:.env:generic-api-key:1` | `pk.…U17w` / `c96c…9495` | C | Valid Mapbox public token; historical; not used by current development or production configuration. |
| `4d8faf80940f435817a2a5fa66fbea3f51b60506:.env:generic-api-key:1` | `pk.…U17w` / `c96c…9495` | C | Same reviewed public Mapbox identity. |
| `0dd395f7c8c533ce40902cf8606112045e21dfbf:.env:gcp-api-key:2` | `AIza…AI7Y` / `4f98…6a82` | C | Canonical active Firebase WEB browser key; referrer- and API-restricted. Historical variable name was misleading. |
| `d1f5b2880f050f6029090ba25b02f3e9d29eab48:.env:gcp-api-key:2` | `AIza…AI7Y` / `4f98…6a82` | C | Same canonical Firebase browser identifier. |
| `0dd395f7c8c533ce40902cf8606112045e21dfbf:.env:gcp-api-key:3` | `AIza…m7Gc` / `b02d…2282` | B | Historical browser Gemini key; provider resource is soft-deleted and restricted to the Generative Language API. |
| `2af61c4b5b355e9d36cd13e45c5d2cf793efde7f:firebase.ts:gcp-api-key:6` | `AIza…AI7Y` / `4f98…6a82` | C | Canonical Firebase WEB browser key. |
| `e525891d4d4f46e5cbf62a92ec593c0bd355f0fd:firebase.ts:gcp-api-key:6` | `AIza…JbBs` / `db7e…d56` | C | Active legacy-project Firebase browser key with Firebase API and ParQueen/localhost referrer restrictions; absent from current source. |
| `fe07395be673aae247a07e734952b83b69b1304d:firebaseConfig.ts:gcp-api-key:6` | `AIza…AI7Y` / `4f98…6a82` | C | Canonical Firebase WEB browser key. |
| `731ad368af4d1e3d4c4ecdf681868390196dba7c:hooks/useLocalParkingData.ts:gcp-api-key:19` | `AIza…AI7Y` / `4f98…6a82` | C | Canonical public browser key historically used by removed Google Maps code; current restrictions do not permit Maps APIs. |
| `c2daee55b6fbe91e422ee1ce859f32333da175af:parsona/v2/premiumMvp.ts:generic-api-key:3` | `parque…eset` / `5f62…e72a` | D/E | Noncredential localStorage key; committed only on the Parsona branch and not reachable from main. |
| `829defa36aad4bad67ea5f721aecd79bc79f6ce6:public/firebase-messaging-sw.js:gcp-api-key:5` | `AIza…AI7Y` / `4f98…6a82` | C | Canonical Firebase WEB browser key intentionally shipped to the service worker. |
| `74930f519e53775a92b465fa694add49cf90c9f6:views/street-parking/AppTour.tsx:generic-api-key:4` | `parque…n_v1` / `657a…c3a1` | D | Noncredential localStorage key. |
| `70beee39884289cda0e81bb6ae4acd178208618b:views/StreetParkingView.tsx:generic-api-key:10` | `pk.…U17w` / `c96c…9495` | C | Historical valid Mapbox public token; absent from current source and current environment tokens. |

Class B is a historical private credential with proven provider deletion. Class C is an intentionally public browser identifier. Class D is a noncredential false positive. Class E is reachable only from the out-of-scope Parsona branch. No Class A active private secret or Class F unresolved finding remained after review.

## Provider evidence

- Current Firebase WEB app ID: `1:768131391875:web:613c5d2a948862333196b6`; its SDK configuration matched the reviewed canonical browser-key identity.
- Current production Firebase key resource: `137d…6309`; Firebase API targets and explicit production/localhost HTTP referrers.
- Legacy Firebase browser key resource: `4ef8…fcbf` in project `gen-lang-client-0911917934`; active with Firebase API targets and explicit ParQueen/localhost referrers.
- Historical Gemini key resource: `a929…15e2`; soft-deleted 2026-07-19.
- Current server Gemini key is a distinct identity restricted to `generativelanguage.googleapis.com`.
- Current Mapbox production token ID: `cmry…wuhq`; valid `pk.` public token.
- Current Mapbox development token ID: `cmry…gaay`; valid `pk.` public token.
- Historical Mapbox token ID: `cmkl…zzqa`; valid `pk.` public token and not currently configured.
- No Mapbox `sk.`, SendGrid token, or private-key marker was found in all-ref history.

## Gate design

`.gitleaks.toml` extends the complete built-in default ruleset. It excludes generated, vendor, and emulator artifacts, then permits reviewed current public-client structures only when an exact path and safe structural pattern both match with `condition = "AND"`. `.gitleaksignore` contains only the 13 immutable reviewed fingerprints above.

Every future finding must be reviewed and classified on its own evidence. It must not be added to the configuration or ignore file automatically merely because it resembles a previously reviewed finding.

The reviewed remediation was verified against the current main tree, `origin/main` history, and all refs with zero residual findings in each scope.
