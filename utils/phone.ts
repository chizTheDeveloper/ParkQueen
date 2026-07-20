import { parsePhoneNumber } from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js/min';

export type { CountryCode };

export interface AllowedCountry {
    code: CountryCode;
    nameEn: string;
    nameEs: string;
    dialCode: string;
    flag: string;
}

// Full target list — all countries we intend to support.
// Used internally for paste parsing regardless of selector visibility.
const ALL_COUNTRIES: AllowedCountry[] = [
    { code: 'US', nameEn: 'United States',      nameEs: 'Estados Unidos',       dialCode: '+1',  flag: '🇺🇸' },
    { code: 'CA', nameEn: 'Canada',             nameEs: 'Canadá',               dialCode: '+1',  flag: '🇨🇦' },
    { code: 'PR', nameEn: 'Puerto Rico',        nameEs: 'Puerto Rico',          dialCode: '+1',  flag: '🇵🇷' },
    { code: 'DO', nameEn: 'Dominican Republic', nameEs: 'República Dominicana', dialCode: '+1',  flag: '🇩🇴' },
    { code: 'MX', nameEn: 'Mexico',             nameEs: 'México',               dialCode: '+52', flag: '🇲🇽' },
    { code: 'PE', nameEn: 'Peru',               nameEs: 'Perú',                 dialCode: '+51', flag: '🇵🇪' },
    { code: 'GB', nameEn: 'United Kingdom',     nameEs: 'Reino Unido',          dialCode: '+44', flag: '🇬🇧' },
];

// Countries visible in the selector and accepted at submission.
// To add a country: verify it is enabled in Firebase Console →
// Authentication → Settings → Phone sign-in → Allowed countries,
// then add its code here.
// ponytail: US-only until Firebase SMS regions are verified for the other six.
const FIREBASE_LIVE_COUNTRIES = new Set<string>(['US', 'CA', 'PR', 'DO', 'MX', 'PE', 'GB']);

export const ALLOWED_COUNTRIES: AllowedCountry[] = ALL_COUNTRIES.filter(c =>
    FIREBASE_LIVE_COUNTRIES.has(c.code)
);

// Paste parsing checks the full target list so unsupported-country messages
// are accurate even before a country is live in the selector.
const ALL_COUNTRY_CODE_SET = new Set<string>(ALL_COUNTRIES.map(c => c.code));
const LIVE_CODE_SET = new Set<string>(ALLOWED_COUNTRIES.map(c => c.code));
const NANP_CODE_SET = new Set<string>(['US', 'CA', 'PR', 'DO']);

/** True if the country is in the full target list (used for paste validation). */
export function isAllowedCountry(code: string): boolean {
    return ALL_COUNTRY_CODE_SET.has(code);
}

/** True if the country is currently live in the selector. */
export function isLiveCountry(code: string): boolean {
    return LIVE_CODE_SET.has(code);
}

export function isNANPCountry(code: string): boolean {
    return NANP_CODE_SET.has(code);
}

/** Parse national-number input with a selected country → E.164, or null if invalid. */
export function parseNationalToE164(raw: string, country: CountryCode): string | null {
    if (!raw) return null;
    try {
        const phone = parsePhoneNumber(raw, country);
        return phone.isValid() ? phone.format('E.164') : null;
    } catch {
        return null;
    }
}

export interface PasteResult {
    e164: string | null;
    country: CountryCode;
    nationalNumber: string;
    unsupported: boolean;
}

/**
 * Parse an international paste (starts with +).
 * NANP ambiguity: +1 numbers preserve the currently-selected NANP country.
 * Non-allowlist countries return unsupported: true with e164: null.
 */
export function parseInternationalPaste(raw: string, currentCountry: CountryCode): PasteResult {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('+')) {
        return { e164: null, country: currentCountry, nationalNumber: raw.replace(/\D/g, ''), unsupported: false };
    }
    try {
        const phone = parsePhoneNumber(trimmed);
        const national = phone.nationalNumber as string;

        // NANP (+1): preserve the user's current NANP country selection
        if (phone.countryCallingCode === '1') {
            const effective: CountryCode = isNANPCountry(currentCountry) ? currentCountry : 'US';
            if (national.length === 10) {
                return { e164: `+1${national}`, country: effective, nationalNumber: national, unsupported: false };
            }
            return { e164: null, country: currentCountry, nationalNumber: national, unsupported: false };
        }

        // Non-NANP: resolve country from calling code against our allowlist.
        // libphonenumber-js/min may not set phone.country reliably for all
        // international numbers, so we match by dial code instead.
        const dialCode = `+${phone.countryCallingCode}`;
        // Check against the full target list so paste correctly identifies non-live countries too
        const match = ALL_COUNTRIES.find(c => c.dialCode === dialCode && !isNANPCountry(c.code));
        if (!match) {
            return { e164: null, country: currentCountry, nationalNumber: raw, unsupported: true };
        }

        // Validate the national number for the resolved country
        const resolvedE164 = parseNationalToE164(national, match.code);
        if (!resolvedE164) {
            return { e164: null, country: currentCountry, nationalNumber: national, unsupported: false };
        }

        return { e164: resolvedE164, country: match.code, nationalNumber: national, unsupported: false };
    } catch {
        return { e164: null, country: currentCountry, nationalNumber: raw, unsupported: false };
    }
}

/** Format E.164 for international display, e.g. "+51 987 654 321" */
export function formatPhoneForDisplay(e164: string): string {
    try {
        return parsePhoneNumber(e164).formatInternational();
    } catch {
        return e164;
    }
}

/** Extract national number digits from E.164 given a known country. */
export function getNationalInput(e164: string, country: CountryCode): string {
    try {
        return parsePhoneNumber(e164, country).nationalNumber as string;
    } catch {
        return '';
    }
}

/** Mask a phone number for safe logging: +51••••••4321 */
export function maskPhone(e164: string): string {
    if (e164.length <= 6) return '••••••';
    return `${e164.slice(0, 3)}••••••${e164.slice(-4)}`;
}

/**
 * Mask a phone for display, showing country code + first group + ••• + last 4.
 * Example: +16135551234 → "+1 613 ••• 1234", +51987654321 → "+51 987 ••• 4321"
 */
export function maskPhoneForDisplay(e164: string): string {
    let formatted: string;
    try {
        formatted = parsePhoneNumber(e164).formatInternational();
    } catch {
        if (e164.length <= 6) return '••••••';
        return `${e164.slice(0, 3)} ••• ${e164.slice(-4)}`;
    }
    const parts = formatted.split(' ');
    if (parts.length < 2) return formatted;
    return `${parts[0]} ${parts[1]} ••• ${e164.slice(-4)}`;
}
