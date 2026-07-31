'use strict';

const STALE_MS = 24 * 60 * 60 * 1000;
const MAX_CANDIDATES = 200;
const FCM_BATCH = 500;

function haversineDistMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Build candidate list from a userLocations QuerySnapshot (or any iterable of {id, data()}).
 * Excludes: the spot finder, docs with missing geohash, stale locations (>STALE_MS),
 * and docs whose geohash cannot be decoded (malformed geohash skipped, others continue).
 * @param {nowMs} number - injectable for testing; use Date.now() in production
 */
function filterCandidates(locDocs, spotData, geofire, nowMs) {
    const candidates = [];
    locDocs.forEach(locDoc => {
        const locData = locDoc.data();
        const userId = locDoc.id;
        if (userId === spotData.finderId) return;
        if (!locData.lastGeohash) return;
        const ageMs = locData.lastGeohashUpdatedAt
            ? nowMs - locData.lastGeohashUpdatedAt.toMillis()
            : Infinity;
        if (ageMs > STALE_MS) return;
        try {
            const [userLat, userLng] = geofire.geohashToLocation(locData.lastGeohash);
            candidates.push({ userId, distMiles: haversineDistMiles(userLat, userLng, spotData.lat, spotData.lng) });
        } catch {
            // malformed geohash — skip this candidate without aborting the fanout
        }
    });
    return candidates;
}

/**
 * Build FCM message list from preference results.
 * TM-17: no coordinates or finder identity in the data payload.
 */
function buildMessages(prefsResults, spotId) {
    const messages = [];
    for (const { distMiles, prefs } of prefsResults) {
        if (!prefs || !prefs.fcmToken) continue;
        if (prefs.notificationsEnabled === false) continue;
        const userRadius = prefs.notificationRadius || 1;
        if (distMiles > userRadius) continue;
        const distLabel = distMiles < 0.1 ? 'right next to you' : '~' + distMiles.toFixed(1) + ' mi away';
        messages.push({
            token: prefs.fcmToken,
            notification: {
                title: '👑 New Spot Near You!',
                body: 'Someone just left a spot ' + distLabel + '.',
            },
            data: { spotId },
        });
    }
    return messages;
}

/**
 * Return the subset of FCM tokens from chunk that should be deleted (stale/invalid).
 * Other failure codes (quota, internal) are transient and must not trigger cleanup.
 */
function collectStaleTokens(chunk, responses) {
    const stale = [];
    responses.forEach((r, idx) => {
        if (!r.success) {
            const code = r.error?.code || '';
            if (
                code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token'
            ) {
                stale.push(chunk[idx].token);
            }
        }
    });
    return stale;
}

module.exports = { haversineDistMiles, filterCandidates, buildMessages, collectStaleTokens, STALE_MS, MAX_CANDIDATES, FCM_BATCH };
