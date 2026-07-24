import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AvatarComposite } from './AvatarComposite';
import { AvatarCompositeV2 } from './AvatarCompositeV2';
import { DEFAULT_AVATAR_V2 } from '../parsona/v2/constants';

describe('AvatarComposite v2 dispatch', () => {
  it('uses a deterministic v1 avatar when v2 artwork is pending', () => {
    const first = renderToStaticMarkup(
      <AvatarComposite avatar={DEFAULT_AVATAR_V2} userId="stable-user" aria-label="Fallback" />,
    );
    const second = renderToStaticMarkup(
      <AvatarComposite avatar={DEFAULT_AVATAR_V2} userId="stable-user" aria-label="Fallback" />,
    );
    expect(first).toBe(second);
    expect(first).toContain('<svg');
    expect(first).not.toContain('Artwork pending');
    expect(first).not.toContain('<img');
  });

  it('renders the neutral pending silhouette only in explicit review mode', () => {
    const markup = renderToStaticMarkup(
      <AvatarCompositeV2
        avatar={DEFAULT_AVATAR_V2}
        size={96}
        reviewMode
        aria-label="Artwork pending"
      />,
    );
    expect(markup).toContain('Artwork pending');
    expect(markup).toContain('<svg');
    expect(markup).not.toContain('<img');
  });

  it('renders no broken layers when pending artwork is used outside review mode', () => {
    const markup = renderToStaticMarkup(
      <AvatarCompositeV2 avatar={DEFAULT_AVATAR_V2} size={48} aria-label="Parsona" />,
    );
    expect(markup).toBe('');
  });
});
