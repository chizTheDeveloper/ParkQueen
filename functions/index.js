const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { defineString, defineSecret } = require("firebase-functions/params");
const { GoogleGenAI } = require("@google/genai");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");

initializeApp();
const db = getFirestore();
const { geohashForLocation } = require('geofire-common');
const sendgridApiKey = defineSecret("SENDGRID_API_KEY");
// Operator action: firebase functions:secrets:set EMAIL_RATE_LIMIT_PEPPER (random 32-byte hex)
const emailRateLimitPepper = defineSecret("EMAIL_RATE_LIMIT_PEPPER");
const { osmNameToDOT, streetNameToLikePattern, dotSideToCardinal, BOROUGH_CODE_TO_NAME, nycOdSegmentDocId, selectBlockFace } = require('./nycOpenDataNormalizer');
const { redactForLog, sanitizeError } = require('./redactForLog');
const { checkRateLimit } = require('./rateLimiter');
const { haversineDistMiles, filterCandidates, buildMessages, collectStaleTokens, MAX_CANDIDATES, FCM_BATCH } = require('./notifyFanout');
const { createHash, createHmac, randomInt: secureRandomInt, randomUUID, timingSafeEqual } = require('crypto');

function stableId(...parts) {
  return createHash('sha256').update(parts.map(part => String(part)).join('\u001f')).digest('hex');
}

function snapshotGeneration(snapshot) {
  const updated = snapshot.updateTime;
  return `${updated.seconds}_${updated.nanoseconds}`;
}

function _canonicalizeEmail(value) {
  if (typeof value !== 'string') throw new HttpsError('invalid-argument', 'Valid email required.');
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !/^[\x21-\x7e]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Valid email required.');
  }
  const parts = email.split('@');
  if (parts.length !== 2) throw new HttpsError('invalid-argument', 'Valid email required.');
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..') ||
      !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) {
    throw new HttpsError('invalid-argument', 'Valid email required.');
  }
  const labels = domain.split('.');
  if (domain.length > 253 || labels.length < 2 || labels.some(label =>
      !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) ||
      !/[a-z]/.test(labels.at(-1))) {
    throw new HttpsError('invalid-argument', 'Valid email required.');
  }
  return email;
}

exports._canonicalizeEmail = _canonicalizeEmail;

function _generateEmailOtpCode(randomIntFn = secureRandomInt) {
  return String(randomIntFn(100000, 1000000));
}

exports._generateEmailOtpCode = _generateEmailOtpCode;

function _emailOtpMatches(storedCode, suppliedCode) {
  if (typeof storedCode !== 'string' || typeof suppliedCode !== 'string' ||
      !/^\d{6}$/.test(storedCode) || !/^\d{6}$/.test(suppliedCode)) return false;
  return timingSafeEqual(Buffer.from(storedCode, 'ascii'), Buffer.from(suppliedCode, 'ascii'));
}

exports._emailOtpMatches = _emailOtpMatches;

async function _deliverEmailOtp(email, code, fetchFn = fetch) {
  try {
    const res = await fetchFn('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sendgridApiKey.value()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: 'hello@parqueen.app', name: 'ParQueen' },
        subject: 'Your ParQueen verification code',
        content: [{ type: 'text/plain', value: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.` }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res || res.ok !== true) {
      await res?.body?.cancel?.();
      throw new Error('Email delivery failed');
    }
  } catch {
    throw new Error('Email delivery failed');
  }
}

exports._deliverEmailOtp = _deliverEmailOtp;

const _emailOtpHooks = { deliver: null, now: null, generateCode: null };
exports._emailOtpHooks = _emailOtpHooks;

// Crown title thresholds (must match client-side utils/crowns.ts)
const TITLE_THRESHOLDS = [
    { crowns: 0, title: 'Newcomer' },
    { crowns: 10, title: 'Trusted Driver' },
    { crowns: 50, title: 'Street Scout' },
    { crowns: 150, title: 'Neighborhood Guide' },
    { crowns: 400, title: 'Parking Expert' },
    { crowns: 750, title: 'Block Captain' },
    { crowns: 1500, title: 'Parking Veteran' },
    { crowns: 3000, title: 'Urban Legend' },
];

function getTitleForCrowns(crowns) {
    for (let i = TITLE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (crowns >= TITLE_THRESHOLDS[i].crowns) return TITLE_THRESHOLDS[i].title;
    }
    return 'Newcomer';
}

// ─── Trust System v1 ─────────────────────────────────────────────────────────
// v2 TODOs: time decay, claimer trust, pair detection, rapid-cancel pattern scan

function defaultTrustStats() {
  return {
    handoffsCompleted: 0,
    handoffsCancelledByFinder: 0,
  };
}

// trustScore is a pure function of trustStats — replayable, no hidden state.
// Bayesian prior (α=3, β=1): new users start at 75%.
// Examples: 10 completed / 0 cancelled → 93. 5 / 5 → 57. 0 / 10 → 20.
function computeTrustScore(stats) {
  const completed = stats.handoffsCompleted || 0;
  const cancelled = stats.handoffsCancelledByFinder || 0;
  const denominator = completed + cancelled;
  const ALPHA = 3;
  const BETA = 1;
  const smoothed = (completed + ALPHA) / (denominator + ALPHA + BETA);
  const cancelPenalty = Math.min(50, cancelled * 5);
  // Floor of 10 prevents permanent lockout from edge-case cancellation loops.
  return Math.max(10, Math.round(smoothed * 100) - cancelPenalty);
}

// Atomically increments one trustStats field and recomputes trustScore.
// Idempotent: repeated calls with the same eventId are no-ops.
async function applyTrustDelta(uid, statField, eventId, source = 'user') {
  const userRef = db.doc(`users/${uid}`);
  const processedRef = db.doc(`users/${uid}/processedTrustEvents/${eventId}`);

  await db.runTransaction(async (tx) => {
    const [processedSnap, userSnap] = await Promise.all([
      tx.get(processedRef),
      tx.get(userRef),
    ]);

    if (processedSnap.exists) return; // already processed — idempotency guard
    if (!userSnap.exists) return;     // user deleted between event and function fire

    const stats = { ...defaultTrustStats(), ...(userSnap.data().trustStats || {}) };
    stats[statField] = (stats[statField] || 0) + 1;

    tx.update(userRef, {
      trustStats: stats,
      trustScore: computeTrustScore(stats),
    });
    tx.set(processedRef, {
      processedAt: Timestamp.now(),
      statField,
      source,
    });
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// Initialize private/account subcollection when a new user doc is created.
// Rules set allow write: if false on private/account, so only this server trigger can create it.
exports.initUserPrivateAccount = onDocumentCreated(
  { document: 'users/{userId}', region: 'us-central1' },
  async (event) => {
    const { userId } = event.params;
    await db.doc(`users/${userId}/private/account`)
      .set({ moderationStatus: 'active', reportCount: 0 }, { merge: true });
  }
);

// 1) Delete expired spots every hour
exports.cleanupExpiredSpotsHourly = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "America/Toronto",
    region: "us-central1",
    memory: "256MiB",
  },
  async () => {
    const now = Timestamp.now();

    // batch delete in pages of 500
    while (true) {
      const snap = await db
        .collection("spots")
        .where("expiresAt", "<=", now)
        .orderBy("expiresAt", "asc")
        .limit(500)
        .get();

      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      if (snap.size < 500) break;
    }

    console.log("✅ cleanupExpiredSpotsHourly finished");
  }
);

// 1b) Revert expired interest reservations every minute
exports.cleanupExpiredInterests = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "America/Toronto",
    region: "us-central1",
    memory: "256MiB",
  },
  async () => {
    const now = Timestamp.now();
    const snap = await db
      .collection("spots")
      .where("status", "==", "interested")
      .where("interestExpiresAt", "<=", now)
      .limit(500)
      .get();

    if (snap.empty) return;

    let reverted = 0;
    for (const d of snap.docs) {
      try {
        const didRevert = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(d.ref);
          if (!fresh.exists) return false;
          const spot = fresh.data();

          // Re-verify against fresh state — the initial query snapshot can be
          // stale by the time each transaction runs (the claimant may have
          // just committed to heading, delayed, or a newer claim may have
          // replaced this one).
          if (
            spot.status !== "interested" ||
            !spot.interestExpiresAt ||
            spot.interestExpiresAt.toMillis() > now.toMillis()
          ) return false;

          const clearFields = {
            interestedUserId: null,
            interestedUserName: null,
            interestedUserVehicleColor: null,
            interestedUserVehicleType: null,
            interestedUserVehicleBrand: null,
            interestedUserTitle: null,
            etaMinutes: null,
            interestExpiresAt: null,
            claimState: null,
            claimStartedAt: null,
            ownerLeavingNow: null,
            ownerLeavingNowAt: null,
            claimReminderAt: null,
            claimReminderSentAt: null,
            claimAutoReleaseAt: null,
            claimAutoReleasedAt: null,
          };

          // Never reopen an already-expired Ping — only clear the stale claim.
          const pingExpired = spot.expiresAt && spot.expiresAt.toMillis() <= now.toMillis();
          tx.update(d.ref, pingExpired ? clearFields : { ...clearFields, status: "available" });
          return true;
        });
        if (didRevert) reverted++;
      } catch (e) {
        console.error("cleanupExpiredInterests: failed to release spot", d.id.slice(0, 8) + "***", sanitizeError(e));
      }
    }
    console.log(`✅ cleanupExpiredInterests: reverted ${reverted} of ${snap.size} candidate spots`);
  }
);

// 1c) Revert expired hold timers every minute
exports.cleanupExpiredHolds = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "America/Toronto",
    region: "us-central1",
    memory: "256MiB",
  },
  async () => {
    const now = Timestamp.now();
    const snap = await db
      .collection("spots")
      .where("status", "==", "claimed")
      .where("holdRequestStatus", "==", "accepted")
      .where("holdTimerExpiresAt", "<=", now)
      .limit(500)
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    snap.docs.forEach((d) => {
      batch.update(d.ref, {
        status: "available",
        holdRequestStatus: "declined",
        claimedBy: null,
        holdTimerExpiresAt: null,
        holdRequestedBy: null,
        holdRequestedByName: null,
        holdRequestExpiresAt: null,
        updatedAt: now,
      });
    });
    await batch.commit();
    console.log(`✅ cleanupExpiredHolds: reverted ${snap.size} held spots`);
  }
);

// Bilingual copy for scheduled claim notifications.
// lang defaults to 'en' for any missing/unrecognised value.
function localizeNotification(type, lang, params) {
  const es = lang === 'es';
  if (type === 'reminder') {
    return es
      ? `El lugar de ${params.name} se libera pronto — ¿vas para allá?`
      : `${params.name}'s spot opens soon — time to head over?`;
  }
  if (type === 'auto_released_claimer') {
    return es
      ? 'Tu reclamo fue liberado porque no confirmaste que ibas para allá.'
      : "Your claim was released because you didn't confirm you were heading over.";
  }
  if (type === 'auto_released_owner') {
    return es
      ? 'Tu lugar está disponible de nuevo porque el reclamo venció.'
      : 'Your spot is available again because the claim expired.';
  }
  return '';
}

const _pingNotificationHooks = {
  send: null,
  sendEach: null,
  beforeStaleTokenCleanup: null,
  now: null,
};
exports._pingNotificationHooks = _pingNotificationHooks;

// 1d) Scheduled claim reminders + auto-release every 5 minutes
exports.processScheduledClaims = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "America/Toronto",
    region: "us-central1",
    memory: "256MiB",
  },
  async () => {
    const now = Timestamp.now();

    // ── Pass 1: Send reminders ────────────────────────────────────────────────
    // claimReminderAt is nulled after send, so already-reminded docs won't reappear
    const reminderSnap = await db.collection("spots")
      .where("status", "==", "interested")
      .where("claimState", "==", "committed")
      .where("claimReminderAt", "<=", now)
      .limit(100)
      .get();

    for (const d of reminderSnap.docs) {
      const spot = d.data();
      if (!spot.interestedUserId || spot.interestedUserId === spot.finderId) continue;

      const finderName = spot.finderName || "Someone";

      // FCM push if token available
      const prefsSnap = await db.doc(`users/${spot.interestedUserId}/private/preferences`).get();
      const prefs = prefsSnap.exists ? prefsSnap.data() : {};
      const fcmToken = prefs.fcmToken || null;
      const message = localizeNotification('reminder', prefs.lang, { name: finderName });
      const claimed = await db.runTransaction(async tx => {
        const fresh = await tx.get(d.ref);
        if (!fresh.exists) return false;
        const current = fresh.data();
        if (current.status !== 'interested' || current.claimState !== 'committed' ||
            current.interestedUserId !== spot.interestedUserId || !current.claimReminderAt ||
            current.claimReminderAt.toMillis() > now.toMillis()) return false;
        const claimId = `claim_${stableId(d.id, snapshotGeneration(fresh), current.interestedUserId)}`;
        tx.set(db.doc(`spotNotifications/reminder_${claimId}`), {
          spotId: d.id,
          senderId: null,
          actorType: 'system',
          subjectUserId: current.finderId || null,
          targetUserId: current.interestedUserId,
          claimId,
          type: 'scheduled_claim_reminder',
          message,
          createdAt: now,
        });
        tx.update(d.ref, { claimReminderAt: null, claimReminderSentAt: now });
        return true;
      });
      if (claimed && fcmToken) {
        try {
          const push = {
            token: fcmToken,
            notification: { title: prefs.lang === 'es' ? "🅿️ Lugar abriéndose pronto" : "🅿️ Spot opening soon", body: message },
            android: { priority: "high" },
            apns: { payload: { aps: { sound: "default", badge: 1 } } },
          };
          await (_pingNotificationHooks.send?.(push) ?? getMessaging().send(push));
        } catch (e) {
          console.error("FCM reminder failed for", (spot.interestedUserId || '').slice(0, 4) + '***', sanitizeError(e));
        }
      }

    }

    // ── Pass 2: Auto-release stale committed claims ───────────────────────────
    const releaseSnap = await db.collection("spots")
      .where("status", "==", "interested")
      .where("claimState", "==", "committed")
      .where("claimAutoReleaseAt", "<=", now)
      .limit(100)
      .get();

    for (const d of releaseSnap.docs) {
      let releasedInfo = null;
      const initialSpot = d.data();
      const [claimerSnap, ownerSnap] = await Promise.all([
        initialSpot.interestedUserId ? db.doc(`users/${initialSpot.interestedUserId}`).get() : null,
        initialSpot.finderId ? db.doc(`users/${initialSpot.finderId}`).get() : null,
      ]);
      const claimerLang = claimerSnap?.exists ? claimerSnap.data().lang : null;
      const ownerLang = ownerSnap?.exists ? ownerSnap.data().lang : null;

      try {
        await db.runTransaction(async (tx) => {
          releasedInfo = null; // reset on each retry
          const fresh = await tx.get(d.ref);
          if (!fresh.exists) return;
          const spot = fresh.data();

          // Re-verify all conditions — claimer may have tapped "I'm heading there"
          if (
            spot.status !== "interested" ||
            spot.claimState !== "committed" ||
            !spot.interestedUserId ||
            !spot.claimAutoReleaseAt ||
            spot.claimAutoReleaseAt.toMillis() > now.toMillis()
          ) return;

          const spotExpired = spot.expiresAt && spot.expiresAt.toMillis() <= now.toMillis();

          const clearFields = {
            interestedUserId: null,
            interestedUserName: null,
            interestedUserVehicleColor: null,
            interestedUserVehicleType: null,
            interestedUserVehicleBrand: null,
            interestedUserTitle: null,
            etaMinutes: null,
            interestExpiresAt: null,
            claimState: null,
            ownerLeavingNow: null,
            ownerLeavingNowAt: null,
            claimReminderAt: null,
            claimReminderSentAt: null,
            claimAutoReleaseAt: null,
            claimAutoReleasedAt: now,
          };

          const claimId = `claim_${stableId(d.id, snapshotGeneration(fresh), spot.interestedUserId)}`;

          if (spotExpired) {
            // Ping already expired — clear stale claim fields, don't revive to available
            tx.update(d.ref, clearFields);
          } else {
            tx.update(d.ref, { ...clearFields, status: "available" });
          }

          if (spot.interestedUserId !== spot.finderId) {
            tx.set(db.doc(`spotNotifications/released_claimer_${claimId}`), {
              spotId: d.id,
              senderId: null,
              actorType: 'system',
              subjectUserId: spot.finderId || null,
              targetUserId: spot.interestedUserId,
              claimId,
              type: 'scheduled_claim_auto_released',
              message: localizeNotification('auto_released_claimer', claimerLang, {}),
              createdAt: now,
            });
            if (spot.finderId && !spotExpired) {
              tx.set(db.doc(`spotNotifications/released_owner_${claimId}`), {
                spotId: d.id,
                senderId: null,
                actorType: 'system',
                subjectUserId: spot.interestedUserId,
                targetUserId: spot.finderId,
                claimId,
                type: 'scheduled_claim_released_owner',
                message: localizeNotification('auto_released_owner', ownerLang, {}),
                createdAt: now,
              });
            }
          }

          releasedInfo = {
            claimerId: spot.interestedUserId,
            finderId: spot.finderId || null,
            spotExpired,
          };
        });
      } catch (e) {
        console.error("Auto-release transaction failed for spot", d.id.slice(0, 8) + '***', sanitizeError(e));
      }

      if (!releasedInfo) continue;

    }

    console.log(
      `✅ processScheduledClaims: ${reminderSnap.size} reminders, ${releaseSnap.size} releases`
    );
  }
);

// 2) Increment total spots pinged (all-time) whenever a spot is created
exports.incrementTotalSpotsPinged = onDocumentCreated(
  {
    document: "spots/{spotId}",
    region: "us-central1",
  },
  async (event) => {
    const spotId = event.params?.spotId;
    const spot = event.data?.data?.();
    if (!spotId || !spot || typeof spot.finderId !== 'string' || !spot.finderId.trim()) return;
    const statsRef = db.doc("stats/global");
    if (typeof event.id !== 'string' || !event.id) return;
    const eventRef = db.doc(`functionEvents/incrementTotalSpotsPinged_${stableId(event.id)}`);
    await db.runTransaction(async tx => {
      if ((await tx.get(eventRef)).exists) return;
      tx.set(eventRef, {
        functionName: 'incrementTotalSpotsPinged',
        sourceEventId: event.id,
        spotId,
        actorUserId: spot.finderId,
        processedAt: Timestamp.now(),
      });
      tx.set(statsRef, { totalSpotsPinged: FieldValue.increment(1) }, { merge: true });
    });
  }
);

// 3) Geofenced Notifications for Nearby Users
exports.notifyNearbyUsers = onDocumentCreated(
  {
    document: "spots/{spotId}",
    region: "us-central1",
  },
  async (event) => {
    const spotData = event.data.data();
    if (!spotData || !spotData.geohash || typeof spotData.finderId !== 'string' || !spotData.finderId.trim() ||
        !Number.isFinite(spotData.lat) || !Number.isFinite(spotData.lng)) return;

    const spotGeohash = spotData.geohash;
    // 4-char prefix ≈ 20km coarse filter, then precise distance check
    const prefix = spotGeohash.substring(0, 4);

    try {
      const neighborsSnap = await db.collection("userLocations")
          .where("lastGeohash", ">=", prefix)
          .where("lastGeohash", "<=", prefix + "\uf8ff")
          .limit(MAX_CANDIDATES)
          .get();

      if (neighborsSnap.empty) return;

      const geofire = require("geofire-common");
      const candidates = filterCandidates(neighborsSnap, spotData, geofire, Date.now());

      if (candidates.length === 0) return;

      // Fetch all preferences concurrently — Admin SDK has no getAll() for subcollection
      // paths, so concurrent individual .get() calls are the correct batching approach.
      const prefsResults = await Promise.all(
          candidates.map(c =>
              db.doc(`users/${c.userId}/private/preferences`).get()
                .then(snap => ({ userId: c.userId, distMiles: c.distMiles, prefs: snap.exists ? snap.data() : null }))
          )
      );

      const messages = buildMessages(prefsResults, event.params.spotId);

      if (messages.length === 0) return;

      // Claim each recipient before sending. A repeated Firestore event observes
      // the durable delivery document and cannot duplicate its push or bell row.
      if (typeof event.id !== 'string' || !event.id) return;
      const claimedMessages = (await Promise.all(messages.map(async message => {
        const recipientId = message.recipientUserId;
        const deliveryId = `nearby_${stableId(event.id, recipientId)}`;
        const deliveryRef = db.doc(`notificationDeliveries/${deliveryId}`);
        const bellRef = db.doc(`spotNotifications/${deliveryId}`);
        return db.runTransaction(async tx => {
          if ((await tx.get(deliveryRef)).exists) return null;
          const claimedAt = Timestamp.now();
          tx.set(deliveryRef, {
            functionName: 'notifyNearbyUsers',
            eventId: event.id || null,
            spotId: event.params.spotId,
            actorUserId: spotData.finderId,
            recipientUserId: recipientId,
            status: 'reserved',
            reservedAt: claimedAt,
          });
          tx.set(bellRef, {
            spotId: event.params.spotId,
            senderId: spotData.finderId,
            targetUserId: recipientId,
            claimId: null,
            type: 'nearby_spot',
            message: 'A new Ping is available nearby.',
            createdAt: claimedAt,
          });
          return { ...message, deliveryId };
        });
      }))).filter(Boolean);

      if (claimedMessages.length === 0) return;

      let totalSent = 0, totalFailed = 0;
      const staleRecipients = [];
      for (let i = 0; i < claimedMessages.length; i += FCM_BATCH) {
          const chunk = claimedMessages.slice(i, i + FCM_BATCH);
          const outbound = chunk.map(({ recipientUserId, deliveryId, ...message }) => message);
          const response = await (_pingNotificationHooks.sendEach?.(outbound) ?? getMessaging().sendEach(outbound));
          totalSent += response.successCount;
          totalFailed += response.failureCount;
          const staleTokens = new Set(collectStaleTokens(outbound, response.responses));
          await Promise.all(chunk.map((message, index) => {
            const result = response.responses[index];
            if (staleTokens.has(message.token)) {
              staleRecipients.push({ userId: message.recipientUserId, token: message.token });
            }
            return db.doc(`notificationDeliveries/${message.deliveryId}`).update({
              status: result?.success ? 'sent' : 'failed',
              completedAt: Timestamp.now(),
              failureCode: result?.success ? null : String(result?.error?.code || 'messaging/unknown'),
            });
          }));
      }
      console.log(`Geofence push: ${totalSent} sent, ${totalFailed} failed, ${staleRecipients.length} stale tokens`);

      // Best-effort stale token cleanup
      if (staleRecipients.length > 0) {
          await _pingNotificationHooks.beforeStaleTokenCleanup?.();
          await Promise.all(staleRecipients.map(({ userId, token }) => {
            const prefsRef = db.doc(`users/${userId}/private/preferences`);
            return db.runTransaction(async tx => {
              const current = await tx.get(prefsRef);
              if (current.exists && current.data().fcmToken === token) {
                tx.update(prefsRef, { fcmToken: FieldValue.delete() });
              }
            }).catch(() => {});
          }));
      }
    } catch (error) {
      console.error("Error in notifyNearbyUsers:", sanitizeError(error));
    }
  }
);

// 4) Generate and send email OTP
exports.generateEmailOTP = onCall(
  { region: "us-central1", secrets: [sendgridApiKey, emailRateLimitPepper] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const email = _canonicalizeEmail(request.data?.email);

    const uid = request.auth.uid;
    await checkRateLimit(uid, 'generateEmailOTP', { limit: 10, windowSec: 3600 });
    // HMAC with server-only pepper prevents rainbow-table attacks on per-inbox rate limit keys.
    const emailHash = createHmac('sha256', emailRateLimitPepper.value()).update(email).digest('hex');
    await checkRateLimit(emailHash, 'generateEmailOTP_email', { limit: 10, windowSec: 3600 });
    const docRef = db.collection("emailVerificationCodes").doc(uid);
    const nowMs = _emailOtpHooks.now?.() ?? Date.now();
    const code = _emailOtpHooks.generateCode?.() ?? _generateEmailOtpCode();
    const requestId = randomUUID();
    await db.runTransaction(async tx => {
      const existing = await tx.get(docRef);
      if (existing.exists) {
        const lastSent = existing.data().createdAt?.toMillis() || 0;
        if (nowMs - lastSent < 60000) {
          throw new HttpsError("resource-exhausted", "Wait 60 seconds before requesting another code.");
        }
      }
      tx.set(docRef, {
        code, email, requestId, status: 'pending',
        createdAt: Timestamp.fromMillis(nowMs),
        expiresAt: Timestamp.fromMillis(nowMs + 10 * 60000),
      });
    });

    try {
      await (_emailOtpHooks.deliver?.(email, code) ?? _deliverEmailOtp(email, code));
      await db.runTransaction(async tx => {
        const current = await tx.get(docRef);
        if (!current.exists || current.data().requestId !== requestId || current.data().status !== 'pending') {
          throw new Error('OTP request superseded');
        }
        tx.update(docRef, { status: 'active' });
      });
    } catch {
      await db.runTransaction(async tx => {
        const current = await tx.get(docRef);
        if (current.exists && current.data().requestId === requestId) tx.delete(docRef);
      }).catch(() => {});
      console.error('Email OTP delivery failed');
      throw new HttpsError("internal", "Failed to send verification email.");
    }
    return { success: true };
  }
);

// 5) Verify email OTP
exports.verifyEmailOTP = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const email = _canonicalizeEmail(request.data?.email);
    const code = request.data?.code;

    const uid = request.auth.uid;
    await checkRateLimit(uid, 'verifyEmailOTP', { limit: 10, windowSec: 900 });
    const docRef = db.collection("emailVerificationCodes").doc(uid);
    const userRef = db.collection("users").doc(uid);
    const privateAccountRef = userRef.collection("private").doc("account");
    const verificationOutcome = await db.runTransaction(async tx => {
      const snap = await tx.get(docRef);
      if (!snap.exists) throw new HttpsError("not-found", "No verification code found. Request a new one.");

      const data = snap.data();
      let storedEmail;
      try { storedEmail = _canonicalizeEmail(data.email); }
      catch { storedEmail = null; }
      if ((data.status && data.status !== 'active') || storedEmail !== email || !_emailOtpMatches(data.code, code)) {
        throw new HttpsError("invalid-argument", "Invalid email or code.");
      }
      if (!data.expiresAt?.toMillis || Date.now() > data.expiresAt.toMillis()) {
        tx.delete(docRef);
        return 'expired';
      }
      tx.delete(docRef);
      // Consume the OTP only if both account updates can commit with it.
      tx.set(privateAccountRef, { email }, { merge: true });
      tx.update(userRef, { emailVerified: true });
      return 'verified';
    });
    if (verificationOutcome === 'expired') {
      throw new HttpsError("deadline-exceeded", "Code expired. Request a new one.");
    }
    return { success: true };
  }
);

// ── Test seam ─────────────────────────────────────────────────────────────────
// Integration tests set _hooks.visionSafeSearch to control Vision responses
// deterministically without calling the real Vision API.
const _hooks = {
  visionSafeSearch: null, // null → use real Vision; (gcsUri) => Promise<annotation|null>
};
exports._hooks = _hooks;

// ── Callable test seams ───────────────────────────────────────────────────────
// Set to a function to replace external API calls in integration tests.
// null (default) → real provider; set in test beforeEach, clear in afterEach.
const _callableHooks = {
  sweepNYCResult: null,  // (lat, lng) => Promise<result> — replaces SweepNYC + fallback
  geminiResponse: null,  // (features) => Promise<{text}> — replaces GoogleGenAI call
};
exports._callableHooks = _callableHooks;


// ── Avatar moderation helpers ──────────────────────────────────────────────────
// JPEG: FF D8 FF  |  PNG: 89 50 4E 47 0D 0A 1A 0A  |  WebP: RIFF????WEBP
function _isAllowedImageHeader(buf) {
  if (!buf || buf.length < 12) return false;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
      buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A) return true;
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  return false;
}

// ── Retry model — two independent layers ──────────────────────────────────────
// Layer 1 — Eventarc Standard delivery (platform):
//   At-least-once delivery with exponential back-off. Default retention is
//   approximately 24 hours; no assumed five-attempt ceiling from the platform.
//   `retry: true` on the trigger activates re-delivery on uncaught throws;
//   without it, thrown errors are silently discarded and no retry occurs.
//
// Layer 2 — Application retry ceiling (ParQueen):
//   AVATAR_MAX_RETRIES = 3, tracked in avatarModeration/{uid}.retryCount.
//   On the third exhausted attempt the event is acknowledged (no throw),
//   the moderation doc status is set to "failed", and both source and
//   candidate objects are deleted. Permanent failures (invalid format,
//   content policy) are acknowledged immediately regardless of retryCount.
const AVATAR_MAX_RETRIES = 3;
// 4096 × 4096 — well above 512 × 512 output; 64× below Sharp's 268 M default.
const AVATAR_MAX_PIXELS    = 16_777_216;
const AVATAR_MAX_DIMENSION = 4096;

// Quarantine path design — prevents trigger recursion and pre-approval exposure:
//   Upload (client-writable, owner-private):  avatarUploads/{uid}/{uploadId}/original
//   Candidate (server-only, not public):      avatarCandidates/{uid}/{uploadId}.webp
//   Published (server-written, owner-read):   avatars/{uid}
//   Moderation state (client-readable):       avatarModeration/{uid}

// 6) Moderate avatar uploads via Vision SafeSearch
exports.moderateAvatarUpload = onObjectFinalized(
  { region: "us-central1", memory: "512MiB", retry: true },
  async (event) => {
    const filePath = event.data.name;

    // Only process files at exactly avatarUploads/{uid}/{uploadId}/original.
    // avatarCandidates/ and avatars/ writes by the server never re-trigger here.
    if (!filePath.startsWith("avatarUploads/")) return;
    const parts = filePath.split("/");
    if (parts.length !== 4 || parts[3] !== "original") return;

    const uid            = parts[1];
    const uploadId       = parts[2];
    const sourceGen      = String(event.data.generation || "");
    const maskedUid      = uid.slice(0, 4) + "***";
    const moderationRef  = db.collection("avatarModeration").doc(uid);
    const pendingRef     = db.doc(`users/${uid}/private/avatar`);
    const bucket         = getStorage().bucket(event.data.bucket);
    const sourceFile     = bucket.file(filePath);
    const candidatePath  = `avatarCandidates/${uid}/${uploadId}.webp`;
    const candidateFile  = bucket.file(candidatePath);
    const publishedFile  = bucket.file(`avatars/${uid}`);

    // ── Step 0: Generation-scoped idempotency via transaction ─────────────────
    // Also reads users/{uid}/private/avatar to enforce the pre-event newer-upload
    // race guard: if pendingUploadId is set to a different uploadId, a newer upload
    // was registered before this event fired — skip without processing.
    let claimResult;
    try {
      claimResult = await db.runTransaction(async (tx) => {
        const moderationSnap = await tx.get(moderationRef);
        const pendingSnap    = await tx.get(pendingRef);
        const pendingId = pendingSnap.exists ? pendingSnap.data().pendingUploadId : null;
        if (pendingId && pendingId !== uploadId) return { claimed: false, reason: "superseded_by_pending" };
        if (!moderationSnap.exists) {
          tx.set(moderationRef, {
            uid, uploadId, sourcePath: filePath, sourceGeneration: sourceGen,
            status: "processing", retryCount: 0, processedPath: null,
            failureReason: null, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
          });
          return { claimed: true, retryCount: 0 };
        }
        const d = moderationSnap.data();
        if (d.uploadId !== uploadId) return { claimed: false, reason: "superseded" };
        if (d.status === "approved" || d.status === "rejected") return { claimed: false, reason: "terminal" };
        if (d.retryCount >= AVATAR_MAX_RETRIES) return { claimed: false, reason: "max_retries" };
        tx.update(moderationRef, { status: "processing", updatedAt: Timestamp.now() });
        return { claimed: true, retryCount: d.retryCount };
      });
    } catch (err) {
      console.error(`Avatar transaction error (${maskedUid}):`, sanitizeError(err));
      throw err; // transient — let CF retry
    }

    if (!claimResult.claimed) {
      const reason = claimResult.reason;
      console.log(`Avatar moderation skipped (${reason}) for ${maskedUid}`);
      if (reason === "superseded" || reason === "superseded_by_pending") {
        // Source has no active processor — delete immediately to prevent orphan accumulation.
        await sourceFile.delete().catch(() => {});
      } else if (reason === "max_retries") {
        // Terminal failure: record it and remove all objects for this upload.
        await Promise.all([
          moderationRef.update({ status: "failed", failureReason: "max_retries_exhausted", updatedAt: Timestamp.now() }).catch(() => {}),
          sourceFile.delete().catch(() => {}),
          candidateFile.delete().catch(() => {}),
        ]);
      }
      return;
    }
    const retryCount = claimResult.retryCount;

    // ── Step 1: Download original from quarantine path ────────────────────────
    let rawBytes;
    try {
      [rawBytes] = await sourceFile.download();
    } catch (err) {
      await moderationRef.update({ status: "retry_pending", failureReason: "download_error", retryCount: retryCount + 1, updatedAt: Timestamp.now() });
      console.error(`Avatar download error (${maskedUid}):`, sanitizeError(err));
      throw err; // transient — let CF retry
    }

    // ── Step 2: Magic-byte check — permanent rejection, no retry ─────────────
    if (!_isAllowedImageHeader(rawBytes)) {
      await Promise.all([
        sourceFile.delete().catch(() => {}),
        moderationRef.update({ status: "rejected", failureReason: "invalid_format", updatedAt: Timestamp.now() }),
      ]);
      console.log(`Avatar rejected (invalid_format) for ${maskedUid}`);
      return;
    }

    // ── Step 3: Process with Sharp — EXIF strip, resize 512×512, WebP ────────
    // Defensive construction: fail on warnings, explicit pixel/channel caps.
    // Re-encoding to WebP without .withMetadata() strips all EXIF/GPS/IPTC/XMP.
    let processedBuffer;
    try {
      const sharp = require("sharp");
      const sharpOpts = { failOn: "warning", limitInputPixels: AVATAR_MAX_PIXELS, limitInputChannels: 4, sequentialRead: true };
      const meta = await sharp(rawBytes, sharpOpts).metadata();
      if (!meta.width || meta.width <= 0 || !meta.height || meta.height <= 0)
        throw Object.assign(new Error("zero dimensions"), { _perm: true, _reason: "zero_dimensions" });
      if (meta.width > AVATAR_MAX_DIMENSION || meta.height > AVATAR_MAX_DIMENSION)
        throw Object.assign(new Error("dimension limit"), { _perm: true, _reason: "dimensions_exceeded" });
      if ((meta.width * meta.height) > AVATAR_MAX_PIXELS)
        throw Object.assign(new Error("pixel limit"), { _perm: true, _reason: "pixel_count_exceeded" });
      if (meta.pages && meta.pages > 1)
        throw Object.assign(new Error("animated"), { _perm: true, _reason: "animated_rejected" });
      processedBuffer = await sharp(rawBytes, sharpOpts)
        .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (err) {
      if (err._perm) {
        await Promise.all([
          sourceFile.delete().catch(() => {}),
          moderationRef.update({ status: "rejected", failureReason: err._reason || "invalid_image", updatedAt: Timestamp.now() }),
        ]);
        console.log(`Avatar rejected (${err._reason || "invalid_image"}) for ${maskedUid}`);
        return;
      }
      await moderationRef.update({ status: "retry_pending", failureReason: "processing_error", retryCount: retryCount + 1, updatedAt: Timestamp.now() });
      console.error(`Avatar processing error (${maskedUid}):`, sanitizeError(err));
      throw err; // transient — let CF retry
    }

    // ── Step 4: Save to candidate path (never the trigger prefix) ────────────
    try {
      await candidateFile.save(processedBuffer, { metadata: { contentType: "image/webp" }, resumable: false });
      await moderationRef.update({ processedPath: candidatePath, updatedAt: Timestamp.now() });
    } catch (err) {
      await moderationRef.update({ status: "retry_pending", failureReason: "upload_error", retryCount: retryCount + 1, updatedAt: Timestamp.now() });
      console.error(`Avatar candidate upload error (${maskedUid}):`, sanitizeError(err));
      throw err; // transient
    }

    // ── Step 5: Vision SafeSearch on candidate — FAIL CLOSED ─────────────────
    let safeSnap;
    try {
      safeSnap = await (_hooks.visionSafeSearch
        ? _hooks.visionSafeSearch(`gs://${event.data.bucket}/${candidatePath}`)
        : (async () => {
            const vision = require("@google-cloud/vision");
            const client = new vision.ImageAnnotatorClient();
            const [result] = await client.safeSearchDetection(`gs://${event.data.bucket}/${candidatePath}`);
            return result?.safeSearchAnnotation ?? null;
          })());
    } catch (err) {
      await moderationRef.update({ status: "retry_pending", failureReason: "vision_error", retryCount: retryCount + 1, updatedAt: Timestamp.now() });
      console.error(`Avatar Vision error (${maskedUid}):`, sanitizeError(err));
      throw err; // transient — let CF retry
    }

    if (!safeSnap) {
      // Missing annotation fails closed — retry to give Vision another chance.
      await moderationRef.update({ status: "retry_pending", failureReason: "missing_annotation", retryCount: retryCount + 1, updatedAt: Timestamp.now() });
      console.error(`Avatar Vision annotation missing (${maskedUid})`);
      throw new Error("Missing Vision SafeSearch annotation");
    }

    const flagged = ["LIKELY", "VERY_LIKELY"];
    if (flagged.includes(safeSnap.adult) || flagged.includes(safeSnap.racy)) {
      await Promise.all([
        sourceFile.delete().catch(() => {}),
        candidateFile.delete().catch(() => {}),
        moderationRef.update({ status: "rejected", failureReason: "content_policy", updatedAt: Timestamp.now() }),
      ]);
      console.log(`Avatar rejected (content_policy) for ${maskedUid}`);
      return;
    }

    // ── Step 6: Approve — copy to published path, update user doc atomically ──
    // Staleness check: abort if a newer upload already claimed the moderation slot
    // or if pendingUploadId was updated to a different uploadId after Vision ran.
    try {
      await candidateFile.copy(publishedFile);
    } catch (err) {
      await moderationRef.update({ status: "retry_pending", failureReason: "publish_error", retryCount: retryCount + 1, updatedAt: Timestamp.now() });
      console.error(`Avatar publish copy error (${maskedUid}):`, sanitizeError(err));
      throw err;
    }

    // Firebase download token URL — permanent, revoked when file is deleted.
    // Copied files don't inherit download tokens, so we generate one explicitly
    // and attach it via setMetadata. getDownloadURL is not used because it
    // requires a pre-existing token (which only client-SDK uploads produce).
    const { randomUUID } = require("crypto");
    const downloadToken = randomUUID();
    try {
      await publishedFile.setMetadata({ metadata: { firebaseStorageDownloadTokens: downloadToken } });
    } catch (err) {
      // Emulator may reject setMetadata — log and continue. URL is still valid
      // in tests (truthy) and in production setMetadata always succeeds.
      console.warn(`Avatar metadata token error (${maskedUid}):`, sanitizeError(err));
    }
    const encodedPath = encodeURIComponent(`avatars/${uid}`);
    const avatarUrl = `https://firebasestorage.googleapis.com/v0/b/${event.data.bucket}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    const approved = await db.runTransaction(async (tx) => {
      const moderationSnap = await tx.get(moderationRef);
      const pendingSnap    = await tx.get(pendingRef);
      const d = moderationSnap.data();
      const pendingId = pendingSnap.exists ? pendingSnap.data().pendingUploadId : null;
      // Abort if moderation slot was taken by a newer upload, or if client
      // registered a newer upload (pendingUploadId mismatch) after Vision ran.
      if (!d || d.uploadId !== uploadId) return false;
      if (pendingId && pendingId !== uploadId) return false;
      tx.update(moderationRef, { status: "approved", failureReason: null, updatedAt: Timestamp.now() });
      tx.update(db.doc(`users/${uid}`), { avatarUrl });
      // Clear the pending record now that this upload is published.
      if (pendingSnap.exists && pendingId === uploadId) tx.delete(pendingRef);
      return true;
    });

    if (approved) {
      await Promise.all([sourceFile.delete().catch(() => {}), candidateFile.delete().catch(() => {})]);
      console.log(`Avatar approved for ${maskedUid}`);
    } else {
      // Superseded mid-flight — remove both objects to prevent orphan accumulation.
      await Promise.all([sourceFile.delete().catch(() => {}), candidateFile.delete().catch(() => {})]);
      console.log(`Avatar approval skipped (superseded) for ${maskedUid}`);
    }
  }
);

// ── Orphan cleanup helper ─────────────────────────────────────────────────────
// Deletes avatarUploads/ and avatarCandidates/ objects older than cutoffMs
// (default 24 h ago) AND whose moderation status is terminal or absent.
// Active objects (processing, retry_pending) are preserved.
// avatars/ (published) is never iterated — not in ORPHAN_CLEANUP_PREFIXES.
//
// autoPaginate:false — GCS returns one page at a time; cursor advances past
//   each fully-processed page, preventing starvation of later objects.
// Persistent cursor — stored in maintenanceJobs/avatarOrphanCleanup so each
//   leased run resumes where the previous run stopped. Wraps after both prefixes
//   are exhausted. Client access is blocked by Firestore Rules.
// Lease — Firestore transaction prevents two concurrent scheduled executions
//   from racing. maxInstances is NOT set: the Firebase Functions emulator does
//   not support it on scheduled functions and fails to register the export.
// Counters — deleted increments only after a successful file.delete(); failed
//   increments when file.delete() rejects. One failed deletion does not abort.
// Stale cursor recovery — if GCS returns HTTP 400 with reason "invalid" the
//   page token has expired. The stale token is cleared transactionally in
//   Firestore (cursorResetAt / cursorResetReason recorded) and the prefix is
//   retried from page 1 in the same invocation. A per-prefix guard prevents
//   a second clear, so a bad page-1 response always propagates.
// Lease release — guaranteed by try/finally; unexpected throws cannot
//   permanently lock the job. Release errors are swallowed so the caller sees
//   the original error; bounded lease expiry recovers if release itself fails.
const ORPHAN_CLEANUP_JOB_PATH     = "maintenanceJobs/avatarOrphanCleanup";
const ORPHAN_CLEANUP_PREFIXES     = ["avatarUploads/", "avatarCandidates/"];
const ORPHAN_CLEANUP_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const ORPHAN_MAX_OBJECTS_PER_RUN  = 1000;
const ORPHAN_LEASE_DURATION_MS    = 10 * 60 * 1000; // 10 minutes
const ORPHAN_TERMINAL_STATUSES    = new Set(["approved", "rejected", "failed"]);
const ORPHAN_ACTIVE_STATUSES      = new Set(["processing", "retry_pending"]);

// Classify GCS errors that represent an expired/invalid page cursor.
// Uses only stable API fields: HTTP status code and per-error reason string.
function _isInvalidStoragePageTokenError(err) {
  if (err?.code !== 400) return false;
  const reasons = (err?.errors ?? []).map(e => e.reason ?? "");
  return reasons.some(r => r === "invalid" || r === "invalidToken");
}

// Acquire a bounded cleanup lease via Firestore transaction.
// Returns the persisted cursor { currentPrefix, pageToken } on success,
// or null if a concurrent execution already holds an unexpired lease.
async function _acquireOrphanLease(firestoreDb, leaseOwner, nowMs) {
  const jobRef = firestoreDb.doc(ORPHAN_CLEANUP_JOB_PATH);
  return firestoreDb.runTransaction(async (tx) => {
    const snap = await tx.get(jobRef);
    const d    = snap.exists ? snap.data() : {};
    const exp  = d.leaseExpiresAt ? d.leaseExpiresAt.toMillis() : 0;
    if (d.leaseOwner && exp > nowMs) return null;
    const cursor = {
      currentPrefix: d.currentPrefix ?? ORPHAN_CLEANUP_PREFIXES[0],
      pageToken:     d.pageToken     ?? null,
    };
    tx.set(jobRef, {
      ...d,
      leaseOwner,
      leaseExpiresAt: Timestamp.fromMillis(nowMs + ORPHAN_LEASE_DURATION_MS),
      lastStartedAt:  Timestamp.fromMillis(nowMs),
      checkedLastRun: 0,
      deletedLastRun: 0,
      failedLastRun:  0,
    }, { merge: true });
    return cursor;
  });
}

async function _cleanOrphanedAvatarObjects(storageBucket, firestoreDb, cutoffMs, maxObjects, opts = {}) {
  const stale  = cutoffMs  ?? (Date.now() - ORPHAN_CLEANUP_THRESHOLD_MS);
  const limit  = maxObjects ?? ORPHAN_MAX_OBJECTS_PER_RUN;
  const { leaseOwner = null } = opts;

  let checked   = 0;
  let eligible  = 0;
  let deleted   = 0;
  let failed    = 0;
  let preserved = 0;

  let startPrefix = ORPHAN_CLEANUP_PREFIXES[0];
  let startToken  = null;
  if (leaseOwner) {
    const cursor = await _acquireOrphanLease(firestoreDb, leaseOwner, Date.now());
    if (!cursor) {
      console.log("Avatar orphan cleanup: lease held by concurrent execution — skipping");
      return { checked, eligible, deleted, failed, preserved, skipped: true };
    }
    startPrefix = cursor.currentPrefix;
    startToken  = cursor.pageToken;
  }

  let prefixIdx = ORPHAN_CLEANUP_PREFIXES.indexOf(startPrefix);
  if (prefixIdx < 0) prefixIdx = 0;

  // nextPrefix/nextToken: cursor persisted for the next run.
  // Default: wrap to beginning after all prefixes exhausted.
  let nextPrefix = ORPHAN_CLEANUP_PREFIXES[0];
  let nextToken  = null;
  let capHit     = false;

  // errorPrefix/errorToken: best-effort cursor for the error-exit path.
  // Updated when a token reset clears the stale value so re-saving it is avoided.
  let errorPrefix = startPrefix;
  let errorToken  = startToken;
  let didError    = false;

  try {
    for (let pi = prefixIdx; pi < ORPHAN_CLEANUP_PREFIXES.length; pi++) {
      const prefix    = ORPHAN_CLEANUP_PREFIXES[pi];
      let   pageToken = (pi === prefixIdx) ? startToken : null;
      let   tokenResetDone = false; // guard: clear stale token at most once per prefix

      // for(;;) instead of do-while: after a token reset (pageToken=null), continue
      // correctly restarts from the top rather than evaluating a while condition.
      for (;;) {
        const remaining = limit - checked;
        if (remaining <= 0) {
          // Budget exhausted before fetching the next page — persist cursor here.
          capHit     = true;
          nextPrefix = prefix;
          nextToken  = pageToken;
          break;
        }

        let files, nextQuery;
        try {
          [files, nextQuery] = await storageBucket.getFiles({
            prefix,
            maxResults:   Math.min(remaining, 500),
            pageToken:    pageToken || undefined,
            autoPaginate: false,
          });
        } catch (gcsErr) {
          if (!tokenResetDone && _isInvalidStoragePageTokenError(gcsErr)) {
            tokenResetDone = true;
            const nowMs = Date.now();
            if (leaseOwner) {
              const jobRef = firestoreDb.doc(ORPHAN_CLEANUP_JOB_PATH);
              await firestoreDb.runTransaction(async (tx) => {
                const snap = await tx.get(jobRef);
                if (snap.exists) {
                  tx.update(jobRef, {
                    pageToken:         null,
                    cursorResetAt:     Timestamp.fromMillis(nowMs),
                    cursorResetReason: "invalid_page_token",
                  });
                }
              });
            }
            console.warn(
              `Avatar orphan cleanup: stale page token cleared for prefix "${prefix}"; retrying from page 1`
            );
            // Update error-path cursor so a subsequent throw saves the cleared state.
            errorPrefix = prefix;
            errorToken  = null;
            pageToken   = null;
            continue; // restart for(;;) from page 1 of this prefix
          }
          throw gcsErr; // non-token errors propagate; finally releases lease
        }

        for (const file of files) {
          checked++;
          const created = new Date(file.metadata?.timeCreated ?? 0).getTime();
          if (created > stale) { preserved++; continue; }

          const uid = file.name.split("/")[1];
          if (!uid) {
            // Malformed path — defensive deletion; no UID to log.
            eligible++;
            try { await file.delete(); deleted++; }
            catch (err) { console.warn("Avatar orphan delete failed:", sanitizeError(err)); failed++; }
            continue;
          }

          const snap   = await firestoreDb.doc(`avatarModeration/${uid}`).get();
          const status = snap.exists ? snap.data()?.status : null;

          if (ORPHAN_ACTIVE_STATUSES.has(status)) { preserved++; continue; }

          if (!status || ORPHAN_TERMINAL_STATUSES.has(status)) {
            eligible++;
            try { await file.delete(); deleted++; }
            catch (err) { console.warn("Avatar orphan delete failed:", sanitizeError(err)); failed++; }
          } else {
            preserved++; // unknown status — conservative
          }
        }

        // Advance past the page we just finished.
        pageToken = nextQuery?.pageToken ?? null;

        // After consuming the page, check if the budget is now exhausted.
        if (checked >= limit && pageToken) {
          capHit     = true;
          nextPrefix = prefix;
          nextToken  = pageToken;
          break;
        }
        if (!pageToken) break; // prefix exhausted — move to next prefix
      }

      if (capHit) break;
    }
  } catch (err) {
    didError = true;
    throw err;
  } finally {
    if (leaseOwner) {
      // On normal completion or capHit: advance cursor.
      // On unexpected error: restore best-effort cursor (retry same position).
      const releasePrefix = (didError && !capHit) ? errorPrefix : nextPrefix;
      const releaseToken  = (didError && !capHit) ? errorToken  : nextToken;
      await firestoreDb.doc(ORPHAN_CLEANUP_JOB_PATH).update({
        leaseOwner:      null,
        leaseExpiresAt:  Timestamp.fromMillis(0),
        lastCompletedAt: Timestamp.fromMillis(Date.now()),
        currentPrefix:   releasePrefix,
        pageToken:       releaseToken,
        checkedLastRun:  checked,
        deletedLastRun:  deleted,
        failedLastRun:   failed,
      // ponytail: swallow release failure — bounded lease expiry still recovers
      }).catch(e => console.error("Avatar orphan cleanup: lease release failed:", sanitizeError(e)));
    }
  }

  console.log(`Avatar orphan cleanup: checked=${checked} eligible=${eligible} deleted=${deleted} failed=${failed} preserved=${preserved}`);
  return { checked, eligible, deleted, failed, preserved };
}
exports._cleanOrphans                   = _cleanOrphanedAvatarObjects;
exports._acquireOrphanLease             = _acquireOrphanLease;
exports._isInvalidStoragePageTokenError = _isInvalidStoragePageTokenError;

exports.cleanAvatarOrphans = onSchedule(
  { region: "us-central1", schedule: "every 24 hours", memory: "256MiB" },
  async () => {
    const { randomUUID } = require("crypto");
    return _cleanOrphanedAvatarObjects(
      getStorage().bucket(), db, undefined, undefined,
      { leaseOwner: randomUUID() }
    );
  }
);

// 7) Validate and claim a username
// --- Shared Moderation System ---

// Tier 1: substring block after compact normalization (unambiguous terms)
const BRAND_TERMS = ['parqueen', 'parkqueen'];
const STRONG_RESERVED = [
  'admin', 'administrator', 'support', 'official', 'system', 'root',
  'security', 'firebase', 'backend', 'moderator', 'staff', 'owner',
  'founder', 'developer',
];
// Tier 2: exact token match only — avoids blocking "modernDriver", "devonParks", "steam"
const SHORT_RESERVED = ['mod', 'dev', 'api', 'team', 'help'];

const BANNED_WORDS = new Set([
  // English profanity
  "fuck","shit","asshole","bitch","dick","pussy","cunt","damn","bastard","piss",
  "cock","tits","boobs","arse","bollocks","bugger","wanker","twat","prick","slut",
  "whore","skank","hoe","thot",
  // Slurs & hate speech
  "nigger","nigga","nigg","negro","chink","spic","wetback","kike","gook","raghead",
  "towelhead","cracker","honky","gringo","beaner","coon","darkie","jap","paki",
  "faggot","fag","dyke","tranny","shemale","retard","retarded","tard",
  // Sexual/explicit
  "porn","porno","xxx","nsfw","hentai","milf","dildo","blowjob","handjob",
  "cumshot","orgasm","penis","vagina","clitoris","anus","anal","fellatio",
  // Violence
  "killyou","killyourself","kys","rape","molest","murder","terrorist","bomb",
  // Spanish profanity (NYC relevance)
  "puta","mierda","coño","verga","pendejo","cabron","chingada","culero","maricon",
]);

function normalizeText(str) {
  return str.toLowerCase()
    .replace(/@/g, 'a').replace(/0/g, 'o').replace(/1/g, 'i').replace(/!/g, 'i')
    .replace(/3/g, 'e').replace(/\$/g, 's').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/4/g, 'a').replace(/8/g, 'b').replace(/9/g, 'g')
    .replace(/[_\-.\s]/g, '');
}

function tokenize(str) {
  return str.toLowerCase().split(/[_\-.\s]+/).filter(Boolean);
}

function checkImpersonation(text) {
  const compact = normalizeText(text);
  for (const term of BRAND_TERMS) {
    if (compact.includes(term)) return true;
  }
  for (const term of STRONG_RESERVED) {
    if (compact.includes(term)) return true;
  }
  const tokens = tokenize(text);
  for (const term of SHORT_RESERVED) {
    if (tokens.includes(term)) return true;
  }
  return false;
}

const CONTACT_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,  // phone numbers
  /\b\d{7,}\b/,                            // 7+ consecutive digits
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/,          // email
  /https?:\/\/\S+/i,                       // URLs
  /\bwww\.\S+/i,                           // www links
  /\b\S+\.(com|net|org|io|co|app|me|info)\b/i,  // bare domains
  /\b(instagram|snapchat|tiktok|whatsapp|telegram|signal|venmo|cashapp|zelle|paypal)\b/i,  // platform names
  /\b(my\s*(ig|insta|snap|tik\s*tok|number|cell|phone))\b/i,  // "my ig/snap" patterns
  /\b(add\s*me|hit\s*me\s*up|dm\s*me|text\s*me|call\s*me)\b/i,  // solicitation patterns
];

function checkBannedWords(text) {
  const normalized = normalizeText(text);
  // Check each banned word as a substring of the normalized text
  for (const word of BANNED_WORDS) {
    if (normalized.includes(word)) return true;
  }
  return false;
}

function checkContactInfo(text) {
  for (const pattern of CONTACT_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

// Shared moderation callable
exports.moderateContent = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const { text, type } = request.data || {};
    if (!text || !type) throw new HttpsError("invalid-argument", "Text and type required.");

    const uid = request.auth.uid;
    await checkRateLimit(uid, 'moderateContent', { limit: 60, windowSec: 3600 });
    let blocked = false;
    let reason = null;

    // Banned words check (both usernames and messages)
    if (checkBannedWords(text)) {
      blocked = true;
      reason = 'inappropriate_content';
    }

    // Contact info check (messages only)
    if (!blocked && type === 'message' && checkContactInfo(text)) {
      blocked = true;
      reason = 'contact_info';
    }

    // Impersonation check (usernames only — brand + internal term two-tier match)
    if (!blocked && type === 'username' && checkImpersonation(text)) {
      blocked = true;
      reason = 'reserved';
    }

    // Log moderation check
    await db.collection("moderationLog").add({
      userId: uid,
      text: text.substring(0, 200),
      type,
      blocked,
      reason,
      timestamp: Timestamp.now(),
    });

    return { allowed: !blocked };
  }
);

exports.claimUsername = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    await checkRateLimit(request.auth.uid, 'claimUsername', { limit: 5, windowSec: 3600 });

    const username = request.data?.username;
    if (!username || typeof username !== "string") throw new HttpsError("invalid-argument", "Username required.");

    // Validation rules
    const trimmed = username.trim();
    if (trimmed.length < 3) throw new HttpsError("invalid-argument", "Username must be at least 3 characters.");
    if (trimmed.length > 20) throw new HttpsError("invalid-argument", "Username must be 20 characters or less.");
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) throw new HttpsError("invalid-argument", "Username must start with a letter and contain only letters, numbers, and underscores.");
    if (/__/.test(trimmed)) throw new HttpsError("invalid-argument", "Username cannot contain consecutive underscores.");

    const normalized = trimmed.toLowerCase();

    // Impersonation check — two-tier brand + internal term match
    if (checkImpersonation(trimmed)) throw new HttpsError("invalid-argument", "Please choose a different username.");

    // Profanity check using shared system
    if (checkBannedWords(trimmed)) throw new HttpsError("invalid-argument", "This username is not available.");

    const uid = request.auth.uid;
    const usernameRef = db.collection("usernames").doc(normalized);
    const userRef = db.collection("users").doc(uid);

    try {
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(usernameRef);
        if (existing.exists) {
          if (existing.data().uid !== uid) {
            // Belongs to a different user — reject normally
            throw new HttpsError("already-exists", "Username is already taken.");
          }
          // Same UID: reservation already belongs to this user (orphaned from a failed
          // saveUserProfile). Treat as idempotent — the user doc will be created or
          // updated by the client's saveUserProfile call. No cooldown applies here
          // because this isn't a username change, just completing an interrupted claim.
          return;
        }

        const userDoc = await tx.get(userRef);
        const userData = userDoc.exists ? userDoc.data() : {};

        // Enforce 30-day cooldown (skip for generated usernames starting with user_)
        if (userData.usernameChangedAt && userData.username && !userData.username.startsWith('user_')) {
          const lastChanged = userData.usernameChangedAt.toMillis();
          const daysSince = (Date.now() - lastChanged) / (1000 * 60 * 60 * 24);
          if (daysSince < 30) {
            throw new HttpsError("failed-precondition", `You can change your username again in ${Math.ceil(30 - daysSince)} days.`);
          }
        }

        // Release old username if user had one
        if (userData.username) {
          const oldNormalized = userData.username.toLowerCase();
          tx.delete(db.collection("usernames").doc(oldNormalized));
        }

        tx.set(usernameRef, { uid, claimedAt: Timestamp.now() });
        // Only update an existing user doc. New users don't have a doc yet —
        // saveUserProfile (client) will create it under the CREATE rule, which
        // allows all fields. Writing here on a missing doc would create a
        // partial stub, turning the subsequent setDoc into an UPDATE and
        // triggering the blocked-fields restriction.
        if (userDoc.exists) {
          tx.set(userRef, { username: trimmed, usernameChangedAt: Timestamp.now() }, { merge: true });
        }
      });
    } catch (e) {
      if (e.code) throw e;
      console.error("Username claim error:", sanitizeError(e));
      throw new HttpsError("internal", "Failed to claim username.");
    }

    return { success: true, username: trimmed };
  }
);

// 10) Award crowns on successful parking handoff
exports.awardCrowns = onDocumentCreated(
  {
    document: "spotFeedback/{feedbackId}",
    region: "us-central1",
  },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.outcome !== 'success') return;

    const driverId = data.userId;
    const finderId = data.finderId;
    if (!driverId || !finderId || driverId === finderId) return;

    const batch = db.batch();

    const driverRef = db.doc(`users/${driverId}`);
    const driverSnap = await driverRef.get();
    const driverCrowns = (driverSnap.data()?.crowns || 0) + 1;
    batch.update(driverRef, {
        crowns: FieldValue.increment(1),
        title: getTitleForCrowns(driverCrowns),
    });

    const finderRef = db.doc(`users/${finderId}`);
    const finderSnap = await finderRef.get();
    const finderCrowns = (finderSnap.data()?.crowns || 0) + 2;
    batch.update(finderRef, {
        crowns: FieldValue.increment(2),
        title: getTitleForCrowns(finderCrowns),
    });

    await batch.commit();
    console.log(`Crowns awarded: driver ${driverId.slice(0,4)}*** +1 (${driverCrowns}), finder ${finderId.slice(0,4)}*** +2 (${finderCrowns})`);
  }
);

// 13) Admin-safe spot deletion — routes through event pipeline to preserve trust integrity.
// All admin spot removals MUST use this function instead of direct Console/SDK deletes.
// Sets source: 'admin' before deletion so onDocumentDeleted skips trust penalties.
exports.adminDeleteSpot = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }

    const { spotId, reason } = request.data || {};
    if (!spotId || typeof spotId !== 'string') {
      throw new HttpsError('invalid-argument', 'spotId is required.');
    }

    const spotRef = db.doc(`spots/${spotId}`);
    const spotSnap = await spotRef.get();
    if (!spotSnap.exists) {
      throw new HttpsError('not-found', 'Spot not found.');
    }

    const spotData = spotSnap.data();

    // Mark source before deletion so onDocumentDeleted skips trust penalties.
    await spotRef.update({ source: 'admin' });
    await spotRef.delete();

    const now = Timestamp.now();
    await db.collection('adminAuditLog').add({
      // Standard fields
      action: 'spot.delete',
      targetType: 'spot',
      targetId: spotId,
      targetUserId: spotData.finderId || null,
      adminId: request.auth.uid,
      reason: reason || null,
      metadata: { status: spotData.status || null },
      createdAt: now,
      // Legacy fields preserved for backward compat
      finderId: spotData.finderId || null,
      spotId,
      adminUid: request.auth.uid,
      performedAt: now,
    });

    return { success: true };
  }
);

// 14) One-time admin bootstrap — any @parqueen.app account can claim admin if none exists yet.
exports.bootstrapAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');

    const email = request.auth.token.email || '';
    if (!email.endsWith('@parqueen.app')) {
      throw new HttpsError('permission-denied', 'Requires a @parqueen.app account.');
    }
    if (request.auth.token.email_verified !== true) {
      throw new HttpsError('permission-denied', 'Email address must be verified.');
    }

    // Atomic singleton check — transaction prevents two concurrent calls both passing
    const sentinelRef = db.doc('adminBootstrap/singleton');
    try {
      await db.runTransaction(async (tx) => {
        const sentinel = await tx.get(sentinelRef);
        if (sentinel.exists) {
          throw new HttpsError('already-exists', 'Admin access has already been bootstrapped.');
        }
        tx.set(sentinelRef, { bootstrappedAt: Timestamp.now(), bootstrappedBy: request.auth.uid });
      });
    } catch (err) {
      if (err.code === 'already-exists') throw err;
      throw new HttpsError('internal', 'Bootstrap failed; retry.');
    }

    await getAuth().setCustomUserClaims(request.auth.uid, { role: 'admin' });

    await db.collection('adminAuditLog').add({
      action: 'bootstrapAdmin',
      adminUid: request.auth.uid,
      email,
      performedAt: Timestamp.now(),
    });

    return { success: true };
  }
);

// 15) Admin-only role management — grant or revoke staff roles.
exports.setStaffRole = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }

    const { uid, role } = request.data || {};
    if (!uid || typeof uid !== 'string') throw new HttpsError('invalid-argument', 'uid required.');
    if (role !== null && role !== 'admin' && role !== 'staff') {
      throw new HttpsError('invalid-argument', "role must be 'admin', 'staff', or null.");
    }

    const claims = role ? { role } : {};
    await getAuth().setCustomUserClaims(uid, claims);

    const now = Timestamp.now();
    await db.collection('adminAuditLog').add({
      // Standard fields
      action: 'user.set_role',
      targetType: 'user',
      targetId: uid,
      targetUserId: uid,
      adminId: request.auth.uid,
      metadata: { role: role || null },
      createdAt: now,
      // Legacy fields preserved for backward compat
      targetUid: uid,
      adminUid: request.auth.uid,
      performedAt: now,
    });

    return { success: true };
  }
);

// 16) Admin suspend user — writes user doc + standardized audit log entry
exports.adminSuspendUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    const { userId, reason } = request.data || {};
    if (!userId || typeof userId !== 'string') throw new HttpsError('invalid-argument', 'userId required.');
    if (!reason || typeof reason !== 'string' || !reason.trim()) throw new HttpsError('invalid-argument', 'reason required.');

    const now = Timestamp.now();
    await db.doc(`users/${userId}`).update({
      status: 'Suspended',
      suspendedAt: now,
      suspendedBy: request.auth.uid,
      suspensionReason: reason.trim(),
      unsuspendedAt: null,
      unsuspendedBy: null,
      updatedAt: now,
    });

    await db.collection('adminAuditLog').add({
      action: 'user.suspend',
      targetType: 'user',
      targetId: userId,
      targetUserId: userId,
      adminId: request.auth.uid,
      reason: reason.trim(),
      createdAt: now,
    });

    return { success: true };
  }
);

// 17) Admin unsuspend user — clears suspension + standardized audit log entry
exports.adminUnsuspendUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    const { userId } = request.data || {};
    if (!userId || typeof userId !== 'string') throw new HttpsError('invalid-argument', 'userId required.');

    const now = Timestamp.now();
    await db.doc(`users/${userId}`).update({
      status: 'Active',
      unsuspendedAt: now,
      unsuspendedBy: request.auth.uid,
      suspendedAt: null,
      suspendedBy: null,
      suspensionReason: null,
      updatedAt: now,
    });

    await db.collection('adminAuditLog').add({
      action: 'user.unsuspend',
      targetType: 'user',
      targetId: userId,
      targetUserId: userId,
      adminId: request.auth.uid,
      createdAt: now,
    });

    return { success: true };
  }
);

// 18) Admin update report status — review / dismiss / reopen with audit trail
exports.adminUpdateReport = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    const { reportId, status, adminNote } = request.data || {};
    if (!reportId || typeof reportId !== 'string') throw new HttpsError('invalid-argument', 'reportId required.');
    const allowed = ['reviewed', 'dismissed', 'pending'];
    if (!allowed.includes(status)) throw new HttpsError('invalid-argument', `status must be one of: ${allowed.join(', ')}.`);

    const reportRef = db.doc(`reports/${reportId}`);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) throw new HttpsError('not-found', 'Report not found.');
    const reportData = reportSnap.data();

    const now = Timestamp.now();
    let update;
    let action;

    if (status === 'pending') {
      update = { status: 'pending', reviewedAt: null, reviewedBy: null, adminNote: null };
      action = 'report.reopened';
    } else {
      update = {
        status,
        reviewedAt: now,
        reviewedBy: request.auth.uid,
        adminNote: (adminNote && adminNote.trim()) || null,
      };
      action = status === 'reviewed' ? 'report.reviewed' : 'report.dismissed';
    }

    await reportRef.update(update);

    await db.collection('adminAuditLog').add({
      action,
      targetType: 'report',
      targetId: reportId,
      targetUserId: reportData.reportedUserId || null,
      adminId: request.auth.uid,
      reason: (adminNote && adminNote.trim()) || null,
      metadata: {
        reporterId: reportData.reporterId || null,
        reportedUserId: reportData.reportedUserId || null,
        previousStatus: reportData.status || null,
        conversationId: reportData.conversationId || null,
        type: reportData.type || null,
      },
      createdAt: now,
    });

    return { success: true, action };
  }
);

// 19) Admin update segment status — archive / needs_review / restore active with audit trail
exports.adminUpdateSegmentStatus = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    const { segmentId, status, reason } = request.data || {};
    if (!segmentId || typeof segmentId !== 'string') throw new HttpsError('invalid-argument', 'segmentId required.');
    const allowed = ['active', 'needs_review', 'archived'];
    if (!allowed.includes(status)) throw new HttpsError('invalid-argument', `status must be one of: ${allowed.join(', ')}.`);

    const segRef = db.doc(`streetSegments/${segmentId}`);
    const segSnap = await segRef.get();
    if (!segSnap.exists) throw new HttpsError('not-found', 'Segment not found.');
    const segData = segSnap.data();

    const now = Timestamp.now();
    let update;
    let action;

    if (status === 'archived') {
      update = {
        status: 'archived',
        archivedAt: now,
        archivedBy: request.auth.uid,
        archiveReason: (reason && reason.trim()) || 'admin',
        updatedAt: now,
      };
      action = 'segment.archive';
    } else if (status === 'needs_review') {
      update = { status: 'needs_review', updatedAt: now };
      action = 'segment.needs_review';
    } else {
      update = { status: 'active', updatedAt: now };
      action = 'segment.restore_active';
    }

    await segRef.update(update);

    await db.collection('adminAuditLog').add({
      action,
      targetType: 'segment',
      targetId: segmentId,
      adminId: request.auth.uid,
      reason: (reason && reason.trim()) || null,
      metadata: {
        previousStatus: segData.status || null,
        streetName: segData.streetName || null,
        borough: segData.borough || null,
        source: segData.source || null,
        cslSegmentId: segData.cslSegmentId || null,
      },
      createdAt: now,
    });

    return { success: true, action };
  }
);

// 20) Admin archive suspension — soft-delete with audit trail
exports.adminArchiveSuspension = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    const { suspensionId, reason } = request.data || {};
    if (!suspensionId || typeof suspensionId !== 'string') throw new HttpsError('invalid-argument', 'suspensionId required.');

    const suspRef = db.doc(`suspensions/${suspensionId}`);
    const suspSnap = await suspRef.get();
    if (!suspSnap.exists) throw new HttpsError('not-found', 'Suspension not found.');
    const suspData = suspSnap.data();

    const now = Timestamp.now();
    await suspRef.update({
      status: 'archived',
      archivedAt: now,
      archivedBy: request.auth.uid,
      archiveReason: (reason && reason.trim()) || 'Archived from admin dashboard',
      updatedAt: now,
    });

    await db.collection('adminAuditLog').add({
      action: 'suspension.archive',
      targetType: 'suspension',
      targetId: suspensionId,
      adminId: request.auth.uid,
      reason: (reason && reason.trim()) || null,
      metadata: {
        date: suspData.date || null,
        label: suspData.label || null,
        cityId: suspData.cityId || null,
        source: suspData.source || null,
      },
      createdAt: now,
    });

    return { success: true };
  }
);

// Delete account — idempotent; covers all user-linked collections, Storage, and Auth.
// Job document at accountDeletionJobs/{uid} tracks state: running → failed | completed.
// A 'running' lease (< 10 min old) blocks concurrent callers. A stale lease or 'failed'
// state allows retry. Completed steps are skipped on retry. Auth is deleted last.
exports.deleteAccount = onCall({ region: 'us-central1' }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in.');

    // Auth-freshness check BEFORE rate limit — a stale-session rejection must not
    // consume quota; the user should re-auth and retry without hitting the daily cap.
    const authTime = request.auth.token.auth_time; // epoch seconds
    if (!authTime || (Date.now() / 1000) - authTime > 600) {
        throw new HttpsError(
            'failed-precondition',
            'Recent sign-in required to delete your account.'
        );
    }

    await checkRateLimit(uid, 'deleteAccount', { limit: 3, windowSec: 86400 });

    const jobRef = db.doc(`accountDeletionJobs/${uid}`);
    const maskedUid = uid.slice(0, 4) + '***';

    // ── Atomic lock ───────────────────────────────────────────────────────────
    // Transaction prevents two concurrent callers from both entering the deletion body.
    // A fresh 'running' lease (< 10 min) is an active worker — reject the second caller.
    // A stale lease or 'failed' state → claim the job and resume.
    let alreadyDone = false;
    let doneSteps = {};

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(jobRef);
        if (snap.exists) {
            const job = snap.data();
            if (job.state === 'completed') {
                alreadyDone = true;
                return;
            }
            if (job.state === 'running') {
                const leaseAge = (Date.now() / 1000) - job.leaseAt.seconds;
                if (leaseAge < 600) {
                    throw new HttpsError('already-exists', 'A deletion request is already in progress.');
                }
                // Stale lease — previous worker died; take over and resume
            }
            // 'failed' or stale 'running' — resume from where we left off
            doneSteps = job.steps || {};
            tx.update(jobRef, {
                state: 'running',
                leaseAt: Timestamp.now(),
                currentStep: null,
                lastError: null,
                attemptNumber: (job.attemptNumber || 0) + 1,
            });
        } else {
            tx.set(jobRef, {
                state: 'running',
                leaseAt: Timestamp.now(),
                startedAt: Timestamp.now(),
                currentStep: null,
                lastError: null,
                attemptNumber: 1,
                steps: {},
            });
        }
    });

    if (alreadyDone) return { alreadyCompleted: true };

    // ── True cursor-based paginated delete ────────────────────────────────────
    // Does NOT load the entire result set into memory. Uses startAfter cursor to
    // page through results in chunks of 499 (below the Firestore 500-write limit).
    async function paginatedDelete(baseQuery) {
        let cursor = null;
        while (true) {
            const q = cursor
                ? baseQuery.startAfter(cursor).limit(499)
                : baseQuery.limit(499);
            const snap = await q.get();
            if (snap.empty) break;
            const batch = db.batch();
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            if (snap.size < 499) break;
            cursor = snap.docs[snap.docs.length - 1];
        }
    }

    // ── True cursor-based paginated update ────────────────────────────────────
    async function paginatedUpdate(baseQuery, updateData) {
        let cursor = null;
        while (true) {
            const q = cursor
                ? baseQuery.startAfter(cursor).limit(499)
                : baseQuery.limit(499);
            const snap = await q.get();
            if (snap.empty) break;
            const batch = db.batch();
            snap.docs.forEach(d => batch.update(d.ref, updateData));
            await batch.commit();
            if (snap.size < 499) break;
            cursor = snap.docs[snap.docs.length - 1];
        }
    }

    // ── Required step executor ────────────────────────────────────────────────
    // All personal-data cleanup is required. If any step fails, Auth is NOT deleted
    // and the job state is set to 'failed' (retryable). Already-done steps are skipped
    // on retry. Error messages are sanitized before being written to the job document.
    async function step(name, fn) {
        if (doneSteps[name] === 'done') return; // idempotent resume after 'failed'

        try {
            // Refresh lease timestamp on each step so long-running jobs don't expire
            await jobRef.update({ currentStep: name, leaseAt: Timestamp.now() });
            await fn();
            await jobRef.update({ [`steps.${name}`]: 'done', currentStep: null });
            doneSteps[name] = 'done';
        } catch (err) {
            // Strip PII from error payloads before writing to Firestore
            const safe = (err.message || 'error')
                .replace(/\S+@\S+\.\S+/g, '[email]')
                .replace(/\+?[0-9]{10,}/g, '[phone]')
                .substring(0, 200);
            await jobRef.update({
                state: 'failed',
                currentStep: null,
                lastError: `${name}: ${safe}`,
                [`steps.${name}`]: 'error',
            }).catch(() => {});
            console.error(`[deleteAccount] ${maskedUid} step=${name} failed`);
            throw new HttpsError(
                'internal',
                `Deletion paused at "${name}". Your data is safe — retry or contact support.`
            );
        }
    }

    // ── Cleanup steps — all required; Auth is not deleted until all pass ──────

    // Location cache — top-level collection, not covered by userDoc recursiveDelete
    await step('userLocations', () => db.doc(`userLocations/${uid}`).delete());

    // User document tree — recursiveDelete covers private/* and processedTrustEvents/*
    await step('userDoc', () => db.recursiveDelete(db.doc(`users/${uid}`)));

    // Username reservation record
    await step('usernames', () =>
        paginatedDelete(db.collection('usernames').where('uid', '==', uid))
    );

    // Path-keyed singleton documents — absence is success (idempotent delete)
    await step('parkingSessions',
        () => db.doc(`parkingSessions/${uid}`).delete());
    await step('avatarModeration',
        () => db.doc(`avatarModeration/${uid}`).delete());
    await step('emailVerificationCodes',
        () => db.doc(`emailVerificationCodes/${uid}`).delete());

    // spotFeedback submitted by user as driver
    await step('spotFeedbackAsDriver', () =>
        paginatedDelete(db.collection('spotFeedback').where('userId', '==', uid))
    );

    // spotFeedback where user was the finder — anonymize, retain for other party
    await step('spotFeedbackAsFinder', () =>
        paginatedUpdate(
            db.collection('spotFeedback').where('finderId', '==', uid),
            { finderId: FieldValue.delete(), address: '[removed]' }
        )
    );

    // Spot notifications in user's inbox
    await step('spotNotifications', () =>
        paginatedDelete(db.collection('spotNotifications').where('targetUserId', '==', uid))
    );

    // Spots posted as finder
    await step('spotsAsFinder', () =>
        paginatedDelete(db.collection('spots').where('finderId', '==', uid))
    );

    // Active Pings being claimed — release back to available
    await step('spotsAsClaimer', () =>
        paginatedUpdate(
            db.collection('spots').where('interestedUserId', '==', uid),
            {
                interestedUserId: FieldValue.delete(),
                interestedUserName: FieldValue.delete(),
                interestedUserVehicleColor: FieldValue.delete(),
                interestedUserVehicleType: FieldValue.delete(),
                interestedUserVehicleBrand: FieldValue.delete(),
                interestedUserTitle: FieldValue.delete(),
                status: 'available',
            }
        )
    );

    // Chats — paginated to avoid loading all IDs into memory;
    // recursiveDelete on each chat covers its messages subcollection.
    await step('chats', async () => {
        let cursor = null;
        while (true) {
            const baseQ = db.collection('chats').where('participants', 'array-contains', uid);
            const q = cursor ? baseQ.startAfter(cursor).limit(50) : baseQ.limit(50);
            const snap = await q.get();
            if (snap.empty) break;
            for (const chatDoc of snap.docs) {
                await db.recursiveDelete(chatDoc.ref);
            }
            if (snap.size < 50) break;
            cursor = snap.docs[snap.docs.length - 1];
        }
    });

    // Reports filed by user — anonymize reporter; retain doc for compliance
    await step('reports', () =>
        paginatedUpdate(
            db.collection('reports').where('reporterId', '==', uid),
            { reporterId: '[deleted]', reporterDeletedAt: Timestamp.now() }
        )
    );

    // Moderation log — anonymize content; retain for safety review
    // LEGAL: retention period requires legal sign-off before converting to deletion
    await step('moderationLog', () =>
        paginatedUpdate(
            db.collection('moderationLog').where('userId', '==', uid),
            { userId: '[deleted]', text: '[removed]' }
        )
    );

    // Storage — clean up all three path families; absence is success (idempotent).
    await step('storageUploads',   () => getStorage().bucket().deleteFiles({ prefix: `avatarUploads/${uid}/`   }).catch(() => {}));
    await step('storageCandidates',() => getStorage().bucket().deleteFiles({ prefix: `avatarCandidates/${uid}/` }).catch(() => {}));
    await step('storagePublished', () => getStorage().bucket().deleteFiles({ prefix: `avatars/${uid}`           }).catch(() => {}));

    // ── Auth deletion — only reached after every required step passes ─────────
    try {
        await getAuth().deleteUser(uid);
        await jobRef.update({
            state: 'completed',
            completedAt: Timestamp.now(),
            currentStep: null,
            'steps.authUser': 'done',
        });
    } catch (err) {
        if (err.code === 'auth/user-not-found') {
            // Auth was already deleted on a previous attempt — mark complete
            await jobRef.update({
                state: 'completed',
                completedAt: Timestamp.now(),
                currentStep: null,
                'steps.authUser': 'done',
            });
            return { success: true };
        }
        await jobRef.update({
            state: 'failed',
            lastError: 'authUser: deletion failed (check function logs)',
            'steps.authUser': 'error',
        }).catch(() => {});
        console.error(`[deleteAccount] ${maskedUid} authUser deletion failed`);
        throw new HttpsError('internal', 'Data deleted; Auth cleanup failed. Contact support to complete removal.');
    }

    return { success: true };
});

// 11) Trust: record successful handoff for the finder
// Fires on every spotFeedback creation; only acts on outcome === 'success'.
// eventId uses the feedback document ID (already globally unique) with a role suffix.
exports.updateTrustOnFeedback = onDocumentCreated(
  { document: 'spotFeedback/{feedbackId}', region: 'us-central1' },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.outcome !== 'success') return;

    const finderId = data.finderId;
    if (!finderId) return;

    await applyTrustDelta(finderId, 'handoffsCompleted', `${event.params.feedbackId}:finder`);
  }
);

// 12) Trust: record finder-cancelled-after-interest when a spot is deleted while claimed.
// Only penalizes if status === 'interested' at deletion time — not for normal spot removal.
// eventId: spotId + ':finder-cancel' is deterministic and unique for this transition.
exports.scheduleCleaningReminders = onSchedule(
  { schedule: 'every 15 minutes', region: 'us-central1' },
  async () => {
    const snap = await db.collection('parkingSessions')
      .where('active', '==', true)
      .where('reminderEnabled', '==', true)
      .where('reminderSent', '==', false)
      .get();

    const now = new Date();
    const due = snap.docs.filter(d => {
      const ra = d.data().reminderAt;
      return ra && ra.toDate() <= now;
    });

    await Promise.all(due.map(async d => {
      const { fcmToken, streetName, reminderMinutesBefore } = d.data();
      try {
        await getMessaging().send({
          token: fcmToken,
          notification: {
            title: 'Move Your Car',
            body: `Street cleaning on ${streetName} starts in ${reminderMinutesBefore} minutes`,
          },
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        });
      } catch (e) {
        console.error('FCM send failed for session', d.id.slice(0, 8) + '***', sanitizeError(e));
      }
      await d.ref.update({ reminderSent: true });
    }));
  }
);

exports.updateTrustOnSpotDelete = onDocumentDeleted(
  { document: 'spots/{spotId}', region: 'us-central1' },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== 'interested' || !data.finderId) return;

    // Admin-triggered deletions must not penalize the finder.
    // Requires the deletion path to set source: 'admin' on the spot before deleting.
    const source = data.source || 'user';
    if (source === 'admin') return;

    await applyTrustDelta(
      data.finderId,
      'handoffsCancelledByFinder',
      `${event.params.spotId}:finder-cancel`,
      source
    );
  }
);

// 21) Admin resolve parse failure — marks failure as resolved with audit trail
exports.adminResolveParseFailure = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    const { failureId, resolutionType, resolutionNote } = request.data || {};
    if (!failureId || typeof failureId !== 'string') throw new HttpsError('invalid-argument', 'failureId required.');
    const allowed = ['fixed', 'expected_ignore'];
    if (!allowed.includes(resolutionType)) throw new HttpsError('invalid-argument', "resolutionType must be 'fixed' or 'expected_ignore'.");

    const failureRef = db.doc(`parseFailures/${failureId}`);
    const failureSnap = await failureRef.get();
    if (!failureSnap.exists) throw new HttpsError('not-found', 'Parse failure not found.');
    const failureData = failureSnap.data();

    const now = Timestamp.now();
    await failureRef.update({
      resolvedAt: now,
      resolvedBy: request.auth.uid,
      resolutionType,
      resolutionNote: (resolutionNote && resolutionNote.trim()) || null,
    });

    await db.collection('adminAuditLog').add({
      action: 'parseFailure.resolve',
      targetType: 'parseFailure',
      targetId: failureId,
      adminId: request.auth.uid,
      adminEmail: request.auth.token?.email || null,
      reason: (resolutionNote && resolutionNote.trim()) || null,
      metadata: {
        resolutionType,
        rawSignText: failureData.rawSignText || null,
        parserVersion: failureData.parserVersion || null,
        count: failureData.count || null,
      },
      createdAt: now,
    });

    return { success: true };
  }
);

// 22) Admin reopen parse failure — clears resolution with audit trail
exports.adminReopenParseFailure = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    const { failureId } = request.data || {};
    if (!failureId || typeof failureId !== 'string') throw new HttpsError('invalid-argument', 'failureId required.');

    const failureRef = db.doc(`parseFailures/${failureId}`);
    const failureSnap = await failureRef.get();
    if (!failureSnap.exists) throw new HttpsError('not-found', 'Parse failure not found.');

    const now = Timestamp.now();
    await failureRef.update({
      resolvedAt: null,
      resolvedBy: null,
      resolutionType: null,
      resolutionNote: null,
    });

    await db.collection('adminAuditLog').add({
      action: 'parseFailure.reopen',
      targetType: 'parseFailure',
      targetId: failureId,
      adminId: request.auth.uid,
      adminEmail: request.auth.token?.email || null,
      createdAt: now,
    });

    return { success: true };
  }
);

// 23) Admin add street segment — accepts fully geocoded payload from client, writes doc + audit trail.
// Geocoding (OSM + address lookup) is performed client-side; this function owns the write + audit.
exports.adminAddSegment = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    const p = request.data || {};
    const required = ['cityId', 'streetName', 'borough', 'fromLat', 'fromLng', 'toLat', 'toLng', 'centerLat', 'centerLng', 'bearing', 'geohash'];
    for (const field of required) {
      if (p[field] == null) throw new HttpsError('invalid-argument', `${field} is required.`);
    }

    const now = Timestamp.now();
    const docRef = await db.collection('streetSegments').add({
      cityId: p.cityId,
      streetName: p.streetName,
      referenceAddress: p.referenceAddress || null,
      fromCross: p.fromCross || '',
      toCross: p.toCross || '',
      borough: p.borough,
      fromLat: p.fromLat,
      fromLng: p.fromLng,
      toLat: p.toLat,
      toLng: p.toLng,
      centerLat: p.centerLat,
      centerLng: p.centerLng,
      bearing: p.bearing,
      geohash: p.geohash,
      evenSideIsPositiveCross: p.evenSideIsPositiveCross ?? null,
      cslSegmentId: null,
      source: 'admin',
      status: 'active',
      confidenceScore: 1.0,
      editedBy: `admin:${request.auth.uid}`,
      provenance: {
        provider: 'admin',
        importedBy: request.auth.uid,
      },
      confidence: {
        level: 'parqueen_verified',
        source: 'admin',
        lastVerifiedAt: now,
        communityConfirmations: 0,
      },
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('adminAuditLog').add({
      action: 'segment.create',
      targetType: 'segment',
      targetId: docRef.id,
      adminId: request.auth.uid,
      adminEmail: request.auth.token?.email || null,
      metadata: {
        streetName: p.streetName,
        borough: p.borough,
        fromCross: p.fromCross || null,
        toCross: p.toCross || null,
        source: 'admin',
        confidenceScore: 1.0,
      },
      createdAt: now,
    });

    return { success: true, segmentId: docRef.id };
  }
);

// 24) Admin add cleaning rule — creates rule in segment subcollection with audit trail
exports.adminAddCleaningRule = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    const { segmentId, side, days, startTime, endTime } = request.data || {};
    if (!segmentId || typeof segmentId !== 'string') throw new HttpsError('invalid-argument', 'segmentId required.');
    if (!side || !['even', 'odd'].includes(side)) throw new HttpsError('invalid-argument', "side must be 'even' or 'odd'.");
    if (!Array.isArray(days) || days.length === 0) throw new HttpsError('invalid-argument', 'days must be a non-empty array.');
    if (!startTime || typeof startTime !== 'string') throw new HttpsError('invalid-argument', 'startTime required.');
    if (!endTime || typeof endTime !== 'string') throw new HttpsError('invalid-argument', 'endTime required.');

    const segSnap = await db.doc(`streetSegments/${segmentId}`).get();
    if (!segSnap.exists) throw new HttpsError('not-found', 'Segment not found.');

    const now = Timestamp.now();
    const ruleRef = await db.collection(`streetSegments/${segmentId}/streetRules`).add({
      type: 'streetCleaning',
      effectiveDate: now,
      supersededAt: null,
      schedules: [{ side, days, startTime, endTime }],
      source: 'admin',
      provenance: {
        provider: 'admin',
        importedBy: request.auth.uid,
      },
      lastSourceSync: new Date().toISOString().slice(0, 10),
      createdAt: now,
      updatedAt: now,
      editedBy: `admin:${request.auth.uid}`,
    });

    await db.collection('adminAuditLog').add({
      action: 'rule.create',
      targetType: 'rule',
      targetId: ruleRef.id,
      adminId: request.auth.uid,
      adminEmail: request.auth.token?.email || null,
      metadata: {
        segmentId,
        side,
        days,
        startTime,
        endTime,
        source: 'admin',
      },
      createdAt: now,
    });

    return { success: true, ruleId: ruleRef.id };
  }
);

// 25) Admin supersede cleaning rule — soft-deletes a rule with audit trail
exports.adminSupersedeRule = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    const { segmentId, ruleId, reason } = request.data || {};
    if (!segmentId || typeof segmentId !== 'string') throw new HttpsError('invalid-argument', 'segmentId required.');
    if (!ruleId || typeof ruleId !== 'string') throw new HttpsError('invalid-argument', 'ruleId required.');

    const ruleRef = db.doc(`streetSegments/${segmentId}/streetRules/${ruleId}`);
    const ruleSnap = await ruleRef.get();
    if (!ruleSnap.exists) throw new HttpsError('not-found', 'Rule not found.');
    const ruleData = ruleSnap.data();
    const schedule = ruleData.schedules?.[0] || {};

    const now = Timestamp.now();
    await ruleRef.update({
      supersededAt: now,
      updatedAt: now,
      editedBy: `admin:${request.auth.uid}`,
      supersedeReason: (reason && reason.trim()) || 'Removed from admin dashboard',
    });

    await db.collection('adminAuditLog').add({
      action: 'rule.supersede',
      targetType: 'rule',
      targetId: ruleId,
      adminId: request.auth.uid,
      adminEmail: request.auth.token?.email || null,
      reason: (reason && reason.trim()) || null,
      metadata: {
        segmentId,
        side: schedule.side || null,
        days: schedule.days || null,
        startTime: schedule.startTime || null,
        endTime: schedule.endTime || null,
        previousSource: ruleData.source || null,
      },
      createdAt: now,
    });

    return { success: true };
  }
);

// 26) Admin add ASP suspension — creates suspension record with audit trail
exports.adminAddSuspension = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (request.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin only.');
    }
    const { date, label, type } = request.data || {};
    if (!date || typeof date !== 'string') throw new HttpsError('invalid-argument', 'date required (YYYY-MM-DD).');
    if (!label || typeof label !== 'string' || !label.trim()) throw new HttpsError('invalid-argument', 'label required.');
    if (!['holiday', 'emergency'].includes(type)) throw new HttpsError('invalid-argument', "type must be 'holiday' or 'emergency'.");

    const now = Timestamp.now();
    const suspRef = await db.collection('suspensions').add({
      cityId: 'nyc',
      date,
      type,
      label: label.trim(),
      affectsTypes: ['streetCleaning'],
      source: 'admin',
      status: 'active',
      createdAt: now,
      createdBy: request.auth.uid,
      updatedAt: now,
    });

    await db.collection('adminAuditLog').add({
      action: 'suspension.create',
      targetType: 'suspension',
      targetId: suspRef.id,
      adminId: request.auth.uid,
      adminEmail: request.auth.token?.email || null,
      metadata: {
        date,
        label: label.trim(),
        type,
        cityId: 'nyc',
        source: 'admin',
      },
      createdAt: now,
    });

    return { success: true, suspensionId: suspRef.id };
  }
);

// 27) Create segment from SweepNYC with NYC Open Data fallback.
// Called when the client finds no Firestore segment within 80m.
// Tries SweepNYC first; falls back to NYC Open Data when SweepNYC has no usable data.

async function _tryCreateFromSweepNYC(lat, lng) {
    try {
    const SWEEPNYC_BASE = 'https://sweepnyc.nyc.gov/mappingapi/api';
    const PARSER_VERSION = '1.1';

    // ── SweepNYC API ─────────────────────────────────────────────────────────────
    const sweepUrl = `${SWEEPNYC_BASE}/highlight/sweepinfo?lat=${lat}&lon=${lng}&t=${Date.now()}&radius=0.1`;
    console.log('[SweepNYC] requesting'); // TM-17: coordinates omitted (user location)
    let apiData;
    try {
      const res = await fetch(sweepUrl);
      console.log('[SweepNYC] HTTP status:', res.status);
      if (!res.ok) {
        console.warn('[SweepNYC] non-OK response:', res.status);
        return { success: false, reason: 'no_sweepnyc_data' };
      }
      apiData = await res.json();
    } catch (err) {
      console.warn('[SweepNYC] fetch error:', sanitizeError(err));
      return { success: false, reason: 'no_sweepnyc_data' };
    }

    console.log('[SweepNYC] response keys:', Object.keys(apiData || {}).join(', '));
    console.log('[SweepNYC] ObjectId:', apiData && apiData.ObjectId, '| Notes type:', typeof apiData.Notes);
    if (!apiData?.Notes || !apiData?.ObjectId) {
      console.warn('[SweepNYC] missing Notes or ObjectId — no data at this location');
      return { success: false, reason: 'no_sweepnyc_data' };
    }

    const objectId = String(apiData.ObjectId);
    const docId = `nyc_${objectId}`;

    // ── Dedup: cslSegmentId index first, then deterministic doc ID ───────────────
    const existingSnap = await db.collection('streetSegments')
      .where('cslSegmentId', '==', objectId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const d = existingSnap.docs[0].data();
      if (d.status === 'archived') return { success: false, reason: 'archived_segment' };
      const ps = _detectCardinalSide(lat, lng, d.fromLat, d.fromLng, d.toLat, d.toLng, d.bearing ?? 90);
      return {
        success: true,
        segmentId: existingSnap.docs[0].id,
        parkingSide: ps,
        streetName: d.streetName,
        _diag: { stage: 'dedup_index', geometrySource: 'existing', segmentStatus: d.status ?? null, signsCount: null, parsedCount: null, parseFailureCount: null, extractedStreetName: null, extractedSide: ps },
      };
    }

    // Secondary dedup: deterministic doc ID (handles race before index propagates)
    const byDocIdSnap = await db.doc(`streetSegments/${docId}`).get();
    if (byDocIdSnap.exists) {
      const d = byDocIdSnap.data();
      if (d.status === 'archived') return { success: false, reason: 'archived_segment' };
      const ps = _detectCardinalSide(lat, lng, d.fromLat, d.fromLng, d.toLat, d.toLng, d.bearing ?? 90);
      return {
        success: true,
        segmentId: docId,
        parkingSide: ps,
        streetName: d.streetName,
        _diag: { stage: 'dedup_docid', geometrySource: 'existing', segmentStatus: d.status ?? null, signsCount: null, parsedCount: null, parseFailureCount: null, extractedStreetName: null, extractedSide: ps },
      };
    }

    // ── Parse sign texts ──────────────────────────────────────────────────────────
    let notes;
    try {
      notes = typeof apiData.Notes === 'string' ? JSON.parse(apiData.Notes) : apiData.Notes;
    } catch {
      console.warn('[SweepNYC] failed to parse Notes JSON');
      return { success: false, reason: 'parse_failed', _diag: { stage: 'notes', errorMessage: 'Notes JSON parse failed' } };
    }
    if (notes === null || typeof notes !== 'object') {
      console.warn('[SweepNYC] Notes is null or non-object:', notes);
      return {
        success: false,
        reason: 'no_sweepnyc_notes',
        _diag: {
          stage: 'notes',
          sweepStatus: apiData.Status ?? null,
          responseKeys: Object.keys(apiData || {}).join(', '),
          notesType: notes === null ? 'null' : typeof notes,
          errorMessage: 'SweepNYC Notes missing or null',
        },
      };
    }
    console.log('[SweepNYC] Notes keys:', Object.keys(notes).join(', '));
    const signsRaw = Array.isArray(notes.Signs) ? notes.Signs : [];
    console.log('[SweepNYC] Signs count:', signsRaw.length, '| first 3:', JSON.stringify(signsRaw.slice(0, 3)));
    if (!signsRaw.length) {
      return {
        success: false,
        reason: 'no_signs',
        _diag: { stage: 'signs', signsCount: 0, errorMessage: 'SweepNYC Signs missing or empty' },
      };
    }

    const streetCtx = _extractStreetContext(apiData, notes);
    console.log('[SweepNYC] streetCtx:', JSON.stringify(streetCtx));
    console.log('[SweepNYC] SideOfStreet fields — apiData.SideOfStreet:', apiData.SideOfStreet ?? null, '| apiData.SideName:', apiData.SideName ?? null, '| apiData.Side:', apiData.Side ?? null, '| notes.SideOfStreet:', notes.SideOfStreet ?? null, '| streetCtx.side:', streetCtx.side ?? null);

    // ── Parse signs (try/catch prevents INTERNAL on bad sign shapes) ─────────────
    const parsed = [];
    const failurePromises = [];
    try {
      for (const sign of signsRaw) {
        const signText = sign && typeof sign.SignText === 'string' ? sign.SignText : null;
        const result = _parseSweepNYCSign(signText, streetCtx);
        if (result) {
          parsed.push(result);
        } else {
          console.warn('[SweepNYC] sign parse failed:', signText);
          if (signText) {
            failurePromises.push(
              _logParseFailure(String(apiData.Notes ?? ''), objectId, signText, lat, lng, PARSER_VERSION).catch(() => {}),
            );
          }
        }
      }
    } catch (signErr) {
      console.error('[SweepNYC] signs loop error:', sanitizeError(signErr));
      return { success: false, reason: 'parse_failed', _diag: { stage: 'signs_loop', error: sanitizeError(signErr) } };
    }
    console.log('[SweepNYC] parsed', parsed.length, '/', signsRaw.length, 'signs');
    Promise.all(failurePromises).catch(() => {});

    if (!parsed.length) {
      return { success: false, reason: 'parse_failed', _diag: { stage: 'parse', signsCount: signsRaw.length, parsedCount: 0, extractedStreetName: streetCtx.street, extractedSide: streetCtx.side } };
    }

    // ── Street geometry ───────────────────────────────────────────────────────────
    const first = parsed[0];
    const streetNameForGeo = streetCtx.street || first.street;
    console.log('[SweepNYC] fetching OSM geometry for street:', streetNameForGeo);
    let fromLat, fromLng, toLat, toLng, bearing, geometrySource;
    try {
      const geo = streetNameForGeo && streetNameForGeo !== 'Unknown Street'
        ? await _fetchStreetGeometry(streetNameForGeo, lat, lng)
        : null;
      if (geo) {
        ({ fromLat, fromLng, toLat, toLng, bearing } = geo);
        geometrySource = 'osm';
        console.log('[SweepNYC] OSM geometry found for:', streetNameForGeo);
      } else {
        // Fallback: synthetic segment centered on tested lat/lng.
        // Stored as needs_review so admins can verify before it's treated as authoritative.
        const HALF = 0.0005; // ~55 m
        fromLat = lat - HALF; fromLng = lng;
        toLat = lat + HALF; toLng = lng;
        bearing = 0;
        geometrySource = 'fallback';
        console.warn('[SweepNYC] OSM geometry not found for "' + streetNameForGeo + '" — using coordinate fallback, status=needs_review');
      }
    } catch (geoErr) {
      console.error('[SweepNYC] geometry error:', sanitizeError(geoErr));
      return { success: false, reason: 'geometry_failed', _diag: { stage: 'geometry', error: sanitizeError(geoErr) } };
    }

    const centerLat = (fromLat + toLat) / 2;
    const centerLng = (fromLng + toLng) / 2;
    let geohash;
    try {
      geohash = geohashForLocation([centerLat, centerLng], 9);
    } catch (hashErr) {
      console.error('[SweepNYC] geohash error:', sanitizeError(hashErr));
      return { success: false, reason: 'geometry_failed', _diag: { stage: 'geohash', centerLat, centerLng } };
    }

    // Cardinal side: only reliable when OSM geometry is real; fallback uses API-extracted side or null.
    const parkingSide = geometrySource === 'osm'
      ? _detectCardinalSide(lat, lng, fromLat, fromLng, toLat, toLng, bearing)
      : (streetCtx.side || null);

    const now = Timestamp.now();
    const segmentStatus = geometrySource === 'fallback' ? 'needs_review' : 'active';
    const provenance = {
      provider: 'sweepnyc',
      sweepNYCObjectId: apiData.ObjectId,
      fetchedAt: now,
      parserVersion: PARSER_VERSION,
      rawSignTexts: signsRaw.map(s => (s && s.SignText) || ''),
      geometrySource,
      refreshedAt: null,
      refreshCount: 0,
    };

    // ── Write segment + rules (try/catch prevents INTERNAL on Firestore errors) ───
    try {
      const segRef = db.doc(`streetSegments/${docId}`);
      await segRef.set({
        cityId: 'nyc',
        streetName: streetCtx.street || first.street,
        fromCross: streetCtx.fromCross || first.fromCross,
        toCross: streetCtx.toCross || first.toCross,
        borough: _detectBorough(lat, lng),
        fromLat, fromLng, toLat, toLng,
        centerLat, centerLng, bearing,
        geohash,
        evenSideIsPositiveCross: false,
        cslSegmentId: objectId,
        externalSegmentId: objectId,
        source: 'sweepnyc',
        provenance,
        status: segmentStatus,
        confidenceScore: geometrySource === 'osm' ? 0.95 : 0.6,
        confidence: {
          level: 'community',
          source: 'nyc_open_data',
          lastVerifiedAt: now,
          communityConfirmations: 0,
        },
        editedBy: 'system:sweepnyc',
        createdAt: now,
        updatedAt: now,
      });

      await segRef.collection('streetRules').doc('sweepnyc_v1').set({
        type: 'streetCleaning',
        effectiveDate: now,
        supersededAt: null,
        status: 'active',
        schedules: parsed.map(p => {
          const s = { side: p.side, days: p.days, startTime: p.startTime, endTime: p.endTime };
          if (p.ruleType) s.ruleType = p.ruleType;
          return s;
        }),
        source: 'sweepnyc',
        provenance,
        lastSourceSync: new Date().toISOString(),
        createdAt: now,
        updatedAt: now,
      });
    } catch (writeErr) {
      console.error('[SweepNYC] Firestore write error:', sanitizeError(writeErr));
      return { success: false, reason: 'firestore_write_failed', _diag: { stage: 'write', error: sanitizeError(writeErr) } };
    }

    const finalStreetName = streetCtx.street || first.street;
    console.log('[SweepNYC] wrote segment', docId, '| status:', segmentStatus, '| parkingSide:', parkingSide, '| geometrySource:', geometrySource);
    return {
      success: true,
      segmentId: docId,
      parkingSide,
      streetName: finalStreetName,
      _diag: {
        stage: 'complete',
        geometrySource,
        segmentStatus,
        signsCount: signsRaw.length,
        parsedCount: parsed.length,
        parseFailureCount: failurePromises.length,
        extractedStreetName: streetCtx.street,
        extractedSide: streetCtx.side,
      },
    };
    } catch (topErr) {
      console.error('[SweepNYC] top-level unhandled error:', sanitizeError(topErr));
      return {
        success: false,
        reason: 'unknown_error',
        _diag: {
          stage: 'top_level',
          errorName: topErr && topErr.name,
          errorMessage: topErr && topErr.message,
        },
      };
    }
}

// SweepNYC failure reasons that should trigger the NYC Open Data fallback.
// archived_segment and geometry_failed are NOT included — those are definitive or unrelated.
const _SWEEPNYC_FALLBACK_REASONS = new Set([
  'no_sweepnyc_data', 'no_sweepnyc_notes', 'no_signs', 'parse_failed',
]);

exports.createSegmentFromSweepNYC = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const uid = request.auth.uid;
    await checkRateLimit(uid, 'createSegmentFromSweepNYC', { limit: 30, windowSec: 3600 });

    const { lat, lng } = request.data || {};
    if (typeof lat !== 'number' || typeof lng !== 'number')
      throw new HttpsError('invalid-argument', 'lat and lng must be numbers.');
    if (lat < 40.4 || lat > 40.95 || lng < -74.3 || lng > -73.65)
      throw new HttpsError('invalid-argument', 'Coordinates outside NYC bounds.');

    try {
      if (_callableHooks.sweepNYCResult) {
        return await _callableHooks.sweepNYCResult(lat, lng);
      }
      const sweepResult = await _tryCreateFromSweepNYC(lat, lng);
      if (sweepResult.success) return sweepResult;
      if (!_SWEEPNYC_FALLBACK_REASONS.has(sweepResult.reason)) return sweepResult;
      console.log('[SweepNYC→NYCOpenData] falling back, sweepReason:', sweepResult.reason);
      return await _fallbackToNYCOpenData(lat, lng);
    } catch (err) {
      console.error('[createSegmentFromSweepNYC] top-level error:', sanitizeError(err));
      return { success: false, reason: 'unknown_error', _diag: { error: sanitizeError(err) } };
    }
  }
);

// ── NYC Open Data fallback helpers ───────────────────────────────────────────

/** Returns true only for active ASP (Alternate Side Parking) sign descriptions. */
function _isASPSign(signDesc) {
  if (!signDesc) return false;
  const upper = signDesc.toUpperCase();
  return upper.startsWith('NO PARKING') && /\d+(?::\d+)?\s*[AP]M/i.test(signDesc);
}

/**
 * Queries OSM via Overpass for named highway ways near lat/lng and returns
 * up to 2 DOT-normalized cross-street names (excluding the main street itself).
 * Used to score NYC Open Data block-face candidates.
 */
async function _fetchCrossStreets(lat, lng, mainStreetOsmName) {
  const delta = 0.0012; // ~130 m — tight enough to stay within one block
  const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`;
  const q = `[out:json][timeout:8];way[highway][name](${bbox});out geom;`;
  try {
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!data.elements?.length) return [];
    const mainDot = osmNameToDOT(mainStreetOsmName);
    // Filter out the main street; keep crossing named ways
    const others = data.elements.filter(el =>
      el.tags?.name && el.geometry?.length >= 2 && osmNameToDOT(el.tags.name) !== mainDot
    );
    // Sort by midpoint proximity to user
    others.sort((a, b) => {
      const mA = a.geometry[Math.floor(a.geometry.length / 2)];
      const mB = b.geometry[Math.floor(b.geometry.length / 2)];
      return ((mA.lat - lat) ** 2 + (mA.lon - lng) ** 2) - ((mB.lat - lat) ** 2 + (mB.lon - lng) ** 2);
    });
    // Collect up to 2 unique DOT names
    const seen = new Set();
    const result = [];
    for (const el of others) {
      const d = osmNameToDOT(el.tags.name);
      if (!seen.has(d)) { seen.add(d); result.push(d); if (result.length === 2) break; }
    }
    console.log('[NYCOpenData] cross streets detected:', result);
    return result;
  } catch (err) {
    console.warn('[NYCOpenData] cross-street fetch error:', sanitizeError(err));
    return [];
  }
}

/** Reverse geocodes lat/lng via Nominatim → OSM road name. */
async function _reverseGeocodeStreet(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ParkQueenApp/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    return (data && data.address && data.address.road) || null;
  } catch (err) {
    console.warn('[NYCOpenData] reverse geocode error:', sanitizeError(err));
    return null;
  }
}

/**
 * Queries NYC Open Data nfid-uabd for sign records matching a LIKE street pattern in a borough.
 * Paginates up to 3000 rows to handle long avenues (Broadway, 3rd Ave, Grand Concourse).
 */
async function _queryNYCOpenData(likePattern, borough) {
  const BASE = 'https://data.cityofnewyork.us/resource/nfid-uabd.json';
  const token = process.env.SOCRATA_APP_TOKEN || '';
  if (!token) console.warn('[NYCOpenData] SOCRATA_APP_TOKEN not set — using unauthenticated rate limit');

  const PAGE = 1000;
  const MAX_PAGES = 3;
  const rows = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      $where: `record_type='Current' AND borough='${borough}' AND street LIKE '${likePattern}'`,
      $limit: String(PAGE),
      $offset: String(page * PAGE),
      $order: 'objectid ASC',
    });
    if (token) params.set('$$app_token', token);

    try {
      const res = await fetch(`${BASE}?${params}`, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) {
        console.warn('[NYCOpenData] API error:', res.status);
        break;
      }
      const batch = await res.json();
      if (!Array.isArray(batch) || !batch.length) break;
      rows.push(...batch);
      if (batch.length < PAGE) break;
    } catch (err) {
      console.warn('[NYCOpenData] fetch error page', page, ':', sanitizeError(err));
      break;
    }
  }

  console.log('[NYCOpenData] fetched', rows.length, 'rows for pattern:', likePattern, 'borough:', borough);
  return rows;
}

/**
 * Main NYC Open Data fallback orchestrator.
 * Called when SweepNYC has no usable data for lat/lng.
 */
async function _fallbackToNYCOpenData(lat, lng) {
  try {
    const osmStreet = await _reverseGeocodeStreet(lat, lng);
    if (!osmStreet) {
      console.warn('[NYCOpenData] reverse geocode returned null — giving up');
      return { success: false, reason: 'no_sweepnyc_data' };
    }
    console.log('[NYCOpenData] OSM street:', osmStreet);

    const dotName = osmNameToDOT(osmStreet);
    const likePattern = streetNameToLikePattern(dotName);
    const boroughCode = _detectBorough(lat, lng);
    const borough = BOROUGH_CODE_TO_NAME[boroughCode] || null;
    if (!borough) {
      console.warn('[NYCOpenData] could not detect borough');
      return { success: false, reason: 'no_sweepnyc_data' };
    }
    console.log('[NYCOpenData] DOT name:', dotName, '| borough:', borough, '| pattern:', likePattern);

    const rows = await _queryNYCOpenData(likePattern, borough);
    const aspRows = rows.filter(r => _isASPSign(r.sign_description));
    console.log('[NYCOpenData] ASP rows:', aspRows.length, '/ total:', rows.length);
    if (!aspRows.length) {
      console.warn('[NYCOpenData] no ASP signs found');
      return { success: false, reason: 'no_sweepnyc_data' };
    }

    // Group by block face (from_street, to_street, side_of_street)
    const groups = {};
    for (const r of aspRows) {
      const key = `${r.from_street || ''}|${r.to_street || ''}|${r.side_of_street || ''}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    const groupKeys = Object.keys(groups);
    console.log('[NYCOpenData] block face candidates:', groupKeys.length, '| keys:', groupKeys.join(' / '));

    // Fetch cross streets for scoring (V1.2); falls back to [] if Overpass fails
    const crossStreets = await _fetchCrossStreets(lat, lng, osmStreet);
    console.log('[NYCOpenData] cross streets for scoring:', crossStreets);

    const selection = selectBlockFace(groups, crossStreets);
    if (!selection) {
      console.warn('[NYCOpenData] ambiguous block face — ' + groupKeys.length + ' candidates, crossStreets:', crossStreets, '— returning ambiguous.');
      return {
        success: false,
        reason: 'nyc_open_data_ambiguous_block',
        _diag: { stage: 'nyc_od_ambiguous', onStreet: dotName, borough, candidateCount: groupKeys.length, candidates: groupKeys, crossStreets },
      };
    }
    const { group: bestGroup, selectionReason, score: selectionScore } = selection;
    const fromStreet = bestGroup[0].from_street || null;
    const toStreet = bestGroup[0].to_street || null;
    const sideOfStreet = bestGroup[0].side_of_street || null;
    console.log('[NYCOpenData] block face selected:', selectionReason, '| from:', fromStreet, '| to:', toStreet, '| side:', sideOfStreet);

    // Dedup: deterministic doc ID keyed on block face — prevents broad street-level cache
    const docId = nycOdSegmentDocId(boroughCode, dotName, fromStreet, toStreet, sideOfStreet);
    const existingSnap = await db.doc(`streetSegments/${docId}`).get();
    if (existingSnap.exists) {
      const d = existingSnap.data();
      const ps = d.fromLat != null
        ? _detectCardinalSide(lat, lng, d.fromLat, d.fromLng, d.toLat, d.toLng, d.bearing ?? 90)
        : dotSideToCardinal(sideOfStreet);
      console.log('[NYCOpenData] dedup hit block-face segment:', docId);
      return { success: true, segmentId: docId, parkingSide: ps, streetName: d.streetName,
        _diag: { stage: 'dedup_nyc_od', provider: 'nyc_open_data', selectionReason } };
    }

    const PARSER_VERSION = '1.1';
    const streetCtx = {
      street: dotName,
      side: dotSideToCardinal(sideOfStreet) || null,
      fromCross: fromStreet,
      toCross: toStreet,
    };
    const parsed = [];
    for (const r of bestGroup) {
      const result = _parseSweepNYCSign(r.sign_description, streetCtx);
      if (result) parsed.push(result);
    }
    console.log('[NYCOpenData] parsed', parsed.length, '/', bestGroup.length, 'signs');
    if (!parsed.length) {
      return { success: false, reason: 'no_sweepnyc_data',
        _diag: { stage: 'nyc_od_parse', aspCount: aspRows.length, groupCount: groupKeys.length, selectionReason } };
    }

    let fromLat, fromLng, toLat, toLng, bearing, geometrySource;
    try {
      const geo = await _fetchStreetGeometry(osmStreet, lat, lng);
      if (geo) {
        ({ fromLat, fromLng, toLat, toLng, bearing } = geo);
        geometrySource = 'osm';
      } else {
        const HALF = 0.0005;
        fromLat = lat - HALF; fromLng = lng; toLat = lat + HALF; toLng = lng; bearing = 0;
        geometrySource = 'fallback';
      }
    } catch (geoErr) {
      console.error('[NYCOpenData] geometry error:', sanitizeError(geoErr));
      const HALF = 0.0005;
      fromLat = lat - HALF; fromLng = lng; toLat = lat + HALF; toLng = lng; bearing = 0;
      geometrySource = 'fallback';
    }

    const centerLat = (fromLat + toLat) / 2;
    const centerLng = (fromLng + toLng) / 2;
    const geohash = geohashForLocation([centerLat, centerLng], 9);
    const parkingSide = geometrySource === 'osm'
      ? _detectCardinalSide(lat, lng, fromLat, fromLng, toLat, toLng, bearing)
      : streetCtx.side;

    const now = Timestamp.now();
    const sourceOrderNumbers = bestGroup.map(r => r.order_no || r.objectid).filter(Boolean);
    const provenance = {
      provider: 'nyc_open_data',
      fetchedAt: now,
      parserVersion: PARSER_VERSION,
      rawSignTexts: bestGroup.map(r => r.sign_description || ''),
      geometrySource,
      sourceOrderNumbers,
      refreshedAt: null,
      refreshCount: 0,
    };

    const segRef = db.doc(`streetSegments/${docId}`);
    await segRef.set({
      cityId: 'nyc',
      streetName: dotName,
      onStreet: dotName,
      fromStreet,
      toStreet,
      sideOfStreet,
      fromCross: fromStreet,
      toCross: toStreet,
      borough: boroughCode,
      fromLat, fromLng, toLat, toLng,
      centerLat, centerLng, bearing,
      geohash,
      evenSideIsPositiveCross: false,
      source: 'nyc_open_data',
      provenance,
      needsReview: true,
      status: 'needs_review',
      confidenceScore: 0.5,
      confidence: {
        level: 'unverified',
        source: 'nyc_open_data',
        lastVerifiedAt: now,
        communityConfirmations: 0,
      },
      editedBy: 'system:nyc_open_data',
      createdAt: now,
      updatedAt: now,
    });

    await segRef.collection('streetRules').doc('nyc_open_data_v1').set({
      type: 'streetCleaning',
      effectiveDate: now,
      supersededAt: null,
      status: 'active',
      schedules: parsed.map(p => {
        const s = { side: p.side, days: p.days, startTime: p.startTime, endTime: p.endTime };
        if (p.ruleType) s.ruleType = p.ruleType;
        return s;
      }),
      source: 'nyc_open_data',
      provenance,
      needsReview: true,
      lastSourceSync: new Date().toISOString(),
      createdAt: now,
      updatedAt: now,
    });

    console.log('[NYCOpenData] wrote segment', docId, '| parkingSide:', parkingSide, '| geometrySource:', geometrySource, '| selectionReason:', selectionReason);
    return {
      success: true,
      segmentId: docId,
      parkingSide,
      streetName: dotName,
      _diag: {
        stage: 'nyc_od_complete',
        provider: 'nyc_open_data',
        geometrySource,
        selectionReason,
        selectionScore,
        crossStreets,
        onStreet: dotName,
        fromStreet,
        toStreet,
        sideOfStreet,
        aspCount: aspRows.length,
        parsedCount: parsed.length,
        needsReview: true,
      },
    };
  } catch (err) {
    console.error('[NYCOpenData] fallback error:', sanitizeError(err));
    return { success: false, reason: 'unknown_error',
      _diag: { stage: 'nyc_od_top', error: sanitizeError(err) } };
  }
}

// ── Private helpers used by createSegmentFromSweepNYC ────────────────────────

const _DAY_ABBR = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  // lowercase full names
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
  // uppercase abbreviations already canonical
  MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun',
};

function _parseFlexibleTime(t) {
  // Accepts: "8 AM", "8:30AM", "8:30 A.M.", "10 PM", "10:00 PM"
  const clean = t.replace(/\./g, '').replace(/\s+/g, '').toUpperCase();
  const m = clean.match(/^(\d+)(?::(\d+))?(AM|PM)$/);
  if (!m) return '00:00';
  let h = parseInt(m[1]);
  const min = m[2] ? parseInt(m[2]) : 0;
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function _extractStreetContext(apiData, notes) {
  // Try top-level API fields first (SweepNYC may expose them directly)
  const street = apiData.StreetName || apiData.OnStreet || apiData.Street ||
                 (notes && (notes.StreetName || notes.OnStreet)) || null;
  const fromCross = apiData.FromStreet || (notes && notes.FromStreet) || null;
  const toCross = apiData.ToStreet || (notes && notes.ToStreet) || null;
  // Side: SideOfStreet, SideName, Side
  const sideRaw = apiData.SideOfStreet || apiData.SideName || apiData.Side ||
                  (notes && (notes.SideOfStreet || notes.SideName || notes.Side)) || null;
  const SIDE_MAP = { N: 'North', S: 'South', E: 'East', W: 'West', NORTH: 'North', SOUTH: 'South', EAST: 'East', WEST: 'West' };
  const side = sideRaw ? (SIDE_MAP[String(sideRaw).toUpperCase()] || sideRaw) : null;
  return { street, fromCross, toCross, side };
}

// Maps "Except Sunday" / "Except Sunday and Holidays" → the days that DO apply.
// Unrecognised tokens (Holidays, Public, etc.) are silently ignored.
function _exceptDaysToDays(exceptStr) {
  const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const excluded = new Set();
  for (const t of exceptStr.split(/\s+and\s+|\s*,\s*|\s+/)) {
    const abbr = _DAY_ABBR[t] || _DAY_ABBR[t.toLowerCase()];
    if (abbr) excluded.add(abbr);
  }
  return ALL_DAYS.filter(d => !excluded.has(d));
}

const _SIDE_MAP = { N: 'North', S: 'South', E: 'East', W: 'West', NORTH: 'North', SOUTH: 'South', EAST: 'East', WEST: 'West' };

function _parseSweepNYCSign(signText, streetCtx) {
  if (!signText) return null;
  const ctx = streetCtx || {};

  // Branch 1: Classic ASP — "No Parking <days> <time>-<time> [on <street> ...] [(Side: X)]"
  const m = signText.match(
    /No Parking\s+(.+?)\s+(\d+(?::\d+)?\s*[AP]\.?M\.?)\s*[-–]\s*(\d+(?::\d+)?\s*[AP]\.?M\.?)(?:\s+on\s+(.+?)(?:\s+from\s+(.+?)\s+to\s+(.+?))?)?(?:\s+\(Side:\s*(\w+)\))?$/i,
  );

  if (m) {
    const [, daysRaw, startRaw, endRaw, streetInSign, fromCrossInSign, toCrossInSign, sideInSign] = m;
    const dayTokens = daysRaw.trim().split(/[\s,]+/).map(d => d.trim()).filter(Boolean);
    const days = dayTokens
      .map(d => _DAY_ABBR[d] || _DAY_ABBR[d.toUpperCase()] || (d.length <= 3 ? d.charAt(0).toUpperCase() + d.slice(1).toLowerCase() : null))
      .filter(Boolean);
    if (!days.length) return null;
    const sideRaw = ctx.side || sideInSign || null;
    return {
      street: ctx.street || streetInSign || 'Unknown Street',
      fromCross: ctx.fromCross || fromCrossInSign || null,
      toCross: ctx.toCross || toCrossInSign || null,
      side: sideRaw ? (_SIDE_MAP[String(sideRaw).toUpperCase()] || sideRaw) : null,
      days,
      startTime: _parseFlexibleTime(startRaw),
      endTime: _parseFlexibleTime(endRaw),
    };
  }

  // Branch 2: Metered short window — "No Parking <time>-<time> Except <days> on <street> [from <cross> to <cross>] [(Side: X)]"
  // e.g. "No Parking 8:30AM-9AM Except Sunday on Maran Place from White Plains Road to Cruger Avenue (Side: South)"
  const m2 = signText.match(
    /No Parking\s+(\d+(?::\d+)?\s*[AP]\.?M\.?)\s*[-–]\s*(\d+(?::\d+)?\s*[AP]\.?M\.?)\s+Except\s+(.+?)\s+on\s+(.+?)(?:\s+from\s+(.+?)\s+to\s+(.+?))?(?:\s+\(Side:\s*(\w+)\))?$/i,
  );

  if (!m2) return null;

  const [, startRaw2, endRaw2, exceptPart, streetInSign2, fromCrossInSign2, toCrossInSign2, sideInSign2] = m2;
  const days2 = _exceptDaysToDays(exceptPart);
  if (!days2.length) return null;

  const sideRaw2 = ctx.side || sideInSign2 || null;
  return {
    street: ctx.street || streetInSign2 || 'Unknown Street',
    fromCross: ctx.fromCross || fromCrossInSign2 || null,
    toCross: ctx.toCross || toCrossInSign2 || null,
    side: sideRaw2 ? (_SIDE_MAP[String(sideRaw2).toUpperCase()] || sideRaw2) : null,
    days: days2,
    startTime: _parseFlexibleTime(startRaw2),
    endTime: _parseFlexibleTime(endRaw2),
    ruleType: 'metered_no_parking_window',
  };
}

function _computeBearing(fromLat, fromLng, toLat, toLng) {
  const dLon = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

async function _fetchStreetGeometry(streetName, lat, lng) {
  const delta = 0.003;
  const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`;
  const q = `[out:json][timeout:10];way[name="${streetName}"](${bbox});out geom;`;
  try {
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!data.elements?.length) return null;
    // Use the single way closest to (lat, lng) — prevents multi-block bearing errors from aggregating all ways
    const validWays = data.elements.filter(el => el.geometry && el.geometry.length >= 2);
    if (!validWays.length) return null;
    const closestWay = validWays.reduce((best, el) => {
      const mid = el.geometry[Math.floor(el.geometry.length / 2)];
      const d = (mid.lat - lat) ** 2 + (mid.lon - lng) ** 2;
      return (!best || d < best.d) ? { el, d } : best;
    }, null);
    const wayNodes = closestWay.el.geometry;
    if (wayNodes.length < 2) return null;
    let fromLat = wayNodes[0].lat, fromLng = wayNodes[0].lon;
    let toLat = wayNodes[wayNodes.length - 1].lat, toLng = wayNodes[wayNodes.length - 1].lon;
    let bearing = _computeBearing(fromLat, fromLng, toLat, toLng);
    if (bearing > 180) {
      [fromLat, toLat] = [toLat, fromLat];
      [fromLng, toLng] = [toLng, fromLng];
      bearing = _computeBearing(fromLat, fromLng, toLat, toLng);
    }
    return { fromLat, fromLng, toLat, toLng, bearing };
  } catch {
    return null;
  }
}

function _detectBorough(lat, lng) {
  if (lat > 40.785 && lng > -73.935) return 'BX';
  if (lng < -74.03) return 'SI';
  if (lat < 40.648) return 'BK';
  if (lng > -73.948 && lat < 40.775) return 'QN';
  return 'MN';
}

function _detectCardinalSide(userLat, userLng, fromLat, fromLng, toLat, toLng, bearing) {
  const dx = toLng - fromLng;
  const dy = toLat - fromLat;
  const cross = dx * (userLat - fromLat) - dy * (userLng - fromLng);
  const isPositive = cross > 0;
  if (bearing < 45) return isPositive ? 'West' : 'East';
  if (bearing < 135) return isPositive ? 'North' : 'South';
  return isPositive ? 'East' : 'West';
}

async function _logParseFailure(rawNotes, sweepNYCObjectId, rawSignText, lat, lng, parserVersion) {
  const normalized = rawSignText.trim().replace(/\s+/g, ' ');
  const b64 = Buffer.from(encodeURIComponent(normalized)).toString('base64');
  const docId = `${b64.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}_v${parserVersion.replace(/\./g, '_')}`;
  const failureRef = db.doc(`parseFailures/${docId}`);
  const existing = await failureRef.get();
  if (existing.exists) {
    await failureRef.update({ count: FieldValue.increment(1), lastSeenAt: Timestamp.now(), lat, lng, sweepNYCObjectId });
  } else {
    await failureRef.set({
      rawSignText: normalized,
      rawNotes,
      sweepNYCObjectId,
      lat, lng,
      parserVersion,
      count: 1,
      firstSeenAt: Timestamp.now(),
      lastSeenAt: Timestamp.now(),
      resolvedAt: null,
    });
  }
}

// ─── Gemini AI — server-side proxy ───────────────────────────────────────────
// Key stored in Secret Manager; never exposed to the browser bundle.

const GEMINI_MODEL = "gemini-3.5-flash";

function classifyGeminiError(fn, err) {
  const status = err?.status ?? err?.error?.code;
  const grpcStatus = err?.error?.status ?? "";
  let code, clientMessage;
  if (status === 429 || grpcStatus === "RESOURCE_EXHAUSTED") {
    code = "resource-exhausted";
    clientMessage = "The AI service is temporarily unavailable. Please try again shortly.";
  } else if (status === 400 || grpcStatus === "INVALID_ARGUMENT") {
    code = "invalid-argument";
    clientMessage = "The request could not be processed. Check the image or input.";
  } else if (status === 401 || status === 403 || grpcStatus === "PERMISSION_DENIED" || grpcStatus === "UNAUTHENTICATED") {
    code = "failed-precondition";
    clientMessage = "The AI service is temporarily unavailable. Please try again shortly.";
  } else if (status === 404 || grpcStatus === "NOT_FOUND") {
    code = "failed-precondition";
    clientMessage = "The AI service is temporarily unavailable. Please try again shortly.";
  } else if (status === 503 || grpcStatus === "UNAVAILABLE") {
    code = "unavailable";
    clientMessage = "The AI service is temporarily unavailable. Please try again shortly.";
  } else {
    code = "internal";
    clientMessage = "The AI service is temporarily unavailable. Please try again shortly.";
  }
  console.error(`[${fn}] Gemini error — model:${GEMINI_MODEL} http:${status} grpc:${grpcStatus}`);
  throw new HttpsError(code, clientMessage);
}

exports.analyzeSign = onCall(
  { secrets: [geminiApiKey], enforceAppCheck: false },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");
    await checkRateLimit(request.auth.uid, 'analyzeSign', { limit: 30, windowSec: 3600 });
    const { imageBase64 } = request.data;
    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      throw new HttpsError("invalid-argument", "imageBase64 is required.");
    }
    // ~4MB limit: base64 encodes 3 bytes as 4 chars, so 4MB raw ≈ 5.5M chars
    if (imageBase64.length > 5_500_000) {
      throw new HttpsError("invalid-argument", "Image too large. Maximum 4 MB.");
    }
    let response;
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            {
              text: `You are a NYC parking expert. Analyze this parking sign image.
Crucially, there may be MULTIPLE stacked signs on this pole. Read all of them carefully. Resolve any conflicting rules (e.g. temporary construction signs override permanent signs).
Respond strictly in JSON format with the following structure:
{
  "status": "YES", "NO", or "CONDITIONAL",
  "explanation": "A one sentence explanation of the rules.",
  "restrictionStartsAt": "ISO timestamp or null if unknown/not applicable",
  "restrictionEndsAt": "ISO timestamp or null if unknown/not applicable",
  "actionableAdvice": "Short advice, e.g., 'Move car by 4 PM'"
}
Do not include Markdown formatting. Just output the raw JSON object.`,
            },
          ],
        },
      });
    } catch (err) {
      classifyGeminiError("analyzeSign", err);
    }
    const text = (response.text || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
    try {
      return JSON.parse(text);
    } catch {
      return { status: "ERROR", explanation: "Could not parse sign analysis response." };
    }
  }
);

exports.generateSmartReplies = onCall(
  { secrets: [geminiApiKey], enforceAppCheck: false },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");
    await checkRateLimit(request.auth.uid, 'generateSmartReplies', { limit: 20, windowSec: 3600 });
    const { lastMessage, context } = request.data;
    if (typeof lastMessage !== "string" || lastMessage.length === 0) {
      throw new HttpsError("invalid-argument", "lastMessage is required.");
    }
    if (lastMessage.length > 500) {
      throw new HttpsError("invalid-argument", "lastMessage must be 500 characters or fewer.");
    }
    if (context !== undefined && typeof context !== "string") {
      throw new HttpsError("invalid-argument", "context must be a string.");
    }
    const safeMessage = lastMessage.slice(0, 500);
    const safeContext = (typeof context === "string" ? context : "").slice(0, 2000);
    let response;
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `You are an AI assistant in a parking app called ParQueen.
The user just received this message: "${safeMessage}".
Context: ${safeContext}.
Generate 3 short, natural, polite responses (max 5 words each) that the user might want to send back.
Return them as a comma-separated list.`,
      });
    } catch (err) {
      classifyGeminiError("generateSmartReplies", err);
    }
    const text = response.text || "";
    return { replies: text.split(",").map((s) => s.trim()).slice(0, 3) };
  }
);

exports.generateListingDescription = onCall(
  { secrets: [geminiApiKey], enforceAppCheck: false },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");
    await checkRateLimit(request.auth.uid, 'generateListingDescription', { limit: 20, windowSec: 3600 });
    const { features } = request.data;
    if (!Array.isArray(features)) {
      throw new HttpsError("invalid-argument", "features array is required.");
    }
    let response;
    try {
      if (_callableHooks.geminiResponse) {
        response = await _callableHooks.geminiResponse(features);
      } else {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
        response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `Write a catchy, short marketing description (max 2 sentences) for a parking spot in NYC with these features: ${features.join(", ")}. Use a premium, trustworthy tone.`,
        });
      }
    } catch (err) {
      classifyGeminiError("generateListingDescription", err);
    }
    return { description: response.text || "A great parking spot in the heart of the city." };
  }
);
