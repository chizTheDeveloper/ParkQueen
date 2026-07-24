# Parsona v2 artwork production and intake specification

Status: final production contract. Architecture changes require product and engineering approval.

Parsona v2 uses reusable transparent layers, not flattened portraits. The 49 production images below resolve all 1,250 configurations. Source masters remain in the approved art archive; only optimized WebP exports belong in `public/parsona-v2/`.

## Canvas, crop, and anchors

- Canonical source canvas: **1024 × 1024 px**, sRGB, square pixels.
- Source delivery: one lossless transparent PNG master per production image. Layered working files may accompany the PNGs but do not replace them.
- Runtime export: **1024 × 1024 px WebP** at the identical origin; never trim, resize, offset, or auto-crop individual layers.
- Runtime review sizes: **180, 120, 96, 48, and 40 CSS px**. The browser scales the 1024 px export.
- Visible crop: a circle centered at **(512, 512)** with radius **512**. Art outside it is discarded.
- Critical safe zone: circle centered at **(512, 512)** with radius **440**. Eyes, nose, mouth, jaw, glasses, and distinguishing hair detail must remain inside it.
- Optical center: **x = 512**. Keep the shared subtle three-quarter orientation consistent; do not mirror layers independently.
- Canonical base anchors: eye line **y = 390 px**, nose line **y = 510 px**, mouth line **y = 600 px**, and chin **y = 700 px**.
- Canonical bald-base bounds: shared skull top **y = 108 px**, skull sides **x = 300–724**, and outer ear bounds **x = 255–769** with ear anchors **y = 360–548 px**.
- Canonical base neck: centered at **x = 512**, lower width **208 px** (`x = 408–616`), with a shallow termination at **y = 870 px**. Feminine and Masculine variants must match these anchors exactly.
- Hair may reach **y = 48 px** only near the horizontal center. Keep important top detail below **y = 72 px**.
- Shoulder high points: **y = 770 ± 12 px**. At **y = 900 px**, shoulders/torso must span at least **x = 104–920** and continue through the bottom edge.
- No essential feature may touch the outer 24 px of the square canvas.

## Format and rendering

- Background: opaque WebP; no alpha requirement.
- Every other production image: transparent WebP with a real alpha channel and at least one visible nontransparent pixel.
- Transparent pixels must have clean RGB edge colors matching the adjacent artwork to avoid dark or pale halos.
- Use premultiplied-alpha-safe antialiasing. No matte-colored fringe, hard rectangular edge, or clipped blur.
- Keep shadows local to the object casting them. Do not add a second global portrait shadow to individual layers.
- Facial and clothing shadows: restrained two-tone or softly stepped shading. Avoid airbrushed plastic gradients.
- Target file sizes: background ≤ 120 KiB; bases and tops ≤ 250 KiB; hair and accessories ≤ 180 KiB.
- Automated hard ceiling: **400 KiB per production image**. Exceeding it requires optimization or an explicitly reviewed exception.

## Canonical layer order

The renderer owns this order:

1. `background`
2. `backHair`
3. `top`
4. `base`
5. `frontHair`
6. `accessory`
7. `foreground`

The initial contract requires no foreground correction files. If an approved option genuinely needs one, add its typed manifest path and revise the asset count; never smuggle a correction into an unrelated layer.

## Shared and base-style-specific artwork

- Shared image: `backgrounds/parqueen_navy.webp`.
- Shared logical option: accessory `none`; it intentionally has no file.
- Base-style-specific: every skin/base, hair back, hair front, accessory, and top image has separate `feminine` and `masculine` exports.
- Feminine and Masculine describe visual base styles only. Artwork, filenames, manifests, labels, and reviews must not store or infer gender identity, race, ethnicity, age, or demographic conclusions.
- Both base styles use the same canvas, anchors, skin palette, option availability, lighting direction, crop, and quality bar. Differences are limited to the approved facial/neck/shoulder construction and styling.

## Art direction

### Skin tones

The five IDs form one consistent tonal ramp, available identically to both base styles:

| ID | Midtone reference | Rule |
|---|---|---|
| `tone_01` | `#F2C6A0` | Lightest tone; preserve warm-neutral depth without washing highlights to white. |
| `tone_02` | `#D99A6C` | Light-medium tone; keep the same highlight/shadow separation as Tone 1. |
| `tone_03` | `#9B806F` | Medium tone and default; balanced neutral reference without orange, copper, pink, or gray cast. |
| `tone_04` | `#824A35` | Deep tone; retain readable midtones at 40 px without gray shadows. |
| `tone_05` | `#4B2A22` | Deepest tone; preserve facial structure without crushing shadows to black. |

References are color targets, not demographic labels. Canonical `tone_03` uses primary `#9B806F`, shadow `#746055`, and highlight `#B6A091`. Highlights and shadows use the same fixed upper-left key light across every asset.

### Hairstyles

- `short_fade`: clean tapered silhouette; back layer contains the visible rear/occipital edge, not an empty file.
- `short_curls`: sculpted curl groups with controlled negative space; avoid bead-like or foam texture.
- `medium_textured`: medium-volume textured silhouette, distinct from short curls at 40 px.
- `long_hair`: clear long silhouette and shoulder interaction; back/front separation must prevent clothing seams from showing through.
- `braids_locs`: grouped readable strands, restrained detail, and a distinct outer silhouette; avoid noisy one-pixel strands.

Hair must remain recognizable without relying on facial changes. Both required back and front files must contain visible artwork.

### Accessories

- `none`: no image and no manifest entry.
- `round_glasses`: thin mature frames; lenses remain mostly transparent and do not erase eyes.
- `square_glasses`: visibly distinct angular frame at 40 px with the same eye alignment.
- `cap_beanie`: one restrained cap/beanie treatment; must layer cleanly over front hair.
- `head_covering`: neutral, respectful head covering with tailored folds and no religious or demographic label.

Accessories may not change facial anatomy, skin tone, or identity fields.

### Tops

- `crew_neck`: clean crew-neck shirt with a readable collar.
- `hoodie`: structured hood and neckline; no oversized novelty drawstrings.
- `structured_jacket`: tailored jacket with restrained lapel geometry.
- `turtleneck`: clean high collar that does not cover the jaw.
- `smart_casual`: refined collared or open-neck smart-casual top, distinct from the jacket.

All tops include torso and shoulders to the bottom edge and meet the shared neck seam.

### Fixed background and palette

- `parqueen_navy` is an opaque, fixed ParQueen navy field based on `#06162D`, with an optional restrained radial lift no lighter than `#0B2748`.
- Allowed supporting palette: midnight `#030812`, navy `#06162D`, royal blue `#1E75FF`, cyan `#38BDF8`, charcoal `#172033`, slate `#53657D`, and warm ivory `#F5EFE6`.
- Gold accent: `#D8A84E`; cyan and gold together must occupy less than 8% of a portrait and may only support small trim, jewelry, or controlled highlights.
- Do not use rainbow palettes, neon fields, excessive gradients, bloom, lens flare, or glossy material effects.

## Small-size acceptance

Every combination selected for approval must pass circular-crop review at 180, 120, 96, 48, and 40 px on the navy background.

At 40–48 px:

- eyes remain calm and proportionate, not enlarged;
- face, hair silhouette, accessory, and top category remain distinguishable;
- no single-pixel noise, broken alpha edge, halo, or disappearing thin frame is visible;
- the jaw/neck/shoulder join reads as one portrait;
- contrast remains legible in light and dark surrounding UI;
- no layer seam, gap, collision, or crop appears.

## DEV-only functional MVP provisional assets

The functional MVP is an intentionally narrow artwork-backed subset for interaction testing in `?qa=parsona-v2-lab`. It does not change the final manifest IDs, approval process, 49-file contract, or public enablement criteria.

- Fixed: `tone_03` and `parqueen_navy`.
- Base styles: `feminine`, `masculine`.
- Hair: `short_fade`, `long_hair`.
- Tops: `crew_neck`, `hoodie`.
- Accessories: fileless `none`, rendered `round_glasses`.
- Working combinations: **16**.
- Newly produced provisional delivery: **15 WebP runtime layers and 15 matching PNG masters**: one opaque background, eight hair layers, four top layers, and two accessory layers.
- Generator: `scripts/build-parsona-v2-mvp.mjs`.
- Runtime paths remain the exact final manifest paths. Replacing any provisional file with approved professional artwork must not change its ID, path, saved-data shape, or compositor order.
- These files remain provisional and their manifest entries remain `pending`. The DEV-only MVP resolver has a strict allowlist and cannot make them production-approved.
- The MVP creator writes only the schema-validated draft to local browser storage. It does not update a profile or use remote persistence.
- Missing or unavailable final options are never substituted. They remain outside the selectable MVP subset.

## Prohibited traits

- Childish head-to-body proportions or oversized eyes
- Emoji, Bitmoji, generic clip-art, sticker, or mascot styling
- Anime facial construction or fantasy features
- Fantasy, cosplay, ceremonial, or novelty costumes
- Excessive gradients, glow, bloom, or shiny plastic rendering
- Glossy doll-like eyes, exaggerated lashes, or toy-like expressions
- Text, logos, names, board layouts, or copied reference-board portraits
- Demographic labels, stereotypes, conclusions, storage, or inference

## Manifest and naming convention

- Runtime paths are absolute local paths under `/parsona-v2/`; URLs, query strings, fragments, traversal, SVG, and user-controlled paths are forbidden.
- Manifest identity is `category:id`; IDs are exactly the option IDs listed below.
- Background, skin, accessory, and top use `paths.feminine` and `paths.masculine`. The background points both fields to the one shared file.
- Hair uses `paths.{feminine|masculine}Back` and `paths.{feminine|masculine}Front`.
- An option remains `pending` while artwork is absent, becomes `review` only when every required file for both base styles passes intake, and becomes `approved` only after visual, localization, accessibility, Rules, test, and explicit product approval.

## Production asset intake checklist

All images are 1024 × 1024 WebP. “Alpha” means a real transparent channel with visible pixels. Initial completion is `Pending`; initial review is `Not reviewed`.

| Category | Option ID | Base style | Expected filename | Dimensions | Transparency | Completion | Review |
|---|---|---|---|---|---|---|---|
| Background | `parqueen_navy` | Shared | `backgrounds/parqueen_navy.webp` | 1024×1024 | Opaque | Pending | Not reviewed |
| Base | `tone_01` | Feminine | `bases/feminine/tone_01.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Base | `tone_01` | Masculine | `bases/masculine/tone_01.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Base | `tone_02` | Feminine | `bases/feminine/tone_02.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Base | `tone_02` | Masculine | `bases/masculine/tone_02.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Base | `tone_03` | Feminine | `bases/feminine/tone_03.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Base | `tone_03` | Masculine | `bases/masculine/tone_03.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Base | `tone_04` | Feminine | `bases/feminine/tone_04.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Base | `tone_04` | Masculine | `bases/masculine/tone_04.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Base | `tone_05` | Feminine | `bases/feminine/tone_05.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Base | `tone_05` | Masculine | `bases/masculine/tone_05.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair back | `short_fade` | Feminine | `hair/feminine/short_fade.back.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair front | `short_fade` | Feminine | `hair/feminine/short_fade.front.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair back | `short_fade` | Masculine | `hair/masculine/short_fade.back.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair front | `short_fade` | Masculine | `hair/masculine/short_fade.front.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair back | `short_curls` | Feminine | `hair/feminine/short_curls.back.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair front | `short_curls` | Feminine | `hair/feminine/short_curls.front.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair back | `short_curls` | Masculine | `hair/masculine/short_curls.back.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair front | `short_curls` | Masculine | `hair/masculine/short_curls.front.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair back | `medium_textured` | Feminine | `hair/feminine/medium_textured.back.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair front | `medium_textured` | Feminine | `hair/feminine/medium_textured.front.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair back | `medium_textured` | Masculine | `hair/masculine/medium_textured.back.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair front | `medium_textured` | Masculine | `hair/masculine/medium_textured.front.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair back | `long_hair` | Feminine | `hair/feminine/long_hair.back.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair front | `long_hair` | Feminine | `hair/feminine/long_hair.front.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair back | `long_hair` | Masculine | `hair/masculine/long_hair.back.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair front | `long_hair` | Masculine | `hair/masculine/long_hair.front.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair back | `braids_locs` | Feminine | `hair/feminine/braids_locs.back.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair front | `braids_locs` | Feminine | `hair/feminine/braids_locs.front.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair back | `braids_locs` | Masculine | `hair/masculine/braids_locs.back.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Hair front | `braids_locs` | Masculine | `hair/masculine/braids_locs.front.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Accessory | `round_glasses` | Feminine | `accessories/feminine/round_glasses.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Accessory | `round_glasses` | Masculine | `accessories/masculine/round_glasses.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Accessory | `square_glasses` | Feminine | `accessories/feminine/square_glasses.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Accessory | `square_glasses` | Masculine | `accessories/masculine/square_glasses.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Accessory | `cap_beanie` | Feminine | `accessories/feminine/cap_beanie.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Accessory | `cap_beanie` | Masculine | `accessories/masculine/cap_beanie.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Accessory | `head_covering` | Feminine | `accessories/feminine/head_covering.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Accessory | `head_covering` | Masculine | `accessories/masculine/head_covering.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Top | `crew_neck` | Feminine | `tops/feminine/crew_neck.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Top | `crew_neck` | Masculine | `tops/masculine/crew_neck.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Top | `hoodie` | Feminine | `tops/feminine/hoodie.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Top | `hoodie` | Masculine | `tops/masculine/hoodie.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Top | `structured_jacket` | Feminine | `tops/feminine/structured_jacket.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Top | `structured_jacket` | Masculine | `tops/masculine/structured_jacket.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Top | `turtleneck` | Feminine | `tops/feminine/turtleneck.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Top | `turtleneck` | Masculine | `tops/masculine/turtleneck.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Top | `smart_casual` | Feminine | `tops/feminine/smart_casual.webp` | 1024×1024 | Alpha | Pending | Not reviewed |
| Top | `smart_casual` | Masculine | `tops/masculine/smart_casual.webp` | 1024×1024 | Alpha | Pending | Not reviewed |

**Count:** 49 tracked production WebP images: 1 shared background + 10 bases + 20 hair layers + 8 accessories + 10 tops. The delivery package also contains 49 matching PNG masters, for 98 delivered files total. Accessory `none` contributes no file.

## Intake and approval sequence

1. Confirm all expected filenames and reject any unlisted file.
2. Produce file metadata for path, pixel dimensions, byte size, alpha presence, and visible-pixel presence.
3. Run `validateV2Manifest` with that metadata and `requireAllFiles: true`; resolve every missing, unexpected, duplicate, dimension, alpha, empty-image, size, path, reference, and layer-order error.
4. Set complete options to `review`, never directly to `approved`.
5. Review feminine and masculine variants side by side in `?qa=parsona-v2-lab`.
6. Review representative combinations and every option at 180, 120, 96, 48, and 40 px in square and circular crops.
7. Verify English/Spanish labels and accessible descriptions.
8. Run type-check, unit tests, production build, and Rules tests.
9. Complete accessibility and Firestore Rules review.
10. Obtain explicit product approval before marking assets `approved` or considering the public feature flag.

The current renderer and manifest can support this contract without generating flattened combination images. Until every required option is approved, normal users remain on v1 and invalid/incomplete v2 data resolves deterministically to v1.
