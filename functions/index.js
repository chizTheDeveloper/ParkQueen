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
    
    // Find users within roughly ~2km radius (5 characters of geohash)
    const prefix = spotGeohash.substring(0, 5);

    try {
      const neighborsSnap = await db.collection("users")
          .where("lastGeohash", ">=", prefix)
          .where("lastGeohash", "<=", prefix + "\uf8ff")
          .get();

      const messages = [];
      neighborsSnap.forEach(userDoc => {
          const userData = userDoc.data();
          // Don't notify the finder, and only notify users with an FCM token
          if (userData.id !== spotData.finderId && userData.fcmToken) {
              messages.push({
                  token: userData.fcmToken,
                  notification: {
                      title: "👑 New Spot Near You!",
                      body: `Someone just left a spot nearby.`
                  },
                  data: { spotId: event.params.spotId, lat: String(spotData.lat), lng: String(spotData.lng) }
              });
          }
      });

      if (messages.length > 0) {
          const response = await getMessaging().sendEach(messages);
          console.log(`Geofence push: ${response.successCount} sent, ${response.failureCount} failed.`);
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