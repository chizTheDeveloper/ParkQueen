export type PublicLegalDocument = 'privacy' | 'terms';

export const LEGAL_PATHS = {
  privacy: '/privacy',
  terms: '/terms',
} as const;

type PublicLegalRoute = {
  document: PublicLegalDocument;
  canonicalPath: string;
};

const LEGAL_ROUTES: Record<string, PublicLegalRoute> = {
  '/privacy': { document: 'privacy', canonicalPath: LEGAL_PATHS.privacy },
  '/privacy-policy': { document: 'privacy', canonicalPath: LEGAL_PATHS.privacy },
  '/terms': { document: 'terms', canonicalPath: LEGAL_PATHS.terms },
  '/terms-conditions': { document: 'terms', canonicalPath: LEGAL_PATHS.terms },
};

export const resolvePublicLegalRoute = (pathname: string): PublicLegalRoute | null =>
  LEGAL_ROUTES[pathname.replace(/\/+$/, '') || '/'] ?? null;
