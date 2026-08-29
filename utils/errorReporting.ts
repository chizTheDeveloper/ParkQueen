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

/**
 * Client actions important enough that a terminal, user-visible failure
 * should also reach Sentry — even though the app already handles the
 * failure locally and never lets it become an uncaught exception. Add a
 * value here only when it is actually wired up at a real terminal catch;
 * see docs/PR body for the audit of what was and wasn't instrumented and why.
 */
export type CriticalAction =
  | 'account_create'
  | 'ping_create'
  | 'spot_claim'
  | 'claim_cancel'
  | 'message_send'
  | 'chat_delete';

/**
 * Deliberately tiny and low-cardinality — no document/user identifiers, no
 * coordinates, no message content. `operationType` exists only for actions
 * that have a real immediate/scheduled duality (Ping creation today).
 */
export interface CriticalActionContext {
  surface?: string;
  errorCode?: string;
  operationType?: 'immediate' | 'scheduled';
}

function extractErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  if (error instanceof Error && error.name) return error.name;
  return undefined;
}

// Never forwards error.message: Firebase/callable error messages aren't
// guaranteed free of echoed user input (e.g. moderation/cooldown text), so
// the safe policy is uniform rather than audited per call site. The stack
// is preserved for real diagnostic value; the message is a fixed, action-
// scoped string instead.
function sanitizeError(error: unknown, action: CriticalAction): Error {
  const safe = new Error(`critical_action_failure:${action}`);
  safe.name = 'CriticalActionFailure';
  if (error instanceof Error && error.stack) safe.stack = error.stack;
  return safe;
}

/**
 * The single sanctioned way to report a terminal, already-handled failure
 * of a critical client action. Never throws, never blocks the caller, and
 * is a safe no-op if Sentry itself is unavailable or misbehaves.
 */
export function reportCriticalActionFailure(
  action: CriticalAction,
  error: unknown,
  context?: CriticalActionContext
): void {
  try {
    const errorCode = context?.errorCode ?? extractErrorCode(error);
    Sentry.withScope((scope) => {
      scope.setTag('action', action);
      if (context?.surface) scope.setTag('surface', context.surface);
      if (context?.operationType) scope.setTag('operationType', context.operationType);
      if (errorCode) scope.setTag('errorCode', errorCode);
      Sentry.captureException(sanitizeError(error, action));
    });
  } catch {
    // Monitoring must never affect the product.
  }
}
