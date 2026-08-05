import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { timestampToMillis } from '../../utils/pingLifecycle';

// Loosely typed on purpose: @firebase/rules-unit-testing's RulesTestContext
// .firestore() is declared against the older compat SDK's Firestore type,
// which doesn't structurally match the modular SDK's Firestore even though
// both are valid runtime arguments to doc()/runTransaction(). Production
// code passes the real modular `db` from firebase.ts; tests pass the
// emulator's context Firestore — both work at runtime.
type Firestore = any;

export type CancelClaimOutcome = 'cancelled' | 'already_resolved' | 'stale_claim';

export interface CancelClaimParams {
    spotId: string;
    claimantId: string;
    finderId: string | null;
    /** claimStartedAt millis captured client-side at click time, or null if unknown. */
    fingerprint: number | null;
    message: string;
}

/**
 * Atomically cancels a claimant's claim on a Ping.
 *
 * Firestore transactions require every tx.get() to run before the first
 * tx.update()/tx.set()/tx.delete() — violating that order throws "Firestore
 * transactions require all reads to be executed before all writes." at
 * commit time. This function performs exactly one transactional read (the
 * spot) before any write, which trivially satisfies that ordering.
 *
 * Deliberately does NOT also read the deterministic cancellation-notification
 * doc to check whether it already exists: spotNotifications reads are
 * owner-only (`resource.data.targetUserId == request.auth.uid`), so the
 * claimant has no read access to a notification addressed to the Ping
 * owner — attempting that read throws permission-denied. Idempotency is
 * instead derived entirely from the spot's own state:
 *
 *   - The notification is only ever written in the same atomic commit as
 *     the claim-field clear, by this exact function, keyed on
 *     (spotId, claimStartedAt). No other code path writes that id.
 *   - Once a claim's fields are cleared, `claimMatches` below is false for
 *     any later call with the same fingerprint — so a lost-response retry
 *     always resolves to `already_resolved` before it would ever attempt to
 *     write again.
 *   - Therefore "claim still active AND its notification already exists"
 *     cannot arise from this function's own operation, and nothing else in
 *     the codebase writes this id — so it isn't defended against here.
 */
export async function cancelClaimTransaction(
    db: Firestore,
    { spotId, claimantId, finderId, fingerprint, message }: CancelClaimParams
): Promise<CancelClaimOutcome> {
    const spotRef = doc(db, 'spots', spotId);
    const needsNotification = !!finderId && finderId !== claimantId;

    try {
        return await runTransaction(db, async (tx) => {
            // Stage B — the only transactional read, before any write.
            const freshSpotSnap = await tx.get(spotRef);

            // Stage C — validate, then write. No tx.get() below this line.
            if (!freshSpotSnap.exists()) return 'already_resolved';
            const spot = freshSpotSnap.data() as Record<string, any>;

            const currentFingerprint = timestampToMillis(spot.claimStartedAt) || null;
            const claimMatches = spot.interestedUserId === claimantId
                && (fingerprint === null || currentFingerprint === fingerprint);

            if (!claimMatches) {
                // Already resolved (by the scheduler, the owner, or an earlier run
                // of this exact call) or replaced by a newer claim — either way
                // there is nothing to release and nothing to notify.
                const releasedByOther = spot.interestedUserId == null;
                return releasedByOther ? 'already_resolved' : 'stale_claim';
            }

            const clearFields = {
                claimState: null,
                ownerLeavingNow: null,
                ownerLeavingNowAt: null,
                interestedUserId: null,
                interestedUserName: null,
                interestedUserVehicleColor: null,
                interestedUserVehicleType: null,
                interestedUserVehicleBrand: null,
                interestedUserTitle: null,
                etaMinutes: null,
                interestExpiresAt: null,
                claimReminderAt: null,
                claimReminderSentAt: null,
                claimAutoReleaseAt: null,
                claimAutoReleasedAt: null,
                claimStartedAt: null,
            };
            const expired = spot.expiresAt && spot.expiresAt.toMillis() <= Date.now();
            tx.update(spotRef, expired ? clearFields : { ...clearFields, status: 'available' });

            if (needsNotification) {
                const notifRef = doc(db, 'spotNotifications', `claimer_cancelled_${spotId}_${fingerprint ?? 'x'}`);
                tx.set(notifRef, {
                    spotId,
                    senderId: claimantId,
                    targetUserId: finderId,
                    type: 'claimer_cancelled',
                    message,
                    createdAt: Timestamp.now(),
                });
            }

            return 'cancelled';
        });
    } catch (e: any) {
        // A write staged against a stale-but-still-claimMatches read can lose a
        // race to a concurrent commit (a second tab, or a second in-flight
        // attempt landing between our read and write). Firestore evaluates the
        // write's Rules against the now-current server document, which no
        // longer satisfies isClaimer()/status — a clean permission denial, not
        // a bug. That always means someone else already resolved this exact
        // claim, so it's safe (and correct) to report it that way rather than
        // surface a scary error for a benign race.
        if (e?.code === 'permission-denied') return 'already_resolved';
        throw e;
    }
}
