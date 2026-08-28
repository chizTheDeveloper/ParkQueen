import * as Sentry from '@sentry/react';

export interface InitSentryOptions {
  /** Real value is import.meta.env.PROD — injected as a parameter so this
   * function's gating logic is testable without fighting Vite's env
   * machinery in the test runner. */
  isProd: boolean;
  dsn: string | undefined;
  release: string;
}

// Fields to strip from event.request before it ever leaves the browser —
// defense-in-depth on top of never intentionally attaching them.
const SENSITIVE_REQUEST_KEYS = ['cookies', 'headers', 'data', 'query_string'] as const;

function toPathOnly(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return '';
  }
}

/**
 * Exception monitoring only — no session replay, tracing, profiling, logs,
 * or user feedback (none of those integrations are added; Sentry.init()
 * only activates what's explicitly listed). No Sentry.setUser() call exists
 * anywhere in this module or its callers: no identity is attached in this
 * PR. Global window/unhandledrejection capture and error dedup come from
 * Sentry's own default integrations, which this does not override.
 */
export function initSentry({ isProd, dsn, release }: InitSentryOptions): void {
  if (!isProd || !dsn) return;

  Sentry.init({
    dsn,
    environment: 'production',
    release,
    sendDefaultPii: false,
    integrations: [
      Sentry.breadcrumbsIntegration({
        // May contain Firebase URLs, Firestore document paths, or other
        // application/developer-logging content we don't want to collect.
        console: false,
        fetch: false,
        xhr: false,
        // This SPA has no client-side URL routing (views switch via React
        // state, not the address bar), so these rarely fire in practice —
        // sanitized to path-only below regardless, as defense-in-depth.
        history: true,
      }),
    ],
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'navigation' && breadcrumb.data) {
        if (typeof breadcrumb.data.to === 'string') breadcrumb.data.to = toPathOnly(breadcrumb.data.to);
        if (typeof breadcrumb.data.from === 'string') breadcrumb.data.from = toPathOnly(breadcrumb.data.from);
      }
      return breadcrumb;
    },
    beforeSend(event) {
      delete event.user;
      if (event.request) {
        for (const key of SENSITIVE_REQUEST_KEYS) {
          delete (event.request as Record<string, unknown>)[key];
        }
      }
      return event;
    },
  });
}
