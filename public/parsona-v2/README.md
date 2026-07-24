# Parsona v2 production asset contract

This directory is intentionally artwork-free until professional layers pass review. Do not use the reference boards or v1 SVG artwork as production v2 assets.

The canonical canvas, anchor, palette, filename, review, and intake requirements are tracked in [`docs/PARSONA_V2_ARTWORK_SPEC.md`](../../docs/PARSONA_V2_ARTWORK_SPEC.md). This file is only a directory-level summary.

## Source and export requirements

- Source masters: 1024×1024 transparent PNG.
- Production exports: optimized transparent WebP.
- Shared canvas: identical eye line, head position, neck position, and shoulder bounds.
- Base-style variants: `feminine` and `masculine` for every portrait-dependent option.
- Fixed background: `backgrounds/parqueen_navy.webp`.

## Required production filenames

```text
backgrounds/parqueen_navy.webp

bases/feminine/tone_01.webp ... tone_05.webp
bases/masculine/tone_01.webp ... tone_05.webp

hair/feminine/short_fade.back.webp
hair/feminine/short_fade.front.webp
hair/feminine/short_curls.back.webp
hair/feminine/short_curls.front.webp
hair/feminine/medium_textured.back.webp
hair/feminine/medium_textured.front.webp
hair/feminine/long_hair.back.webp
hair/feminine/long_hair.front.webp
hair/feminine/braids_locs.back.webp
hair/feminine/braids_locs.front.webp
hair/masculine/{same five IDs}.{back|front}.webp

accessories/feminine/{round_glasses|square_glasses|cap_beanie|head_covering}.webp
accessories/masculine/{round_glasses|square_glasses|cap_beanie|head_covering}.webp

tops/feminine/{crew_neck|hoodie|structured_jacket|turtleneck|smart_casual}.webp
tops/masculine/{crew_neck|hoodie|structured_jacket|turtleneck|smart_casual}.webp
```

If an option needs a foreground correction, use the same option stem with `.foreground.webp` and add it to the typed manifest.

## Layer order

1. background
2. back hair
3. top and shoulders
4. base face and neck
5. front hair
6. accessory
7. foreground detail

An option remains `pending` until all required variants exist. It becomes `approved` only after every enablement check in the design specification and `HANDOFF.md` passes.
