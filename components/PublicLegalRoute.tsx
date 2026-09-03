import React, { lazy, Suspense } from 'react';
import { LoadingScreen } from './LoadingScreen';
import type { PublicLegalDocument } from '../utils/legalRoutes';

const PrivacyPolicyView = lazy(() => import('../views/PrivacyPolicyView').then(module => ({ default: module.PrivacyPolicyView })));
const TermsOfUseView = lazy(() => import('../views/TermsOfUseView').then(module => ({ default: module.TermsOfUseView })));

export const PublicLegalRoute = ({
  document,
  onExit,
}: {
  document: PublicLegalDocument;
  onExit: () => void;
}) => (
  // tabIndex makes the sole scroll owner keyboard-operable: this container
  // removes the viewport's own scrollability, and Chrome will not route
  // Page Down/Space to an unfocusable child scroller (WCAG 2.1.1).
  <div className="public-legal-scroll" tabIndex={0}>
    <Suspense fallback={<LoadingScreen />}>
      {document === 'privacy'
        ? <PrivacyPolicyView onBack={onExit} />
        : <TermsOfUseView onBack={onExit} />}
    </Suspense>
  </div>
);
