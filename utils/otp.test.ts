import { describe, it, expect } from 'vitest';
import { filterOtpInput, otpErrorKey, isOtpComplete } from './otp';

// ─── filterOtpInput ────────────────────────────────────────────────────────────

describe('filterOtpInput', () => {
    it('keeps only digits', () => {
        expect(filterOtpInput('1a2b3c')).toBe('123');
    });

    it('trims to 6 characters max', () => {
        expect(filterOtpInput('1234567')).toBe('123456');
    });

    it('returns empty string for empty input', () => {
        expect(filterOtpInput('')).toBe('');
    });

    it('rejects all symbols', () => {
        expect(filterOtpInput('!@#$%^')).toBe('');
    });

    it('strips spaces from pasted code with spaces', () => {
        expect(filterOtpInput('12 34 56')).toBe('123456');
    });

    it('strips dashes from pasted code with dashes', () => {
        expect(filterOtpInput('12-34-56')).toBe('123456');
    });

    it('handles partial entry', () => {
        expect(filterOtpInput('123')).toBe('123');
    });

    it('passes through exactly 6 digits unchanged', () => {
        expect(filterOtpInput('654321')).toBe('654321');
    });

    it('strips leading and trailing spaces', () => {
        expect(filterOtpInput(' 123456 ')).toBe('123456');
    });

    it('takes only the first 6 from a long numeric string', () => {
        expect(filterOtpInput('12345678')).toBe('123456');
    });

    it('handles all-zeros code', () => {
        expect(filterOtpInput('000000')).toBe('000000');
    });
});

// ─── otpErrorKey ───────────────────────────────────────────────────────────────

describe('otpErrorKey', () => {
    it('maps invalid-verification-code to invalid_code key', () => {
        expect(otpErrorKey('auth/invalid-verification-code')).toBe('verify_phone.invalid_code');
    });

    it('maps code-expired to expired key', () => {
        expect(otpErrorKey('auth/code-expired')).toBe('verify_phone.expired');
    });

    it('maps too-many-requests to too_many key', () => {
        expect(otpErrorKey('auth/too-many-requests')).toBe('verify_phone.too_many');
    });

    it('falls back to failed_retry for unknown code', () => {
        expect(otpErrorKey('auth/unknown-error')).toBe('verify_phone.failed_retry');
    });

    it('falls back to failed_retry for empty string', () => {
        expect(otpErrorKey('')).toBe('verify_phone.failed_retry');
    });

    it('falls back to failed_retry for network error', () => {
        expect(otpErrorKey('auth/network-request-failed')).toBe('verify_phone.failed_retry');
    });

    it('falls back to failed_retry for session-expired', () => {
        expect(otpErrorKey('auth/session-expired')).toBe('verify_phone.failed_retry');
    });

    it('maps too-many-requests consistently for resend context', () => {
        expect(otpErrorKey('auth/too-many-requests')).toBe('verify_phone.too_many');
    });
});

// ─── isOtpComplete ─────────────────────────────────────────────────────────────

describe('isOtpComplete', () => {
    it('returns true for exactly 6 characters', () => {
        expect(isOtpComplete('123456')).toBe(true);
    });

    it('returns false for 5 characters', () => {
        expect(isOtpComplete('12345')).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(isOtpComplete('')).toBe(false);
    });

    it('returns false for 7 characters (post-filter should never happen)', () => {
        expect(isOtpComplete('1234567')).toBe(false);
    });

    it('returns true for all-zeros code', () => {
        expect(isOtpComplete('000000')).toBe(true);
    });

    it('returns true for all-nines code', () => {
        expect(isOtpComplete('999999')).toBe(true);
    });

    it('returns false for each count 0–5', () => {
        for (let n = 0; n < 6; n++) {
            expect(isOtpComplete('1'.repeat(n))).toBe(false);
        }
    });

    it('true only for length exactly 6, not longer', () => {
        expect(isOtpComplete('123456')).toBe(true);
        expect(isOtpComplete('1234567')).toBe(false);
    });
});
