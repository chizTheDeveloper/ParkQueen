/**
 * Extracted verbatim from useSpotData.ts's free-spots onSnapshot callback so
 * it can be unit-tested directly (the hook itself can't be imported in tests
 * — it transitively pulls in mapbox-gl via ./utils). No behavior change.
 */
export function filterVisibleSpots(
    docs: Array<{ id: string; status: string; expiresAt?: { toMillis?: () => number }; finderId?: string; interestedUserId?: string | null;[key: string]: any }>,
    userId: string | undefined,
    blockedUsers: string[] | undefined,
    now: number,
): Array<Record<string, any>> {
    return docs
        .filter(s => (s.expiresAt?.toMillis?.() ?? 0) > now
            && s.status !== 'occupied'
            && (s.status !== 'interested' || s.finderId === userId || s.interestedUserId === userId))
        .filter(s => !(blockedUsers || []).includes(s.finderId as string));
}
