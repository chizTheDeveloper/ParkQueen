/**
 * Derives display initials for the avatar placeholder.
 *
 * Fallback order:
 *   1. username (if not a generated user_XXXXX handle) → first character
 *   2. fullName → first initial of first and last word
 *   3. null → caller shows a generic icon
 */
export function getInitials(username?: string, fullName?: string): string | null {
    if (username && !username.startsWith('user_')) {
        return username[0].toUpperCase();
    }
    if (fullName) {
        const parts = fullName.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        if (parts[0]) return parts[0][0].toUpperCase();
    }
    return null;
}
