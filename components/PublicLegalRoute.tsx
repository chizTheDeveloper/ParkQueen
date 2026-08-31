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
  <Suspense fallback={<LoadingScreen />}>
    {document === 'privacy'
      ? <PrivacyPolicyView onBack={onExit} />
      : <TermsOfUseView onBack={onExit} />}
  </Suspense>
);
