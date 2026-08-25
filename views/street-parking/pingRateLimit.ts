export interface PingRateLimitResult {
    limited: boolean;
    minutesLeft?: number;
}

interface RateLimitDocLike {
    data: () => { reportedAt?: any };
}

function reportedAtMillis(data: { reportedAt?: any }): number {
    return data.reportedAt?.toMillis
        ? data.reportedAt.toMillis()
        : new Date(data.reportedAt).getTime();
}

/**
 * Decides whether a new ping should be rate-limited, given the caller's
 * most-recent spot docs (already ordered newest-first and capped by the
 * query itself) and the current time. Preserves the exact 5-per-hour
 * threshold semantics previously inlined in StreetParkingView.tsx.
 */
export function checkPingRateLimit(docs: RateLimitDocLike[], nowMs: number): PingRateLimitResult {
    const oneHourAgo = nowMs - 60 * 60 * 1000;
    const recentSpots = docs.filter(d => reportedAtMillis(d.data()) >= oneHourAgo);

    if (recentSpots.length >= 5) {
        const oldestMs = Math.min(...recentSpots.map(d => reportedAtMillis(d.data())));
        const minutesLeft = Math.ceil((oldestMs + 60 * 60 * 1000 - nowMs) / 60000);
        return { limited: true, minutesLeft };
    }

    return { limited: false };
}
