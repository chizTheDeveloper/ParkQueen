const { onCall } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { initializeApp } = require("firebase-admin/app");

initializeApp();

exports.migrateUsersToFirestore = onCall(async (request) => {
  const auth = getAuth();
  const db = getFirestore();
  const usersCollection = db.collection('users');

  console.log('Starting user migration...');

  try {
    let userRecords = [];
    let pageToken;

    do {
      const listUsersResult = await auth.listUsers(1000, pageToken);
      userRecords = userRecords.concat(listUsersResult.users);
      pageToken = listUsersResult.pageToken;
    } while (pageToken);

    const totalUsers = userRecords.length;
    console.log(`Found ${totalUsers} users in Firebase Authentication.`);

    if (totalUsers === 0) {
      return { message: "No users to migrate." };
    }

    let createdCount = 0;
    let skippedCount = 0;

    const migrationPromises = userRecords.map(async (user) => {
      const { uid, email, metadata, displayName, photoURL } = user;
      const userRef = usersCollection.doc(uid);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        console.log(`Skipping existing user: ${email || uid}`);
        skippedCount++;
        return;
      }

      console.log(`Creating profile for user: ${email || uid}`);
      await userRef.set({
        id: uid,
        email: email || null,
        fullName: displayName || 'N/A',
        role: 'Renter', // Default role for migrated users
        status: 'Active',
        createdAt: metadata.creationTime ? new Date(metadata.creationTime) : new Date(),
        avatar: photoURL || null,
      });
      createdCount++;
    });

    await Promise.all(migrationPromises);

    const result = `Migration complete. Created: ${createdCount} profiles, Skipped: ${skippedCount} existing profiles.`;
    console.log(result);
    return { message: result };

  } catch (error) {
    console.error("Error during user migration:", error);
    // Using the new format for throwing errors in v2
    throw new functions.https.HttpsError('internal', 'An error occurred during migration.', error.message);
  }
});
