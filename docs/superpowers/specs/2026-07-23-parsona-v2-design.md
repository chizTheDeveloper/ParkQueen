# Dormant Premium Parsona v2 Design

## Purpose

Prepare a minimal premium Parsona v2 system without changing any current public flow. The attached Minimal Premium Avatar System guide and Example Combinations showcase are visual references for maturity, proportions, skin rendering, hair, accessories, clothing, lighting, and finish only. Their text, names, branding layout, and embedded portraits are not repository assets.

## Public-release boundary

`PARSONA_V2_PUBLIC_ENABLED` is the single public enablement constant and defaults to `false`. While false:

- Profile, onboarding, presets, migration, and the normal creator continue to read and write v1 only.
- No normal user flow writes v2.
- v2 is reachable only at `?qa=parsona-v2-lab` in `import.meta.env.DEV`.
- Pending assets never appear in normal user flows.

The v2 lab has no authentication or Firestore dependency.

## Data model

`AvatarConfig` becomes a discriminated union of the unchanged v1 shape and:

```ts
interface AvatarConfigV2 {
  version: 2;
  baseStyle: 'feminine' | 'masculine';
  skin: 'tone_01' | 'tone_02' | 'tone_03' | 'tone_04' | 'tone_05';
  hair: 'short_fade' | 'short_curls' | 'medium_textured' | 'long_hair' | 'braids_locs';
  accessory: null | 'round_glasses' | 'square_glasses' | 'cap_beanie' | 'head_covering';
  top: 'crew_neck' | 'hoodie' | 'structured_jacket' | 'turtleneck' | 'smart_casual';
  background: 'parqueen_navy';
}
```

These fields describe artwork selections only. The app does not store or infer gender identity, race, ethnicity, age, or demographic conclusions.

The Cartesian product is `2 × 5 × 5 × 5 × 5 × 1 = 1,250`.

## Module boundaries

`parsona/v2/` owns:

- `types.ts`: stable IDs, config, labels, statuses, and asset definitions.
- `constants.ts`: exact option arrays, default configuration, public flag, and combination count.
- `manifest.ts`: local asset contract and status-bearing entries for every style-specific variant.
- `validation.ts`: exact-key config validation, manifest validation, local-path checks, and deterministic v1 fallback resolution.
- `selectors.ts`: approved-only production option selection and layer resolution.
- `combinations.ts`: enumeration and exhaustive validity checks.
- Tests colocated as `*.test.ts`.

`AvatarComposite` accepts the v1/v2 union. Its existing v1 rendering implementation is extracted without behavioral changes into `AvatarCompositeV1`. Valid, fully approved v2 configurations render through `AvatarCompositeV2`. Invalid, missing, or incomplete v2 configurations outside the lab resolve to the deterministic v1 preset for `userId`.

## Asset contract

Production sources are professionally produced 1024×1024 transparent PNG masters, exported as optimized transparent WebP files on an identical canvas. Eye line, head position, neck position, and shoulder bounds must match.

```text
public/parsona-v2/
  README.md
  backgrounds/parqueen_navy.webp
  bases/{feminine|masculine}/tone_01.webp ... tone_05.webp
  hair/{feminine|masculine}/{hair-id}.back.webp
  hair/{feminine|masculine}/{hair-id}.front.webp
  accessories/{feminine|masculine}/{accessory-id}.webp
  tops/{feminine|masculine}/{top-id}.webp
```

Only required layer paths are populated. The manifest accepts `.webp` production files and `.png` masters, rejects URLs, traversal, query strings, fragments, duplicate paths, unknown extensions, missing bilingual labels, and approved options without both base-style variants.

Layer order:

1. background
2. back hair
3. top and shoulders
4. base face and neck
5. front hair
6. accessory
7. foreground detail

All initial portrait layers are `pending`; no fabricated premium portraits or reference-board images are added.

## Rendering and fallback

The lab passes an explicit `reviewMode` prop to `AvatarCompositeV2`, allowing a neutral navy-and-slate silhouette labeled “Artwork pending.” Production code never enables review mode.

Production rendering requires every selected asset to be `approved` and locally resolvable. Otherwise `AvatarComposite` renders `getDefaultAvatar(userId)` through the existing v1 renderer. This fallback is deterministic, valid, and never writes data.

## DEV lab

`?qa=parsona-v2-lab` is guarded at both lazy import and route selection by `import.meta.env.DEV`. It shows:

- feminine and masculine variants side by side;
- every tone, hair, accessory, and top with status;
- 180, 96, 48, and 40 px previews plus a 120 px approval size;
- at least 25 representative combinations;
- the 1,250-combination programmatic validation result;
- ParQueen navy and circular-crop previews;
- neutral pending silhouettes only.

## Creator preparation

A dormant `ParsonaV2CreatorView` implements the five categories Style, Tone, Hair, Extras, and Top with the exact English/Spanish base-style copy, live preview, approved-only randomization, reset, saved/save states, unsaved-change confirmation, anchored save control, reduced-motion styling, keyboard semantics, and 44 px targets.

Because the public flag is false and no assets are approved, it is not routed from Profile, onboarding, migration, or presets and performs no Firestore write. The DEV lab may render it in review mode without authentication.

## Firestore Rules

`isValidAvatarField` accepts null, exact v1, or exact v2. V2 requires seven exact keys, version 2, enum membership, correct nullable accessory handling, no extra fields, and owner-only writes through the existing user rules. IDs prevent URLs or paths by construction. No Rules deployment is authorized.

## Testing

Unit tests cover every enum, both base styles, invalid values, extra keys, labels, manifest safety, approval completeness, deterministic v1 fallback, approved-only selectors, pending exclusion, and all 1,250 combinations. Rules tests cover valid feminine/masculine v2, every enum, invalid fields, null accessory, extra/missing keys, URL/path attempts, owner-only writes, and continued v1 acceptance.

## Public enablement checklist

Do not set `PARSONA_V2_PUBLIC_ENABLED` to `true` until:

- every feminine and masculine variant is approved;
- every required file is present;
- 40 px, 48 px, 96 px, 120 px, and 180 px review has passed;
- English and Spanish labels are complete;
- accessibility review has passed;
- all tests are green;
- Firestore Rules have been reviewed;
- explicit product approval has been received.
