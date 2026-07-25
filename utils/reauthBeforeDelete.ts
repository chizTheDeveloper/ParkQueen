'use strict';

/**
 * Pure helpers for the phone OTP reauthentication step before account deletion.
 *
 * Keeping these as standalone functions (not inlined in App.tsx) means the
 * security-critical invariants can be unit-tested without a DOM or Firebase mock.
 */

// ITU-T 1-digit country codes (NANP +1, Russia/Kazakhstan +7)
const CC1 = new Set(['1', '7']);
// ITU-T 2-digit country codes (major assignments; everything else is 3 digits)
const CC2 = new Set([
    '20', '27',
    '30', '31', '32', '33', '34', '36', '39',
    '40', '41', '43', '44', '45', '46', '47', '48', '49',
    '51', '52', '53', '54', '55', '56', '57', '58',
    '60', '61', '62', '63', '64', '65', '66',
    '81', '82', '84', '86',
    '90', '91', '92', '93', '94', '95', '98',
]);

/**
 * Mask a phone number for display. Shows only the country-code prefix and last
 * four digits; the rest is replaced with bullets.
 *
 * "+15555551234"   → "+1 ••• ••• 1234"
 * "+5198765432"    → "+51 ••• ••• 5432"
 * "+447911123456"  → "+44 ••• ••• 3456"
 */
export function maskPhoneNumber(phone: string): string {
    if (!phone || phone.length < 4) return '•••';
    const last4 = phone.slice(-4);
    const digits = phone.slice(1); // strip leading +
    let ccLen = 3; // default to 3-digit CC
    if (CC1.has(digits[0])) ccLen = 1;
    else if (CC2.has(digits.slice(0, 2))) ccLen = 2;
    const cc = phone.slice(0, 1 + ccLen); // include the +
    return `${cc} ••• ••• ${last4}`;
}

/**
 * Assert that the currently signed-in UID equals the UID captured at the start
 * of the deletion flow.
 *
 * A mismatch means a different account signed in during the reauth OTP step
 * (account-switching attack). The caller must abort deletion immediately.
 *
 * @throws {Error} with code 'auth/account-switched' when UIDs differ or
 *   currentUid is absent.
 */
export function verifyUidUnchanged(
    currentUid: string | undefined | null,
    originalUid: string,
): void {
    if (!currentUid || currentUid !== originalUid) {
        const err = new Error(
            `Account UID changed during reauthentication (expected ${originalUid.slice(0, 4)}***, got ${(currentUid ?? 'none').slice(0, 4)}***)`,
        );
        (err as any).code = 'auth/account-switched';
        throw err;
    }
}
