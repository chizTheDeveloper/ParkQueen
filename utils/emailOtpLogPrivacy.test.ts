import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const src = readFileSync(resolve(process.cwd(), 'functions/index.js'), 'utf-8');

/** The `_deliverEmailOtp` function body. */
const deliver = (() => {
  const start = src.indexOf('async function _deliverEmailOtp');
  const end = src.indexOf('exports._deliverEmailOtp', start);
  expect(start).toBeGreaterThan(-1);
  return src.slice(start, end);
})();

/** The generateEmailOTP delivery catch block that emits the failure log. */
const failureCatch = (() => {
  const i = src.indexOf("console.error('Email OTP delivery failed'");
  expect(i).toBeGreaterThan(-1);
  return src.slice(src.lastIndexOf('} catch', i), src.indexOf('throw new HttpsError("internal"', i));
})();

/** Comments explain why a value is withheld, so they must not fail the scan. */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');

/**
 * Static invariants, deliberately not emulator-dependent. GE-8a/b/c prove the
 * runtime behaviour; these prove the shape of the code can't drift back into
 * logging something sensitive without a test going red.
 */
describe('email OTP delivery failure logging', () => {
  it('logs the numeric status as a structured field, not interpolated into the message', () => {
    expect(src).toContain("console.error('Email OTP delivery failed', { status })");
    // no template literal or concatenation smuggling values into the message
    expect(src).not.toMatch(/console\.error\(`Email OTP delivery failed/);
    expect(src).not.toMatch(/console\.error\('Email OTP delivery failed'\s*\+/);
  });

  it('keeps the unqualified log line for failures with no HTTP response', () => {
    // network error / AbortSignal timeout / superseded request
    expect(src).toContain("console.error('Email OTP delivery failed');");
  });

  it('only ever attaches a number as the status', () => {
    expect(failureCatch).toMatch(/typeof e\?\.status === 'number'/);
    expect(deliver).toMatch(/typeof res\?\.status === 'number'/);
  });

  it('still discards the SendGrid response body unread', () => {
    // SendGrid echoes the recipient address inside error payloads.
    expect(deliver).toContain('res?.body?.cancel?.()');
    expect(deliver).not.toMatch(/res\.(text|json)\(\)/);
    expect(deliver).not.toMatch(/await\s+res\.(text|json)/);
  });

  it('never logs the recipient, the code, headers, the key or the payload', () => {
    const forbidden = [
      'email', 'code', 'recipient', 'to:',
      'Authorization', 'Bearer', 'sendgridApiKey', 'apiKey',
      'headers', 'body:', 'personalizations', 'payload',
    ];
    const code = stripComments(failureCatch);
    for (const token of forbidden) {
      expect(code, `failure log must not reference ${token}`).not.toContain(token);
    }
  });

  it('the failure log emits exactly one field, and that field is status', () => {
    const objects = stripComments(failureCatch).match(/console\.error\([^)]*\{[^}]*\}/g) ?? [];
    expect(objects.length).toBe(1);
    const fields = (objects[0].match(/\{([^}]*)\}/)?.[1] ?? '').trim();
    expect(fields).toBe('status');
  });

  it('preserves the sanitized user-facing error and the rollback', () => {
    expect(failureCatch).toContain('tx.delete(docRef)');           // rollback intact
    expect(src).toContain('throw new HttpsError("internal", "Failed to send verification email.");');
  });

  it('does not log anything on the success path', () => {
    expect(deliver).not.toContain('console.');
  });
});
