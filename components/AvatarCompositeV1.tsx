import React, { useId } from 'react';
import type { AvatarConfig } from '../parsona/types';
import {
  findBackground, findSkin, findFace, findHair, findHairColor,
  findFacialHair, findGlasses, findHeadwear, findOutfit,
  applyColor, FACE_FEATURES_SVG,
} from '../parsona/assets';

interface AvatarCompositeV1Props {
  avatar: AvatarConfig;
  size?: number;
  className?: string;
  'aria-label'?: string;
}
/** The original v1 layered SVG renderer, preserved for saved-avatar compatibility. */
export function AvatarCompositeV1({
  avatar,
  size = 48,
  className = '',
  'aria-label': ariaLabel = 'Avatar',
}: AvatarCompositeV1Props) {
  const uid = useId();
  const clipId = `ac-clip-${uid.replace(/:/g, '')}`;
  const bg = findBackground(avatar.background);
  const skin = findSkin(avatar.skin);
  const face = findFace(avatar.face);
  const hair = findHair(avatar.hair);
  const hColor = findHairColor(avatar.hairColor);
  const fhDef = findFacialHair(avatar.facialHair);
  const glDef = findGlasses(avatar.glasses);
  const hwDef = findHeadwear(avatar.headwear);
  const outfit = findOutfit(avatar.outfit);
  const hairSvg = hColor.color;
  const skinSvg = skin.color;
  const hwSvg = hwDef?.color ?? '#2d4a6e';

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
        <clipPath id={clipId}><circle cx="50" cy="50" r="50" /></clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <circle cx="50" cy="50" r="50" fill={bg.color} />
        {!hwDef?.coversHair && hair.back && (
          <g dangerouslySetInnerHTML={{ __html: applyColor(hair.back, hairSvg) }} />
        )}
        <g dangerouslySetInnerHTML={{ __html: applyColor(outfit.svg, outfit.color) }} />
        <g dangerouslySetInnerHTML={{ __html: applyColor(face.svg, skinSvg) }} />
        <g dangerouslySetInnerHTML={{ __html: FACE_FEATURES_SVG }} />
        {fhDef && !hwDef?.coversHair && (
          <g dangerouslySetInnerHTML={{ __html: applyColor(fhDef.svg, hairSvg) }} />
        )}
        {!hwDef?.coversHair && hair.front && (
          <g dangerouslySetInnerHTML={{ __html: applyColor(hair.front, hairSvg) }} />
        )}
        {glDef && !hwDef?.coversHair && (
          <g dangerouslySetInnerHTML={{ __html: glDef.svg }} />
        )}
        {hwDef && (
          <g dangerouslySetInnerHTML={{ __html: applyColor(hwDef.svg, hwSvg) }} />
        )}
        {hwDef?.coversHair && (
          <>
            <g dangerouslySetInnerHTML={{ __html: applyColor(face.svg, skinSvg) }} />
            <g dangerouslySetInnerHTML={{ __html: FACE_FEATURES_SVG }} />
            {fhDef && <g dangerouslySetInnerHTML={{ __html: applyColor(fhDef.svg, hairSvg) }} />}
            {glDef && <g dangerouslySetInnerHTML={{ __html: glDef.svg }} />}
          </>
        )}
      </g>
    </svg>
  );
}
