export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
// Must start with letter; letters, digits, underscores only. Mirrors claimUsername CF regex.
export const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

/**
 * Format-only validation — mirrors the claimUsername Cloud Function rules exactly.
 * Returns the i18n key for the first violation, or null if the value is structurally valid.
 * Moderation (profanity, impersonation) is a separate shared check via moderateUsername().
 *
 * Backend reference: functions/index.js claimUsername, validated after .trim()
 */
export function validateUsername(val: string): string | null {
    if (val.length < USERNAME_MIN) return 'edit_profile.username_min_length';
    if (val.length > USERNAME_MAX) return 'edit_profile.username_max_length';
    if (!USERNAME_REGEX.test(val)) return 'edit_profile.username_invalid_chars';
    if (/__/.test(val)) return 'edit_profile.username_no_double_underscores';
    return null;
}

/**
 * Returns true when a Firestore response belongs to an older request and should be discarded.
 * Use with a monotonically-incrementing generation counter stored in a ref.
 */
export function isStaleResponse(currentGen: number, responseGen: number): boolean {
    return responseGen !== currentGen;
}

/**
 * Extracts the days-remaining integer from the claimUsername CF failed-precondition message.
 * Returns null if the message does not contain a recognizable day count.
 * Used to map the raw English CF message to a localized i18n string.
 *
 * Example input: "You can change your username again in 27 days."
 */
export function parseCooldownDays(cfMessage: string): number | null {
    const match = cfMessage.match(/\b(\d+)\s+day/i);
    return match ? parseInt(match[1], 10) : null;
}
