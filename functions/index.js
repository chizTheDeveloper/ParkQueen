const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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
