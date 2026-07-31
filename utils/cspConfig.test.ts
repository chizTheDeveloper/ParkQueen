import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const config = JSON.parse(readFileSync(resolve(__dirname, '../firebase.json'), 'utf-8'));
const allHeaders: Array<{ key: string; value: string }> = (config.hosting?.headers ?? [])
  .flatMap((block: { headers: Array<{ key: string; value: string }> }) => block.headers);

function headerValue(key: string): string | undefined {
  return allHeaders.find(h => h.key === key)?.value;
}

describe('firebase.json hosting headers', () => {
  it('includes Content-Security-Policy-Report-Only', () => {
    expect(headerValue('Content-Security-Policy-Report-Only')).toBeDefined();
  });

  it('CSP script-src does not contain wildcard or unsafe-eval', () => {
    const csp = headerValue('Content-Security-Policy-Report-Only') ?? '';
    const scriptSrc = csp.match(/script-src\s+([^;]+)/)?.[1] ?? '';
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).not.toMatch(/\s\*(\s|;|$)/);
  });

  it('CSP connect-src does not contain wildcard', () => {
    const csp = headerValue('Content-Security-Policy-Report-Only') ?? '';
    const connectSrc = csp.match(/connect-src\s+([^;]+)/)?.[1] ?? '';
    expect(connectSrc).not.toMatch(/\s\*(\s|;|$)/);
  });

  it('CSP frame-ancestors is none', () => {
    const csp = headerValue('Content-Security-Policy-Report-Only') ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('X-Content-Type-Options is nosniff', () => {
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
  });

  it('X-Frame-Options is DENY', () => {
    expect(headerValue('X-Frame-Options')).toBe('DENY');
  });

  it('CSP does not allow voiceagent.ai in any directive', () => {
    const csp = headerValue('Content-Security-Policy-Report-Only') ?? '';
    expect(csp).not.toContain('voiceagent.ai');
  });

  it('HSTS header is present', () => {
    expect(headerValue('Strict-Transport-Security')).toMatch(/max-age=\d+/);
  });
});
