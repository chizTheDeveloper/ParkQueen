import React, { useId } from 'react';
import type { AvatarConfig } from '../parsona/types';
import {
  findBackground, findSkin, findFace, findHair, findHairColor,
  findFacialHair, findGlasses, findHeadwear, findOutfit,
  applyColor, FACE_FEATURES_SVG,
} from '../parsona/assets';
import { getDefaultAvatar } from '../parsona/presets';
import { isValidAvatarConfig } from '../parsona/validation';

interface AvatarCompositeProps {
  /** Firestore avatar object. Falls back to a deterministic preset if absent/invalid. */
  avatar?: AvatarConfig | null;
  /** Used to pick a deterministic preset when no avatar is saved. */
  userId?: string;
  /** Display size in pixels. Default: 48 */
  size?: number;
  /** Extra CSS classes for the outer wrapper. */
  className?: string;
  /** Accessible label — defaults to "Avatar" */
  'aria-label'?: string;
}

/**
 * Renders a fully composited Parsona SVG avatar.
 *
 * Layer order (bottom → top):
 *   background → hair_back → outfit → skin/face → face_features →
 *   hair_front → headwear → [face_opening_if_hijab] → glasses → facial_hair
 */
export function AvatarComposite({
  avatar: rawAvatar,
  userId = '',
  size = 48,
  className = '',
  'aria-label': ariaLabel = 'Avatar',
}: AvatarCompositeProps) {
  const uid = useId();
  const clipId = `ac-clip-${uid.replace(/:/g, '')}`;

  const avatar = isValidAvatarConfig(rawAvatar)
    ? rawAvatar
    : getDefaultAvatar(userId);

  const bg      = findBackground(avatar.background);
  const skin    = findSkin(avatar.skin);
  const face    = findFace(avatar.face);
  const hair    = findHair(avatar.hair);
  const hColor  = findHairColor(avatar.hairColor);
  const fhDef   = findFacialHair(avatar.facialHair);
  const glDef   = findGlasses(avatar.glasses);
  const hwDef   = findHeadwear(avatar.headwear);
  const outfit  = findOutfit(avatar.outfit);

  const hairSvg  = hColor.color;
  const skinSvg  = skin.color;
  const hwSvg    = hwDef?.color ?? '#2d4a6e';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>

        {/* ── 1. Background ─────────────────────────────────────────────── */}
        <circle cx="50" cy="50" r="50" fill={bg.color} />

        {/* ── 2. Hair (back layer) ──────────────────────────────────────── */}
        {!hwDef?.coversHair && hair.back && (
          <g dangerouslySetInnerHTML={{ __html: applyColor(hair.back, hairSvg) }} />
        )}

        {/* ── 3. Outfit ─────────────────────────────────────────────────── */}
        <g dangerouslySetInnerHTML={{ __html: applyColor(outfit.svg, outfit.color) }} />

        {/* ── 4. Skin — face shape + neck ───────────────────────────────── */}
        <g dangerouslySetInnerHTML={{ __html: applyColor(face.svg, skinSvg) }} />

        {/* ── 5. Face features (eyes, mouth) ────────────────────────────── */}
        <g dangerouslySetInnerHTML={{ __html: FACE_FEATURES_SVG }} />

        {/* ── 6. Hair (front layer, above face) ────────────────────────── */}
        {!hwDef?.coversHair && hair.front && (
          <g dangerouslySetInnerHTML={{ __html: applyColor(hair.front, hairSvg) }} />
        )}

        {/* ── 7. Headwear ───────────────────────────────────────────────── */}
        {hwDef && (
          <g dangerouslySetInnerHTML={{ __html: applyColor(hwDef.svg, hwSvg) }} />
        )}

        {/* ── 8. Face opening re-render (for hair-covering headwear) ─────── */}
        {hwDef?.coversHair && (
          <>
            {/* Re-render the face oval in skin color on top of headwear */}
            <ellipse cx="50" cy="42" rx="20" ry="24" fill={skinSvg} />
            {/* Re-render face features on top of face opening */}
            <g dangerouslySetInnerHTML={{ __html: FACE_FEATURES_SVG }} />
          </>
        )}

        {/* ── 9. Glasses ────────────────────────────────────────────────── */}
        {glDef && (
          <g dangerouslySetInnerHTML={{ __html: glDef.svg }} />
        )}

        {/* ── 10. Facial hair ───────────────────────────────────────────── */}
        {fhDef && (
          <g dangerouslySetInnerHTML={{ __html: applyColor(fhDef.svg, hairSvg) }} />
        )}

      </g>
    </svg>
  );
}
