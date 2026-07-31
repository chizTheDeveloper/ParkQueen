'use strict';

// Fixed-window limiter: divides time into non-overlapping windows of windowSec each.
// Boundary-burst risk: a caller can make 2× limit requests in 1 second by straddling
// a window boundary. Acceptable for current threat model; upgrade to token-bucket or
// sliding-window (e.g. Redis INCR + EXPIRE) if stricter enforcement is needed.
// Doc IDs: rateLimits/{operation}_{windowKey}_{uid}  (server-only, rules deny all client access)
// Operator action: enable Firestore TTL policy on rateLimits.expiresAt

function windowKey(nowMs, windowSec) {
    return Math.floor(nowMs / (windowSec * 1000));
}

// Lazy-require Firebase modules so this file is importable from test envs
// without requiring Firebase Admin to be initialized.
async function checkRateLimit(uid, operation, { limit, windowSec }) {
    const { getFirestore, Timestamp } = require('firebase-admin/firestore');
    const { HttpsError } = require('firebase-functions/v2/https');
    const db = getFirestore();
    const wk = windowKey(Date.now(), windowSec);
    const ref = db.collection('rateLimits').doc(`${operation}_${wk}_${uid}`);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const count = snap.exists ? (snap.data().count || 0) : 0;
        if (count >= limit) {
            throw new HttpsError('resource-exhausted', 'Too many requests. Try again later.');
        }
        tx.set(ref, {
            count: count + 1,
            uid,
            operation,
            expiresAt: Timestamp.fromMillis(Date.now() + windowSec * 2000),
        }, { merge: true });
    });
}

module.exports = { checkRateLimit, windowKey };
