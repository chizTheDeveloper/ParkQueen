import React from 'react';
import TestRenderer from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { PrivacyPolicyView } from './PrivacyPolicyView';
import { TermsOfUseView } from './TermsOfUseView';

const renderedText = (element: React.ReactElement) =>
  JSON.stringify(TestRenderer.create(element).toJSON());

describe('public legal copy', () => {
  it('discloses the location-derived geohash and timestamp used for nearby alerts', () => {
    const privacy = renderedText(<PrivacyPolicyView onBack={vi.fn()} />);

    expect(privacy).toContain('geohash');
    expect(privacy).toContain('update timestamp');
    expect(privacy).toContain('nearby parking alerts');
  });

  it('uses the public-facing ParQueen brand consistently', () => {
    const legalCopy = [
      renderedText(<PrivacyPolicyView onBack={vi.fn()} />),
      renderedText(<TermsOfUseView onBack={vi.fn()} />),
    ].join(' ');

    expect(legalCopy).toContain('ParQueen');
    expect(legalCopy).not.toContain('ParkQueen');
  });
});
