import * as Sentry from '@sentry/react';

/**
 * The only context fields callers may attach to a reported exception.
 * Deliberately narrow — no props, no state, no request bodies, no arbitrary
 * objects. Business-action instrumentation (which action/route failed) is a
 * separate, later PR; this type exists now so the allowlist is enforced by
 * the type system from the start, not bolted on afterward.
 */
export interface SafeErrorContext {
  route?: string;
  component?: string;
  errorCode?: string;
}

/**
 * The single sanctioned way to report a client exception. Context is
 * allowlisted by this function's own signature, not by convention.
 */
export function captureClientException(error: unknown, context?: SafeErrorContext): void {
  Sentry.withScope((scope) => {
    if (context?.route) scope.setTag('route', context.route);
    if (context?.component) scope.setTag('component', context.component);
    if (context?.errorCode) scope.setTag('errorCode', context.errorCode);
    Sentry.captureException(error);
  });
}
