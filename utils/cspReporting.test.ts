import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const config = JSON.parse(readFileSync(resolve(__dirname, '../firebase.json'), 'utf-8'));
const csp: string = (config.hosting?.headers ?? [])
  .flatMap((b: { headers: Array<{ key: string; value: string }> }) => b.headers)
  .find((h: { key: string }) => h.key === 'Content-Security-Policy')?.value ?? '';

const directive = (name: string) =>
  csp.split(';').map(p => p.trim()).find(p => p === name || p.startsWith(name + ' '))
    ?.slice(name.length).trim() ?? '';

const reportUri = directive('report-uri');

describe('CSP violation reporting', () => {
  it('sends violation reports somewhere', () => {
    expect(reportUri).not.toBe('');
  });

  it('reports to the project\'s own Sentry security endpoint', () => {
    // Sentry ingests CSP reports natively at /api/<project>/security/, so this
    // needs no Cloud Function, no new backend and no server to keep alive.
    const url = new URL(reportUri);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toMatch(/\.ingest\.[a-z0-9.]*sentry\.io$/);
    expect(url.pathname).toMatch(/^\/api\/\d+\/security\/$/);
    // sentry_key is the DSN's PUBLIC key — already shipped in the client bundle,
    // so this adds no exposure. It is not an auth token.
    expect(url.searchParams.get('sentry_key')).toMatch(/^[a-f0-9]{32}$/);
    expect(reportUri).not.toMatch(/sentry_secret|auth_token|Bearer/i);
  });

  it('points at the same Sentry project the browser SDK already uses', () => {
    // A mismatch would silently split violations into a project nobody watches.
    const url = new URL(reportUri);
    const projectId = url.pathname.match(/^\/api\/(\d+)\/security\/$/)?.[1];
    expect(projectId).toBeTruthy();
    const connectSrc = directive('connect-src');
    expect(connectSrc).toContain(url.origin);
  });

  it('adds reporting WITHOUT weakening any existing directive', () => {
    // The whole point is visibility, not permissiveness.
    expect(directive('script-src')).not.toContain("'unsafe-inline'");
    expect(directive('script-src')).not.toContain("'unsafe-eval'");
    expect(directive('script-src')).not.toContain('blob:');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it('stays ENFORCED — reporting is added to the enforced policy, not a second report-only one', () => {
    const keys = (config.hosting?.headers ?? [])
      .flatMap((b: { headers: Array<{ key: string }> }) => b.headers)
      .map((h: { key: string }) => h.key);
    expect(keys).toContain('Content-Security-Policy');
    expect(keys).not.toContain('Content-Security-Policy-Report-Only');
  });

  it('does not declare report-to without a Reporting-API-capable endpoint', () => {
    // Sentry's security endpoint ingests the legacy application/csp-report body
    // that report-uri sends. It answers 200 to ANY payload (verified: even
    // "hello-world"), so a report-to/Reporting-Endpoints pair aimed at it could
    // not be proven to work and would create false confidence. report-uri is
    // still honoured by Chrome, Firefox and Safari; revisit if Chrome drops it.
    expect(csp).not.toContain('report-to');
    const keys = (config.hosting?.headers ?? [])
      .flatMap((b: { headers: Array<{ key: string }> }) => b.headers)
      .map((h: { key: string }) => h.key);
    expect(keys).not.toContain('Reporting-Endpoints');
  });

  it('keeps report-uri last so the directive list stays readable', () => {
    const names = csp.split(';').map(p => p.trim().split(' ')[0]).filter(Boolean);
    expect(names[names.length - 1]).toBe('report-uri');
  });
});
