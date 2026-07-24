import React from 'react';
import type { AvatarConfigV2, ResolvedV2Layers } from '../parsona/v2/types';
import { PARSONA_V2_LAYER_ORDER } from '../parsona/v2/types';
import { resolveApprovedV2Layers } from '../parsona/v2/selectors';

interface AvatarCompositeV2Props {
  avatar: AvatarConfigV2;
  size?: number;
  className?: string;
  reviewMode?: boolean;
  resolvedLayers?: ResolvedV2Layers | null;
  'aria-label'?: string;
}

export function AvatarCompositeV2({
  avatar,
  size = 48,
  className = '',
  reviewMode = false,
  resolvedLayers,
  'aria-label': ariaLabel = 'Parsona',
}: AvatarCompositeV2Props) {
  const layers = resolvedLayers === undefined ? resolveApprovedV2Layers(avatar) : resolvedLayers;
  if (!layers) {
    if (!import.meta.env.DEV || !reviewMode) return null;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label={ariaLabel}
        className={className}
        style={{ display: 'block', flexShrink: 0 }}
      >
        <circle cx="50" cy="50" r="50" fill="#06162d" />
        <circle cx="50" cy="39" r="20" fill="#53657d" />
        <path d="M12 100Q18 68 50 68Q82 68 88 100Z" fill="#34465e" />
        <path d="M28 27Q36 14 50 14Q66 14 74 28Q63 21 50 21Q38 21 28 27Z" fill="#718197" opacity=".7" />
        <title>Artwork pending</title>
      </svg>
    );
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        overflow: 'hidden',
        borderRadius: '50%',
        flexShrink: 0,
      }}
    >
      {PARSONA_V2_LAYER_ORDER.map(key => {
        const src = layers[key];
        return src ? (
          <img
            key={key}
            src={src}
            alt=""
            aria-hidden="true"
            draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        ) : null;
      })}
    </div>
  );
}
