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

  // ── reCAPTCHA sources (added after production report-only violations) ────────

  it('CSP script-src includes Google reCAPTCHA script origins', () => {
    const csp = headerValue('Content-Security-Policy-Report-Only') ?? '';
    const scriptSrc = csp.match(/script-src\s+([^;]+)/)?.[1] ?? '';
    expect(scriptSrc).toContain('https://www.google.com/recaptcha/');
    expect(scriptSrc).toContain('https://www.gstatic.com/recaptcha/');
    // Existing recaptcha.net support preserved
    expect(scriptSrc).toContain('https://www.recaptcha.net');
  });

  it('CSP frame-src includes Google reCAPTCHA frame origins', () => {
    const csp = headerValue('Content-Security-Policy-Report-Only') ?? '';
    const frameSrc = csp.match(/frame-src\s+([^;]+)/)?.[1] ?? '';
    expect(frameSrc).toContain('https://www.google.com/recaptcha/');
    expect(frameSrc).toContain('https://recaptcha.google.com/recaptcha/');
    // Existing recaptcha.net support preserved
    expect(frameSrc).toContain('https://www.recaptcha.net');
    // Firebase auth iframe preserved
    expect(frameSrc).toContain('https://parkqueen-46475363-ccf36.firebaseapp.com');
  });

  it('CSP connect-src includes Google reCAPTCHA connect origin', () => {
    const csp = headerValue('Content-Security-Policy-Report-Only') ?? '';
    const connectSrc = csp.match(/connect-src\s+([^;]+)/)?.[1] ?? '';
    expect(connectSrc).toContain('https://www.google.com/recaptcha/');
  });

  it('CSP remains Report-Only, not enforced', () => {
    expect(headerValue('Content-Security-Policy-Report-Only')).toBeDefined();
    expect(headerValue('Content-Security-Policy')).toBeUndefined();
  });

  it('existing Mapbox connect-src sources are preserved', () => {
    const csp = headerValue('Content-Security-Policy-Report-Only') ?? '';
    const connectSrc = csp.match(/connect-src\s+([^;]+)/)?.[1] ?? '';
    expect(connectSrc).toContain('https://api.mapbox.com');
    expect(connectSrc).toContain('https://events.mapbox.com');
  });

  it('existing Firebase connect-src sources are preserved', () => {
    const csp = headerValue('Content-Security-Policy-Report-Only') ?? '';
    const connectSrc = csp.match(/connect-src\s+([^;]+)/)?.[1] ?? '';
    expect(connectSrc).toContain('https://fcm.googleapis.com');
    expect(connectSrc).toContain('wss://*.firebaseio.com');
    expect(connectSrc).toContain('https://firebasestorage.googleapis.com');
  });
});
