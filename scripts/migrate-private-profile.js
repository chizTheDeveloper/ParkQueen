#!/usr/bin/env node
'use strict';

/**
 * One-time Admin SDK migration: move legacy private demographic fields
 * from users/{uid} (public) → users/{uid}/private/profile (owner-only).
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
 *     node scripts/migrate-private-profile.js [--dry-run]
 *
 * Do NOT commit service-account credentials to git.
 * The GOOGLE_APPLICATION_CREDENTIALS env var must point to a service-account
 * key file that is listed in .gitignore.
 *
 * Safe to re-run: already-migrated users are counted as alreadyClean and
 * skipped. Partial migrations resume from where they stopped.
 */

// ─── Pure migration logic (no Firestore dependency) ──────────────────────────

const PRIVATE_FIELDS = ['dob', 'gender', 'homeArea', 'driverType', 'ageRange'];

function isPresent(v) {
  return v !== undefined && v !== null && v !== '';
}

/**
 * Compute what must be written/deleted for one user document.
 *
 * Conflict rule: private doc value wins.
 * Empty / undefined public values are never copied.
 */
function computeMigration(publicData, privateData) {
  const privateUpdates = {};
  const publicDeletes = [];
  const skippedFields = [];

  for (const field of PRIVATE_FIELDS) {
    const pubVal = publicData[field];
    if (!isPresent(pubVal)) continue;

    publicDeletes.push(field);

    if (isPresent((privateData || {})[field])) {
      skippedFields.push(field);
    } else {
      privateUpdates[field] = pubVal;
    }
  }

  return { privateUpdates, publicDeletes, skippedFields };
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

const dryRun = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;

if (dryRun) {
  console.log('[migrate] DRY-RUN mode — no writes will be performed');
}

let admin;
try {
  // Prefer the admin SDK already installed under functions/
  admin = require('../functions/node_modules/firebase-admin');
} catch (_) {
  admin = require('firebase-admin');
}

if (!admin.apps.length) {
  const projectId =
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    'parqueen-app';
  admin.initializeApp({ projectId });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function run() {
  let cursor = null;
  let migrated = 0;
  let alreadyClean = 0;
  let failed = 0;

  console.log(`[migrate] Starting (batchSize=${BATCH_SIZE}, dryRun=${dryRun})`);

  do {
    let q = db.collection('users').orderBy('__name__').limit(BATCH_SIZE);
    if (cursor) q = q.startAfter(cursor);

    const snapshot = await q.get();
    if (snapshot.empty) break;

    for (const userDoc of snapshot.docs) {
      const uid = userDoc.id;
      const publicData = userDoc.data();

      // Only log field names — never log field values.
      const fieldsPresent = PRIVATE_FIELDS.filter(f => isPresent(publicData[f]));

      if (fieldsPresent.length === 0) {
        alreadyClean++;
        continue;
      }

      console.log(`[migrate] uid=${uid} publicPrivateFields=${fieldsPresent.join(',')}`);

      if (dryRun) {
        migrated++;
        continue;
      }

      try {
        await db.runTransaction(async (t) => {
          const privateRef = db.doc(`users/${uid}/private/profile`);
          const privateSnap = await t.get(privateRef);
          const privateData = privateSnap.exists ? privateSnap.data() : {};

          const { privateUpdates, publicDeletes, skippedFields } =
            computeMigration(publicData, privateData);

          if (skippedFields.length > 0) {
            console.log(`[migrate] uid=${uid} privateWins=${skippedFields.join(',')}`);
          }

          // Merge new values into private doc
          if (Object.keys(privateUpdates).length > 0) {
            t.set(privateRef, privateUpdates, { merge: true });
          }

          // Delete from public doc
          if (publicDeletes.length > 0) {
            const pubDeletePayload = {};
            for (const field of publicDeletes) {
              pubDeletePayload[field] = FieldValue.delete();
            }
            t.update(userDoc.ref, pubDeletePayload);
          }
        });

        console.log(`[migrate] uid=${uid} status=migrated`);
        migrated++;
      } catch (e) {
        console.error(`[migrate] uid=${uid} status=failed error=${e.message}`);
        failed++;
      }
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
  } while (true);

  console.log(
    `\n[migrate] Complete — migrated=${migrated} alreadyClean=${alreadyClean} failed=${failed}`,
  );

  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error('[migrate] Fatal:', e);
  process.exit(1);
});
