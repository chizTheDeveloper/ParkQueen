'use strict';

const STALE_MS = 24 * 60 * 60 * 1000;
const MAX_CANDIDATES = 200;
const FCM_BATCH = 500;
const GEOHASH_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';

function decodeGeohashBounds(hash) {
    if (typeof hash !== 'string' || hash.length === 0) throw new Error('invalid geohash');
    let latitude = [-90, 90];
    let longitude = [-180, 180];
    let longitudeBit = true;
    for (const character of hash.toLowerCase()) {
        const value = GEOHASH_ALPHABET.indexOf(character);
        if (value < 0) throw new Error('invalid geohash');
        for (let mask = 16; mask > 0; mask >>= 1) {
            const range = longitudeBit ? longitude : latitude;
            const midpoint = (range[0] + range[1]) / 2;
            if (value & mask) range[0] = midpoint;
            else range[1] = midpoint;
            longitudeBit = !longitudeBit;
        }
    }
    return { latitude, longitude };
}

function decodeGeohashCenter(hash) {
    const { latitude, longitude } = decodeGeohashBounds(hash);
    return [(latitude[0] + latitude[1]) / 2, (longitude[0] + longitude[1]) / 2];
}

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
            const decode = typeof geofire.geohashToLocation === 'function'
                ? geofire.geohashToLocation
                : decodeGeohashCenter;
            const [userLat, userLng] = decode(locData.lastGeohash);
            const centerDistance = haversineDistMiles(userLat, userLng, spotData.lat, spotData.lng);
            const bounds = decodeGeohashBounds(locData.lastGeohash);
            const cellRadius = haversineDistMiles(
                bounds.latitude[0], bounds.longitude[0], bounds.latitude[1], bounds.longitude[1]
            ) / 2;
            candidates.push({ userId, distMiles: Math.max(0, centerDistance - cellRadius) });
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
    const eligible = [];
    const seenUsers = new Set();
    for (const { userId, distMiles, prefs } of prefsResults) {
        if (!userId || seenUsers.has(userId)) continue;
        seenUsers.add(userId);
        if (!prefs || !prefs.fcmToken) continue;
        if (prefs.notificationsEnabled === false) continue;
        const userRadius = prefs.notificationRadius || 1;
        if (distMiles > userRadius) continue;
        const distLabel = distMiles < 0.1 ? 'right next to you' : '~' + distMiles.toFixed(1) + ' mi away';
        eligible.push({
            recipientUserId: userId,
            token: prefs.fcmToken,
            notification: {
                title: '👑 New Spot Near You!',
                body: 'Someone just left a spot ' + distLabel + '.',
            },
            data: {
                navigationVersion: '1',
                navigationType: 'ping',
                spotId,
            },
        });
    }
    const tokenOwners = new Map();
    for (const message of eligible) {
        const owners = tokenOwners.get(message.token) || new Set();
        owners.add(message.recipientUserId);
        tokenOwners.set(message.token, owners);
    }
    return eligible.filter(message => tokenOwners.get(message.token).size === 1);
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

module.exports = { decodeGeohashCenter, haversineDistMiles, filterCandidates, buildMessages, collectStaleTokens, STALE_MS, MAX_CANDIDATES, FCM_BATCH };
