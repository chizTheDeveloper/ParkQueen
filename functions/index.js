const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

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