const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { defineString } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");

initializeApp();
const db = getFirestore();
const { geohashForLocation } = require('geofire-common');
const sendgridApiKey = defineString("SENDGRID_API_KEY");

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

    const batch = db.batch();
    snap.docs.forEach((d) => {
      batch.update(d.ref, {
        status: "available",
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
        claimAutoReleasedAt: null,
      });
    });
    await batch.commit();
    console.log(`✅ cleanupExpiredInterests: reverted ${snap.size} spots`);
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
      if (!spot.interestedUserId) continue;

      const finderName = spot.finderName || "Someone";
      const message = `${finderName}'s spot opens soon — time to head over?`;

      // FCM push if token available
      const userSnap = await db.doc(`users/${spot.interestedUserId}`).get();
      const fcmToken = userSnap.exists ? userSnap.data().fcmToken : null;
      if (fcmToken) {
        try {
          await getMessaging().send({
            token: fcmToken,
            notification: { title: "🅿️ Spot opening soon", body: message },
            android: { priority: "high" },
            apns: { payload: { aps: { sound: "default", badge: 1 } } },
          });
        } catch (e) {
          console.error("FCM reminder failed for", spot.interestedUserId, e.message);
        }
      }

      // In-app notification (client listener shows it as a toast)
      await db.collection("spotNotifications").add({
        targetUserId: spot.interestedUserId,
        type: "scheduled_claim_reminder",
        message,
        createdAt: now,
      });

      // Null out claimReminderAt so this doc never re-appears in the reminder query
      await d.ref.update({ claimReminderAt: null, claimReminderSentAt: now });
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

          if (spotExpired) {
            // Ping already expired — clear stale claim fields, don't revive to available
            tx.update(d.ref, clearFields);
          } else {
            tx.update(d.ref, { ...clearFields, status: "available" });
          }

          releasedInfo = {
            claimerId: spot.interestedUserId,
            finderId: spot.finderId || null,
            spotExpired,
          };
        });
      } catch (e) {
        console.error("Auto-release transaction failed for spot", d.id, e.message);
      }

      if (!releasedInfo) continue;

      // Notify claimer
      await db.collection("spotNotifications").add({
        targetUserId: releasedInfo.claimerId,
        type: "scheduled_claim_auto_released",
        message: "Your claim was released because you didn't confirm you were heading over.",
        createdAt: now,
      });

      // Notify owner only if spot is still live (not expired)
      if (releasedInfo.finderId && !releasedInfo.spotExpired) {
        await db.collection("spotNotifications").add({
          targetUserId: releasedInfo.finderId,
          type: "scheduled_claim_released_owner",
          message: "Your spot is available again because the claim expired.",
          createdAt: now,
        });
      }
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
  async () => {
    const statsRef = db.doc("stats/global");
    await statsRef.set(
      { totalSpotsPinged: FieldValue.increment(1) },
      { merge: true }
    );
  }
);

// Haversine distance in miles
function haversineDistMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 3) Geofenced Notifications for Nearby Users
exports.notifyNearbyUsers = onDocumentCreated(
  {
    document: "spots/{spotId}",
    region: "us-central1",
  },
  async (event) => {
    const spotData = event.data.data();
    if (!spotData || !spotData.geohash) return;

    const spotGeohash = spotData.geohash;
    // 4-char prefix ≈ 20km coarse filter, then precise distance check
    const prefix = spotGeohash.substring(0, 4);

    try {
      const neighborsSnap = await db.collection("users")
          .where("lastGeohash", ">=", prefix)
          .where("lastGeohash", "<=", prefix + "\uf8ff")
          .get();

      const messages = [];
      neighborsSnap.forEach(userDoc => {
          const userData = userDoc.data();
          if (userDoc.id === spotData.finderId) return;
          if (!userData.fcmToken) return;
          if (userData.notificationsEnabled === false) return;

          // Skip users with stale location — prevents cross-borough false positives
          if (!userData.lastGeohash) return;
          const geohashAge = userData.lastGeohashUpdatedAt ? Date.now() - userData.lastGeohashUpdatedAt.toMillis() : Infinity;
          if (geohashAge > 24 * 60 * 60 * 1000) return;
          const geofire = require("geofire-common");
          const [userLat, userLng] = geofire.geohashToLocation(userData.lastGeohash);
          const distMiles = haversineDistMiles(userLat, userLng, spotData.lat, spotData.lng);
          const userRadius = userData.notificationRadius || 1;
          if (distMiles > userRadius) return;

          const distLabel = distMiles < 0.1 ? 'right next to you' : '~' + distMiles.toFixed(1) + ' mi away';
          messages.push({
              token: userData.fcmToken,
              notification: {
                  title: "👑 New Spot Near You!",
                  body: "Someone just left a spot " + distLabel + "."
              },
              data: { spotId: event.params.spotId, lat: String(spotData.lat), lng: String(spotData.lng), finderId: String(spotData.finderId || '') }
          });
      });

      if (messages.length > 0) {
          const response = await getMessaging().sendEach(messages);
          console.log("Geofence push: " + response.successCount + " sent, " + response.failureCount + " failed.");
      }
    } catch (error) {
      console.error("Error in notifyNearbyUsers:", error);
    }
  }
);

// 4) Generate and send email OTP
exports.generateEmailOTP = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
    const email = request.data?.email;
    if (!email || !email.includes("@")) throw new HttpsError("invalid-argument", "Valid email required.");

    const uid = request.auth.uid;
    const docRef = db.collection("emailVerificationCodes").doc(uid);
    const existing = await docRef.get();
    if (existing.exists) {
      const lastSent = existing.data().createdAt?.toMillis() || 0;
      if (Date.now() - lastSent < 60000) {
        throw new HttpsError("resource-exhausted", "Wait 60 seconds before requesting another code.");
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await docRef.set({ code, email, createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60000) });

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${sendgridApiKey.value()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: "hello@parqueen.app", name: "ParkQueen" },
        subject: "Your ParkQueen verification code",
        content: [{ type: "text/plain", value: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.` }],
      }),
    });
    if (!res.ok) {
      console.error("SendGrid error:", res.status, await res.text());
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
    const { email, code } = request.data || {};
    if (!email || !code) throw new HttpsError("invalid-argument", "Email and code required.");

    const uid = request.auth.uid;
    const docRef = db.collection("emailVerificationCodes").doc(uid);
    const snap = await docRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "No verification code found. Request a new one.");

    const data = snap.data();
    if (data.email !== email) throw new HttpsError("invalid-argument", "Email does not match.");
    if (data.code !== code) throw new HttpsError("invalid-argument", "Invalid code.");
    if (Date.now() > data.expiresAt.toMillis()) {
      await docRef.delete();
      throw new HttpsError("deadline-exceeded", "Code expired. Request a new one.");
    }

    await docRef.delete();
    await db.collection("users").doc(uid).update({ email, emailVerified: true });
    return { success: true };
  }
);

// 6) Moderate avatar uploads via Vision SafeSearch
exports.moderateAvatarUpload = onObjectFinalized(
  { region: "us-central1", memory: "512MiB" },
  async (event) => {
    const filePath = event.data.name;
    if (!filePath.startsWith("avatars/")) return;

    const uid = filePath.split("/")[1];
    const moderationRef = db.collection("avatarModeration").doc(uid);
    await moderationRef.set({ status: "checking", updatedAt: Timestamp.now() });

    try {
      const vision = require("@google-cloud/vision");
      const client = new vision.ImageAnnotatorClient();
      const bucket = getStorage().bucket(event.data.bucket);
      const file = bucket.file(filePath);

      const [result] = await client.safeSearchDetection(`gs://${event.data.bucket}/${filePath}`);
      const safe = result.safeSearchAnnotation;
      const flagged = ["LIKELY", "VERY_LIKELY"];
      const rejected = flagged.includes(safe.adult) || flagged.includes(safe.racy);

      if (rejected) {
        await file.delete().catch(() => {});
        await moderationRef.set({ status: "rejected", reason: "Content policy violation", updatedAt: Timestamp.now() });
        console.log(`Avatar rejected for user ${uid}: adult=${safe.adult}, racy=${safe.racy}`);
      } else {
        await moderationRef.set({ status: "approved", updatedAt: Timestamp.now() });
        console.log(`Avatar approved for user ${uid}`);
      }
    } catch (error) {
      console.error("Vision API error:", error);
      await moderationRef.set({ status: "approved", updatedAt: Timestamp.now() });
    }
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
        if (existing.exists) throw new HttpsError("already-exists", "Username is already taken.");

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
      console.error("Username claim error:", e);
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
    console.log(`Crowns awarded: driver ${driverId} +1 (${driverCrowns}), finder ${finderId} +2 (${finderCrowns})`);
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

    const existing = await db.collection('adminAuditLog')
      .where('action', '==', 'bootstrapAdmin')
      .limit(1)
      .get();
    if (!existing.empty) {
      throw new HttpsError('already-exists', 'Admin access has already been bootstrapped.');
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

// Delete account — Admin SDK bypasses the client-side reauthentication requirement
exports.deleteAccount = onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const auth = getAuth();
    const batch = db.batch();

    // Remove Firestore user doc
    batch.delete(db.doc(`users/${uid}`));

    // Remove username reservation if one exists
    const usernameSnap = await db.collection('usernames').where('uid', '==', uid).get();
    usernameSnap.forEach(d => batch.delete(d.ref));

    await batch.commit();

    // Delete the Auth account last — after Firestore cleanup
    await auth.deleteUser(uid);
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
        console.error('FCM send failed for session', d.id, e.message);
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

// 27) Create segment from SweepNYC — server-controlled lazy cache population.
// Called when the client finds no Firestore segment within 80m. Owns the full
// pipeline: SweepNYC API → parse → geometry → write segment + rules via Admin SDK.
// Normal signed-in users may call this; writes happen server-side so rules cannot
// be spoofed by a client-controlled `source` field.
exports.createSegmentFromSweepNYC = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { lat, lng } = request.data || {};
    if (typeof lat !== 'number' || typeof lng !== 'number')
      throw new HttpsError('invalid-argument', 'lat and lng must be numbers.');
    if (lat < 40.4 || lat > 40.95 || lng < -74.3 || lng > -73.65)
      throw new HttpsError('invalid-argument', 'Coordinates outside NYC bounds.');

    // Top-level catch prevents any data-shape/runtime error from becoming functions/internal.
    // Auth/argument HttpsErrors are thrown before this try, so they pass through normally.
    try {
    const SWEEPNYC_BASE = 'https://sweepnyc.nyc.gov/mappingapi/api';
    const PARSER_VERSION = '1.1';

    // ── SweepNYC API ─────────────────────────────────────────────────────────────
    const sweepUrl = `${SWEEPNYC_BASE}/highlight/sweepinfo?lat=${lat}&lon=${lng}&t=${Date.now()}&radius=0.1`;
    console.log('[SweepNYC] requesting lat=' + lat + ' lng=' + lng);
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
      console.warn('[SweepNYC] fetch error:', err && err.message);
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
      console.error('[SweepNYC] signs loop error:', signErr && signErr.message);
      return { success: false, reason: 'parse_failed', _diag: { stage: 'signs_loop', error: String(signErr) } };
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
      console.error('[SweepNYC] geometry error:', geoErr && geoErr.message);
      return { success: false, reason: 'geometry_failed', _diag: { stage: 'geometry', error: String(geoErr), streetNameForGeo } };
    }

    const centerLat = (fromLat + toLat) / 2;
    const centerLng = (fromLng + toLng) / 2;
    let geohash;
    try {
      geohash = geohashForLocation([centerLat, centerLng], 9);
    } catch (hashErr) {
      console.error('[SweepNYC] geohash error:', hashErr && hashErr.message);
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
      console.error('[SweepNYC] Firestore write error:', writeErr && writeErr.message);
      return { success: false, reason: 'firestore_write_failed', _diag: { stage: 'write', error: String(writeErr) } };
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
      console.error('[SweepNYC] top-level unhandled error:', (topErr && topErr.stack) || topErr);
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
);

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
