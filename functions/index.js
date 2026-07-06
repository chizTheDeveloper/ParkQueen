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
        etaMinutes: null,
        interestExpiresAt: null,
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
          if (userData.id === spotData.finderId) return;
          if (!userData.fcmToken) return;
          if (userData.notificationsEnabled === false) return;

          // Precise distance check against user's notification radius
          if (!userData.lastGeohash) return;
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
              data: { spotId: event.params.spotId, lat: String(spotData.lat), lng: String(spotData.lng) }
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

const RESERVED_USERNAMES = new Set([
  "admin", "support", "parqueen", "parkqueen", "system", "moderator",
  "official", "help", "info", "contact", "team", "staff", "root",
  "null", "undefined", "test", "api", "www", "app", "mod", "owner",
  "ceo", "founder", "parking", "driver", "police", "nypd", "nyc",
]);

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

    // Reserved words check (usernames only)
    if (!blocked && type === 'username' && RESERVED_USERNAMES.has(text.toLowerCase())) {
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

    // Reserved check
    if (RESERVED_USERNAMES.has(normalized)) throw new HttpsError("invalid-argument", "This username is not available.");

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
        tx.set(userRef, { username: trimmed, usernameChangedAt: Timestamp.now() }, { merge: true });
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

    const SWEEPNYC_BASE = 'https://sweepnyc.nyc.gov/mappingapi/api';
    const PARSER_VERSION = '1.0';

    // ── SweepNYC API ─────────────────────────────────────────────────────────────
    let apiData;
    try {
      const res = await fetch(
        `${SWEEPNYC_BASE}/highlight/sweepinfo?lat=${lat}&lon=${lng}&t=${Date.now()}&radius=0.5`,
      );
      if (!res.ok) return { success: false, reason: 'no_sweepnyc_data' };
      apiData = await res.json();
    } catch {
      return { success: false, reason: 'no_sweepnyc_data' };
    }

    if (!apiData?.Notes || !apiData?.ObjectId) return { success: false, reason: 'no_sweepnyc_data' };

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
      return {
        success: true,
        segmentId: existingSnap.docs[0].id,
        parkingSide: _detectCardinalSide(lat, lng, d.fromLat, d.fromLng, d.toLat, d.toLng, d.bearing ?? 90),
        streetName: d.streetName,
      };
    }

    // Secondary dedup: deterministic doc ID (handles race before index propagates)
    const byDocIdSnap = await db.doc(`streetSegments/${docId}`).get();
    if (byDocIdSnap.exists) {
      const d = byDocIdSnap.data();
      if (d.status === 'archived') return { success: false, reason: 'archived_segment' };
      return {
        success: true,
        segmentId: docId,
        parkingSide: _detectCardinalSide(lat, lng, d.fromLat, d.fromLng, d.toLat, d.toLng, d.bearing ?? 90),
        streetName: d.streetName,
      };
    }

    // ── Parse sign texts ──────────────────────────────────────────────────────────
    let notes;
    try { notes = JSON.parse(apiData.Notes); } catch { return { success: false, reason: 'parse_failed' }; }
    if (!notes.Signs?.length) return { success: false, reason: 'no_sweepnyc_data' };

    const parsed = [];
    const failurePromises = [];

    for (const sign of notes.Signs) {
      const result = _parseSweepNYCSign(sign.SignText);
      if (result) {
        parsed.push(result);
      } else {
        failurePromises.push(
          _logParseFailure(apiData.Notes, objectId, sign.SignText, lat, lng, PARSER_VERSION).catch(() => {}),
        );
      }
    }
    Promise.all(failurePromises).catch(() => {});

    if (!parsed.length) return { success: false, reason: 'parse_failed' };

    // ── Street geometry ───────────────────────────────────────────────────────────
    const first = parsed[0];
    const geo = await _fetchStreetGeometry(first.street, lat, lng);
    if (!geo) return { success: false, reason: 'geometry_failed' };

    const { fromLat, fromLng, toLat, toLng, bearing } = geo;
    const centerLat = (fromLat + toLat) / 2;
    const centerLng = (fromLng + toLng) / 2;
    const now = Timestamp.now();
    const geohash = geohashForLocation([centerLat, centerLng], 9);

    const provenance = {
      provider: 'sweepnyc',
      sweepNYCObjectId: apiData.ObjectId,
      fetchedAt: now,
      parserVersion: PARSER_VERSION,
      rawSignTexts: notes.Signs.map(s => s.SignText),
      refreshedAt: null,
      refreshCount: 0,
    };

    // ── Write segment (deterministic ID — idempotent if two requests race) ────────
    const segRef = db.doc(`streetSegments/${docId}`);
    await segRef.set({
      cityId: 'nyc',
      streetName: first.street,
      fromCross: first.fromCross,
      toCross: first.toCross,
      borough: _detectBorough(lat, lng),
      fromLat, fromLng, toLat, toLng,
      centerLat, centerLng, bearing,
      geohash,
      evenSideIsPositiveCross: false,
      cslSegmentId: objectId,
      externalSegmentId: objectId,
      source: 'sweepnyc',
      provenance,
      status: 'active',
      confidenceScore: 0.95,
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

    // ── Write rules (deterministic ID — idempotent if two requests race) ──────────
    await segRef.collection('streetRules').doc('sweepnyc_v1').set({
      type: 'streetCleaning',
      effectiveDate: now,
      supersededAt: null,
      status: 'active',
      schedules: parsed.map(p => ({ side: p.side, days: p.days, startTime: p.startTime, endTime: p.endTime })),
      source: 'sweepnyc',
      provenance,
      lastSourceSync: new Date().toISOString(),
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      segmentId: docId,
      parkingSide: _detectCardinalSide(lat, lng, fromLat, fromLng, toLat, toLng, bearing),
      streetName: first.street,
    };
  }
);

// ── Private helpers used by createSegmentFromSweepNYC ────────────────────────

const _DAY_ABBR = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

function _parseAmPmTime(t) {
  const m = t.match(/^(\d+)(?::(\d+))?\s*(AM|PM)$/i);
  if (!m) return '00:00';
  let h = parseInt(m[1]);
  const min = m[2] ? parseInt(m[2]) : 0;
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function _parseSweepNYCSign(signText) {
  const m = signText.match(
    /^No Parking (.+?) (\d+(?::\d+)?\s*[AP]M)-(\d+(?::\d+)?\s*[AP]M) on (.+?) from (.+?) to (.+?) \(Side: (\w+)\)$/i,
  );
  if (!m) return null;
  const [, daysRaw, startRaw, endRaw, street, fromCross, toCross, side] = m;
  const days = daysRaw.split(/,\s*/).map(d => (_DAY_ABBR[d.trim()] || d.trim())).filter(Boolean);
  if (!days.length) return null;
  return { street, fromCross, toCross, side, days, startTime: _parseAmPmTime(startRaw), endTime: _parseAmPmTime(endRaw) };
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
    const allNodes = data.elements.flatMap(el => el.geometry || []);
    if (allNodes.length < 2) return null;
    let fromLat = allNodes[0].lat, fromLng = allNodes[0].lon;
    let toLat = allNodes[allNodes.length - 1].lat, toLng = allNodes[allNodes.length - 1].lon;
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
