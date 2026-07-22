#!/usr/bin/env node
'use strict';

/**
 * One-time Admin SDK migration: move legacy private demographic fields
 * from users/{uid} (public) → users/{uid}/private/profile (owner-only).
 *
 * Usage (Windows PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\secure-path\service-account.json"
 *   node scripts/migrate-private-profile.js [--dry-run] [--verify]
 *   Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS
 *
 * --dry-run  : Scan only; report what would change. No writes.
 * --verify   : Read-only pass after migration; confirms zero legacy fields remain.
 *
 * Do NOT commit service-account credentials to git.
 * The GOOGLE_APPLICATION_CREDENTIALS env var must point to a service-account
 * key file that is listed in .gitignore.
 *
 * Safe to re-run: already-migrated users are counted as alreadyClean and
 * skipped. Partial migrations resume from where they stopped.
 */

// ─── Target project ───────────────────────────────────────────────────────────

const EXPECTED_PROJECT_ID = 'parkqueen-46475363-ccf36';

// ─── Private-field denylist ───────────────────────────────────────────────────
// Definitive list — no alternative historical names found in git history.

const PRIVATE_FIELDS = ['dob', 'gender', 'homeArea', 'driverType', 'ageRange'];

// ─── Pure migration logic (no Firestore dependency) ──────────────────────────

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

const dryRun  = process.argv.includes('--dry-run');
const verify  = process.argv.includes('--verify');
const BATCH_SIZE = 100;

if (dryRun && verify) {
  console.error('[migrate] --dry-run and --verify are mutually exclusive.');
  process.exit(1);
}

if (dryRun)  console.log('[migrate] DRY-RUN mode — no writes will be performed');
if (verify)  console.log('[migrate] VERIFY mode — read-only scan for residual legacy fields');

let admin;
try {
  admin = require('../functions/node_modules/firebase-admin');
} catch (_) {
  admin = require('firebase-admin');
}

if (!admin.apps.length) {
  admin.initializeApp();
}

// ─── Project-ID safety check ──────────────────────────────────────────────────

const actualProject = admin.app().options.projectId
  || process.env.GCLOUD_PROJECT
  || process.env.FIREBASE_PROJECT_ID
  || process.env.GOOGLE_CLOUD_PROJECT;

if (actualProject && actualProject !== EXPECTED_PROJECT_ID) {
  console.error(
    `[migrate] ABORT — project mismatch.\n` +
    `  Expected : ${EXPECTED_PROJECT_ID}\n` +
    `  Got      : ${actualProject}\n` +
    `  Set GOOGLE_APPLICATION_CREDENTIALS to the correct service account.`
  );
  process.exit(1);
}

if (actualProject) {
  console.log(`[migrate] Project confirmed: ${actualProject}`);
} else {
  console.warn(`[migrate] WARNING — could not confirm project ID from SDK; proceeding with ADC.`);
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─── Verify mode ─────────────────────────────────────────────────────────────

async function runVerify() {
  let cursor = null;
  let scanned = 0;
  let residual = 0;
  let failures = 0;
  const residualCounts = {};

  console.log(`[verify] Scanning all users/${'{uid}'} documents for residual private fields…`);

  do {
    let q = db.collection('users').orderBy('__name__').limit(BATCH_SIZE);
    if (cursor) q = q.startAfter(cursor);

    const snapshot = await q.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      scanned++;
      const data = doc.data();
      const found = PRIVATE_FIELDS.filter(f => isPresent(data[f]));
      if (found.length > 0) {
        residual++;
        console.error(`[verify] RESIDUAL uid=${doc.id} fields=${found.join(',')}`);
        for (const f of found) residualCounts[f] = (residualCounts[f] || 0) + 1;
      }
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
  } while (true);

  console.log(`\n[verify] Scanned=${scanned} residualDocs=${residual} failures=${failures}`);
  if (Object.keys(residualCounts).length > 0) {
    console.error('[verify] Residual field counts:', JSON.stringify(residualCounts));
  }

  if (residual > 0 || failures > 0) {
    console.error('[verify] FAIL — legacy fields remain. Re-run migration.');
    process.exit(1);
  } else {
    console.log('[verify] PASS — zero legacy private fields in public user documents.');
  }
}

// ─── Migration ────────────────────────────────────────────────────────────────

async function run() {
  let cursor = null;
  let migrated = 0;
  let alreadyClean = 0;
  let conflicts = 0;
  let failed = 0;
  const fieldFrequency = {};

  console.log(`[migrate] Starting (batchSize=${BATCH_SIZE}, dryRun=${dryRun})`);

  do {
    let q = db.collection('users').orderBy('__name__').limit(BATCH_SIZE);
    if (cursor) q = q.startAfter(cursor);

    const snapshot = await q.get();
    if (snapshot.empty) break;

    for (const userDoc of snapshot.docs) {
      const uid = userDoc.id;
      const publicData = userDoc.data();

      const fieldsPresent = PRIVATE_FIELDS.filter(f => isPresent(publicData[f]));

      if (fieldsPresent.length === 0) {
        alreadyClean++;
        continue;
      }

      // Log field names only — never log field values.
      console.log(`[migrate] uid=${uid} publicPrivateFields=${fieldsPresent.join(',')}`);
      for (const f of fieldsPresent) fieldFrequency[f] = (fieldFrequency[f] || 0) + 1;

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
            conflicts++;
          }

          if (Object.keys(privateUpdates).length > 0) {
            t.set(privateRef, privateUpdates, { merge: true });
          }

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

  const total = migrated + alreadyClean + failed;
  console.log(
    `\n[migrate] Complete — scanned=${total} migrated=${migrated} alreadyClean=${alreadyClean}` +
    ` conflicts=${conflicts} failed=${failed}`
  );
  if (Object.keys(fieldFrequency).length > 0) {
    console.log('[migrate] Field frequency (names only):', JSON.stringify(fieldFrequency));
  }

  if (failed > 0) process.exit(1);
}

(verify ? runVerify() : run()).catch((e) => {
  console.error('[migrate] Fatal:', e);
  process.exit(1);
});
