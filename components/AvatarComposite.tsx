import React from 'react';
import type { AvatarConfig } from '../parsona/types';
import type { AvatarConfigV2 } from '../parsona/v2/types';
import { getDefaultAvatar } from '../parsona/presets';
import { isValidAvatarConfig } from '../parsona/validation';
import { isValidAvatarConfigV2 } from '../parsona/v2/validation';
import { resolveApprovedV2Layers } from '../parsona/v2/selectors';
import { AvatarCompositeV1 } from './AvatarCompositeV1';
import { AvatarCompositeV2 } from './AvatarCompositeV2';

interface AvatarCompositeProps {
  avatar?: AvatarConfig | AvatarConfigV2 | null;
  userId?: string;
  size?: number;
  className?: string;
  'aria-label'?: string;
}

/** Dispatches v1 unchanged, approved v2 to its compositor, and all unsafe input to deterministic v1. */
export function AvatarComposite({
  avatar: rawAvatar,
  userId = '',
  size = 48,
  className = '',
  'aria-label': ariaLabel = 'Avatar',
}: AvatarCompositeProps) {
  if (isValidAvatarConfigV2(rawAvatar) && resolveApprovedV2Layers(rawAvatar)) {
    return (
      <AvatarCompositeV2
        avatar={rawAvatar}
        size={size}
        className={className}
        aria-label={ariaLabel}
      />
    );
  }

  const avatar = isValidAvatarConfig(rawAvatar) ? rawAvatar : getDefaultAvatar(userId);
  return (
    <AvatarCompositeV1
      avatar={avatar}
      size={size}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
