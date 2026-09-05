import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const config = JSON.parse(readFileSync(resolve(__dirname, '../firebase.json'), 'utf-8'));
const allHeaders: Array<{ key: string; value: string }> = (config.hosting?.headers ?? [])
  .flatMap((block: { headers: Array<{ key: string; value: string }> }) => block.headers);

function headerValue(key: string): string | undefined {
  return allHeaders.find(h => h.key === key)?.value;
}

const csp = headerValue('Content-Security-Policy') ?? '';
// Split on ';' rather than regex: directive values contain '/' and '*' and
// the escaping is easy to get subtly wrong.
const directive = (name: string) =>
  csp.split(';')
    .map(part => part.trim())
    .find(part => part === name || part.startsWith(name + ' '))
    ?.slice(name.length).trim() ?? '';

describe('firebase.json hosting headers', () => {
  it('serves an ENFORCED Content-Security-Policy, not report-only', () => {
    expect(headerValue('Content-Security-Policy')).toBeDefined();
    expect(headerValue('Content-Security-Policy-Report-Only')).toBeUndefined();
  });

  it('X-Content-Type-Options is nosniff', () => {
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
  });

  it('X-Frame-Options is DENY', () => {
    expect(headerValue('X-Frame-Options')).toBe('DENY');
  });

  it('HSTS header is present', () => {
    expect(headerValue('Strict-Transport-Security')).toMatch(/max-age=\d+/);
  });
});

describe('CSP hardening invariants', () => {
  it('never allows unsafe-eval, and never allows inline or blob script', () => {
    const scriptSrc = directive('script-src');
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    // The app ships zero inline scripts; the esm.sh importmap that used to be the
    // only one was removed. Re-adding an inline script must fail this test rather
    // than quietly reintroduce 'unsafe-inline' to script-src.
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain('blob:');
  });

  it('has no wildcard host in script-src or connect-src', () => {
    expect(directive('script-src').split(' ')).not.toContain('*');
    expect(directive('connect-src').split(' ')).not.toContain('*');
  });

  it('keeps the clickjacking and injection base directives locked down', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  it('never readmits the Tailwind Play CDN', () => {
    expect(csp).not.toContain('cdn.tailwindcss.com');
  });

  it('does not readmit esm.sh — the importmap it served was removed', () => {
    expect(csp).not.toContain('esm.sh');
  });

  it('does not carry Realtime Database origins — the app uses Firestore only', () => {
    expect(csp).not.toContain('firebaseio.com');
  });

  it('does not allow voiceagent.ai in any directive', () => {
    expect(csp).not.toContain('voiceagent.ai');
  });
});

describe('CSP allows every origin production actually depends on', () => {
  it('script-src covers reCAPTCHA (Auth + App Check) and Firebase Analytics', () => {
    const s = directive('script-src');
    expect(s).toContain("'self'");
    expect(s).toContain('https://www.google.com/recaptcha/');
    expect(s).toContain('https://www.recaptcha.net');
    // App Check uses reCAPTCHA Enterprise; the messaging service worker also
    // importScripts() the Firebase compat SDK from this origin.
    expect(s).toContain('https://www.gstatic.com');
    expect(s).toContain('https://apis.google.com');
    // Firebase Analytics loads gtag from here — omitting it broke Analytics.
    expect(s).toContain('https://www.googletagmanager.com');
  });

  it('connect-src covers Firebase, Cloud Functions, Mapbox, Sentry and Analytics', () => {
    const c = directive('connect-src');
    expect(c).toContain("'self'");
    // Firestore, Auth, App Check, Installations, FCM registration, Storage.
    expect(c).toContain('https://*.googleapis.com');
    expect(c).toContain('https://us-central1-parkqueen-46475363-ccf36.cloudfunctions.net');
    expect(c).toContain('https://api.mapbox.com');
    expect(c).toContain('https://events.mapbox.com');
    // Sentry ingest — absent from the old policy, so enforcement would have
    // silently killed error reporting.
    expect(c).toContain('https://o4511989351448576.ingest.us.sentry.io');
    expect(c).toContain('https://www.googletagmanager.com');
    expect(c).toContain('https://*.google-analytics.com');
  });

  it('style-src and font-src cover FontAwesome', () => {
    expect(directive('style-src')).toContain('https://cdnjs.cloudflare.com');
    expect(directive('font-src')).toContain('https://cdnjs.cloudflare.com');
  });

  it("style-src keeps 'unsafe-inline' — React sets inline style attributes", () => {
    // CSP governs style ATTRIBUTES under style-src, and React writes them all
    // over the map shell, sheets and animations. Hashes cannot express a
    // per-element style attribute, so removing this needs a component refactor,
    // not a header change. Pinned so the reason is recorded, not rediscovered.
    expect(directive('style-src')).toContain("'unsafe-inline'");
  });

  it('img-src covers Mapbox tiles, Firebase Storage avatars, data: and blob:', () => {
    const i = directive('img-src');
    expect(i).toContain('data:');
    expect(i).toContain('blob:');
    expect(i).toContain('https://*.mapbox.com');
    expect(i).toContain('https://firebasestorage.googleapis.com');
  });

  it('worker-src allows blob: — mapbox-gl compiles its render workers that way', () => {
    expect(directive('worker-src')).toContain('blob:');
  });

  it('frame-src covers reCAPTCHA challenge and the Firebase auth helper iframe', () => {
    const f = directive('frame-src');
    expect(f).toContain('https://www.google.com/recaptcha/');
    expect(f).toContain('https://recaptcha.google.com/recaptcha/');
    expect(f).toContain('https://www.recaptcha.net');
    expect(f).toContain('https://parkqueen-46475363-ccf36.firebaseapp.com');
  });
});
