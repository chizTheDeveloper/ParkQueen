import { doc, getDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { isHandoffFailureReason, spotFeedbackDocId } from '../../utils/spotFeedback';

type Firestore = any;

export type TerminalHandoffOutcome = 'success' | 'failed';

export interface CompleteTerminalHandoffParams {
  spotId: string;
  driverId: string;
  driverName: string;
  finderId: string;
  address: string;
  outcome: TerminalHandoffOutcome;
  failureReason: string | null;
}

export type TerminalHandoffCompletion = 'created' | 'already_completed';

function sameTerminalFeedback(
  existing: Record<string, any>,
  intended: Record<string, any>,
): boolean {
  const sameIdentityAndOutcome = existing.spotId === intended.spotId
    && existing.userId === intended.userId
    && existing.finderId === intended.finderId
    && existing.outcome === intended.outcome
    && existing.address === intended.address;

  if (!sameIdentityAndOutcome) return false;
  if ((existing.failureReason ?? null) === intended.failureReason) return true;

  // Pre-PR #90 clients could commit failed feedback with a null reason before
  // the forbidden follow-up update. Preserve immutability and let that already-
  // terminal legacy flow close instead of trapping the user forever. New failed
  // feedback cannot enter this shape after the accompanying Rules change.
  return intended.outcome === 'failed' && existing.failureReason == null;
}

/**
 * Atomically creates the immutable terminal feedback and, for success, the
 * finder notification. The deterministic feedback id is also the retry key.
 */
export async function completeTerminalHandoff(
  db: Firestore,
  params: CompleteTerminalHandoffParams,
): Promise<TerminalHandoffCompletion> {
  if (params.outcome === 'failed' && !isHandoffFailureReason(params.failureReason)) {
    throw new Error('Invalid handoff failure reason');
  }
  if (params.outcome === 'success' && params.failureReason !== null) {
    throw new Error('Successful handoff cannot include a failure reason');
  }

  const feedbackId = spotFeedbackDocId(params.spotId, params.driverId);
  const spotRef = doc(db, 'spots', params.spotId);
  const feedbackRef = doc(db, 'spotFeedback', feedbackId);
  const notificationRef = doc(db, 'spotNotifications', `handoff_success_${feedbackId}`);
  const createdAt = Timestamp.now();
  const feedback = {
    spotId: params.spotId,
    userId: params.driverId,
    finderId: params.finderId,
    outcome: params.outcome,
    failureReason: params.failureReason,
    address: params.address,
    createdAt,
  };

  try {
    await runTransaction(db, async (tx) => {
      const spotSnap = await tx.get(spotRef);
      if (!spotSnap.exists()) throw new Error('Handoff spot no longer exists');
      const spot = spotSnap.data() as Record<string, any>;
      if (spot.status !== 'occupied'
        || spot.finderId !== params.finderId
        || spot.interestedUserId !== params.driverId) {
        throw new Error('Handoff participants or terminal state changed');
      }

      tx.set(feedbackRef, feedback);
      if (params.outcome === 'success') {
        tx.set(notificationRef, {
          spotId: params.spotId,
          senderId: params.driverId,
          targetUserId: params.finderId,
          type: 'handoff_success',
          message: `${params.driverName || 'Someone'} parked in your spot — +2 Crowns earned!`,
          createdAt,
        });
      }
    });
    return 'created';
  } catch (error: any) {
    if (error?.code !== 'permission-denied') throw error;

    let existing;
    try {
      existing = await getDoc(feedbackRef);
    } catch {
      throw error;
    }
    if (existing.exists() && sameTerminalFeedback(existing.data(), feedback)) {
      return 'already_completed';
    }
    throw error;
  }
}
