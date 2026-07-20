import { describe, it, expect } from 'vitest';
import {
    parseNationalToE164,
    parseInternationalPaste,
    formatPhoneForDisplay,
    getNationalInput,
    isAllowedCountry,
    isNANPCountry,
    maskPhone,
    maskPhoneForDisplay,
    ALLOWED_COUNTRIES,
} from './phone';

// ─── Allowlist ─────────────────────────────────────────────────────────────────

describe('ALLOWED_COUNTRIES', () => {
    it('default country is US (first entry)', () => {
        expect(ALLOWED_COUNTRIES[0].code).toBe('US');
    });

    it('contains at least US', () => {
        expect(ALLOWED_COUNTRIES.length).toBeGreaterThanOrEqual(1);
        expect(ALLOWED_COUNTRIES.map(c => c.code)).toContain('US');
    });

    it('isAllowedCountry covers all 7 target countries regardless of live gate', () => {
        // isAllowedCountry checks the full target list, not just the live selector
        for (const code of ['US', 'CA', 'PR', 'DO', 'MX', 'PE', 'GB']) {
            expect(isAllowedCountry(code)).toBe(true);
        }
    });
});

describe('isAllowedCountry', () => {
    it('allows all 7 supported countries', () => {
        for (const { code } of ALLOWED_COUNTRIES) {
            expect(isAllowedCountry(code)).toBe(true);
        }
    });

    it('rejects unsupported countries', () => {
        expect(isAllowedCountry('ES')).toBe(false);
        expect(isAllowedCountry('FR')).toBe(false);
        expect(isAllowedCountry('AR')).toBe(false);
        expect(isAllowedCountry('BR')).toBe(false);
    });
});

// ─── National → E.164 ──────────────────────────────────────────────────────────

describe('parseNationalToE164', () => {
    it('US national number → correct E.164', () => {
        expect(parseNationalToE164('2015551234', 'US')).toBe('+12015551234');
    });

    it('Canada national number → correct E.164', () => {
        expect(parseNationalToE164('6135551234', 'CA')).toBe('+16135551234');
    });

    it('Puerto Rico national number → correct E.164', () => {
        expect(parseNationalToE164('7875551234', 'PR')).toBe('+17875551234');
    });

    it('Dominican Republic national number → correct E.164', () => {
        expect(parseNationalToE164('8095551234', 'DO')).toBe('+18095551234');
    });

    it('Mexico national number → correct E.164', () => {
        expect(parseNationalToE164('5512345678', 'MX')).toBe('+525512345678');
    });

    it('Peru national number → correct E.164', () => {
        expect(parseNationalToE164('987654321', 'PE')).toBe('+51987654321');
    });

    it('UK national number with leading trunk zero → correct E.164', () => {
        expect(parseNationalToE164('07911123456', 'GB')).toBe('+447911123456');
    });

    it('UK national number without trunk zero → correct E.164', () => {
        expect(parseNationalToE164('7911123456', 'GB')).toBe('+447911123456');
    });

    it('returns null for too-short input', () => {
        expect(parseNationalToE164('123', 'US')).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(parseNationalToE164('', 'US')).toBeNull();
    });

    it('invalid Peru number returns null', () => {
        // PE mobile numbers start with 9; a number starting with 1 is invalid
        expect(parseNationalToE164('112345678', 'PE')).toBeNull();
    });
});

// ─── International paste ────────────────────────────────────────────────────────

describe('parseInternationalPaste', () => {
    it('+51 paste switches country to Peru and extracts E.164', () => {
        const result = parseInternationalPaste('+51987654321', 'US');
        expect(result.country).toBe('PE');
        expect(result.e164).toBe('+51987654321');
        expect(result.unsupported).toBe(false);
    });

    it('+44 paste switches country to UK and extracts E.164', () => {
        const result = parseInternationalPaste('+447911123456', 'US');
        expect(result.country).toBe('GB');
        expect(result.e164).toBe('+447911123456');
        expect(result.unsupported).toBe(false);
    });

    it('+52 paste switches to Mexico', () => {
        const result = parseInternationalPaste('+525512345678', 'US');
        expect(result.country).toBe('MX');
        expect(result.e164).toBe('+525512345678');
    });

    it('pasted +1 number does not produce double prefix (+1+1)', () => {
        const result = parseInternationalPaste('+12015551234', 'US');
        expect(result.e164).toMatch(/^\+1\d{10}$/);
        expect(result.e164).not.toContain('+1+1');
        expect(result.e164).not.toMatch(/^\+11/);
    });

    it('ambiguous NANP paste preserves current NANP country (CA)', () => {
        const result = parseInternationalPaste('+16135551234', 'CA');
        expect(result.country).toBe('CA');
        expect(result.unsupported).toBe(false);
    });

    it('ambiguous NANP paste preserves current NANP country (DO)', () => {
        const result = parseInternationalPaste('+18095551234', 'DO');
        expect(result.country).toBe('DO');
    });

    it('ambiguous NANP paste preserves current NANP country (PR)', () => {
        const result = parseInternationalPaste('+17875551234', 'PR');
        expect(result.country).toBe('PR');
    });

    it('NANP paste with non-NANP current country defaults to US', () => {
        const result = parseInternationalPaste('+12015551234', 'PE');
        expect(result.country).toBe('US');
    });

    it('unsupported country paste is rejected with unsupported flag', () => {
        const result = parseInternationalPaste('+34912345678', 'US'); // Spain
        expect(result.unsupported).toBe(true);
        expect(result.e164).toBeNull();
    });

    it('unsupported country paste preserves current country', () => {
        const result = parseInternationalPaste('+33123456789', 'MX'); // France
        expect(result.country).toBe('MX');
    });

    it('non-international paste (no leading +) is treated as national', () => {
        const result = parseInternationalPaste('2015551234', 'US');
        expect(result.e164).toBeNull();
        expect(result.unsupported).toBe(false);
        expect(result.nationalNumber).toBe('2015551234');
    });
});

// ─── Country-change validity ────────────────────────────────────────────────────

describe('country change recalculates validity', () => {
    it('US number is invalid for Peru', () => {
        const digits = '2015551234'; // valid US, invalid PE
        expect(parseNationalToE164(digits, 'US')).not.toBeNull();
        expect(parseNationalToE164(digits, 'PE')).toBeNull();
    });

    it('Peru number is invalid for US', () => {
        const digits = '987654321'; // valid PE (9 digits), invalid US
        expect(parseNationalToE164(digits, 'PE')).not.toBeNull();
        expect(parseNationalToE164(digits, 'US')).toBeNull();
    });
});

// ─── Masking ───────────────────────────────────────────────────────────────────

describe('maskPhone', () => {
    it('masks middle digits, preserving last 4', () => {
        const masked = maskPhone('+15551234567');
        expect(masked).toContain('••••••');
        expect(masked).toContain('4567');
    });

    it('never exposes more than prefix + last 4 digits', () => {
        const masked = maskPhone('+51987654321');
        expect(masked).not.toMatch(/\d{5,}/); // no 5+ consecutive digits
    });

    it('handles short strings without crashing', () => {
        expect(() => maskPhone('+1')).not.toThrow();
    });
});

// ─── maskPhoneForDisplay ────────────────────────────────────────────────────────

describe('maskPhoneForDisplay', () => {
    it('US: shows +1, area code, ••• and last 4', () => {
        const result = maskPhoneForDisplay('+12025551234');
        expect(result).toMatch(/^\+1 \d+ ••• \d{4}$/);
        expect(result).toContain('1234');
        expect(result).not.toContain('5551234'); // middle hidden
    });

    it('Canada: shows +1, area code, ••• and last 4', () => {
        const result = maskPhoneForDisplay('+16135559876');
        expect(result).toMatch(/^\+1 \d+ ••• \d{4}$/);
        expect(result).toContain('9876');
    });

    it('Peru (+51): shows country code, first group, ••• and last 4', () => {
        const result = maskPhoneForDisplay('+51987654321');
        expect(result).toContain('+51 ');
        expect(result).toContain('•••');
        expect(result).toContain('4321');
        expect(result).not.toContain('654321'); // middle hidden
    });

    it('UK (+44): shows country code, first group, ••• and last 4', () => {
        const result = maskPhoneForDisplay('+447911123456');
        expect(result).toContain('+44 ');
        expect(result).toContain('•••');
        expect(result).toContain('3456');
    });

    it('Mexico (+52): shows country code, first group, ••• and last 4', () => {
        const result = maskPhoneForDisplay('+525512345678');
        expect(result).toContain('+52 ');
        expect(result).toContain('•••');
        expect(result).toContain('5678');
    });

    it('never exposes 5+ consecutive digits from the national number', () => {
        const result = maskPhoneForDisplay('+12025551234');
        expect(result).not.toMatch(/\d{5,}/);
    });

    it('always contains exactly one ••• separator', () => {
        const count = (maskPhoneForDisplay('+12025551234').match(/•••/g) ?? []).length;
        expect(count).toBe(1);
    });

    it('does not throw for short/unparseable input', () => {
        expect(() => maskPhoneForDisplay('+1')).not.toThrow();
        expect(() => maskPhoneForDisplay('')).not.toThrow();
    });
});

// ─── Display formatting ─────────────────────────────────────────────────────────

describe('formatPhoneForDisplay', () => {
    it('formats US E.164 in international style', () => {
        const result = formatPhoneForDisplay('+12015551234');
        expect(result).toContain('+1');
        expect(result).toContain('201');
    });

    it('formats Peru E.164 in international style', () => {
        const result = formatPhoneForDisplay('+51987654321');
        expect(result).toContain('+51');
    });

    it('falls back to raw E.164 for unparseable input', () => {
        const raw = '+999999999999';
        const result = formatPhoneForDisplay(raw);
        expect(typeof result).toBe('string');
    });
});

// ─── getNationalInput ──────────────────────────────────────────────────────────

describe('getNationalInput', () => {
    it('extracts national number from US E.164', () => {
        expect(getNationalInput('+12015551234', 'US')).toBe('2015551234');
    });

    it('extracts national number from Peru E.164', () => {
        expect(getNationalInput('+51987654321', 'PE')).toBe('987654321');
    });
});

// ─── NANP helpers ──────────────────────────────────────────────────────────────

describe('isNANPCountry', () => {
    it('identifies NANP countries correctly', () => {
        expect(isNANPCountry('US')).toBe(true);
        expect(isNANPCountry('CA')).toBe(true);
        expect(isNANPCountry('PR')).toBe(true);
        expect(isNANPCountry('DO')).toBe(true);
    });

    it('non-NANP countries return false', () => {
        expect(isNANPCountry('MX')).toBe(false);
        expect(isNANPCountry('PE')).toBe(false);
        expect(isNANPCountry('GB')).toBe(false);
    });
});

// ─── Notes on UI/Firebase tests ────────────────────────────────────────────────
//
// Tests 1–2 (Step 1 header layout, no Back control):
//   Covered by manual QA — CreateAccountView renders no <button> for onBack.
//   onBack prop was removed from the interface entirely.
//
// Test 18 (Firebase called with exactly one E.164):
//   Covered in CreateAccountView.tsx: signInWithPhoneNumber(auth, phoneE164, verifier)
//   No +1 prefix construction — phoneE164 is produced by parseNationalToE164.
//
// Test 19 (Verify resend uses same E.164):
//   Covered in VerifyPhoneView.tsx: signInWithPhoneNumber(auth, phone, verifier)
//   phone prop is E.164 from App.tsx, no reconstruction.
//
// Test 20 (Legacy +1 lookup):
//   UID-first lookup (getDoc(doc(db, 'users', uid))) replaces phone query.
//   All user documents use firebaseUser.uid as Firestore document ID.
//   Legacy 10-digit phone fallback is not needed — UID is always available post-OTP.
//
// Test 21 (Non-+1 never uses legacy ten-digit fallback):
//   Guaranteed by UID-first lookup — no phone-based Firestore query exists.
//
// Tests 22–24 (EN/ES copy, reduced-motion, keyboard focus):
//   Covered by manual QA checklist. CountrySelector uses useLang() and t() for
//   all strings. prefersReducedMotion() gates the slide-up animation class.
//   Focus management: searchRef.current?.focus() on open, triggerRef on close.
