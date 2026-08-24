'use strict';

/**
 * cleanupExpiredSpotsHourly — Wave 7A-2 runtime-identity canary only.
 *
 * This migration is strictly runtime configuration: query, schedule, batch
 * size, and delete behavior are unchanged (see git history for the full
 * read-only audit). The cross-function trust-safety guarantee this function
 * depends on — that deleting an expired, still-'interested' spot does NOT
 * trigger updateTrustOnSpotDelete's handoffsCancelledByFinder penalty — is
 * proved at the trigger level in pingNotificationPrivacy.integration.test.js
 * ("Natural-expiration trust exemption" describe block, especially CASE 3
 * and BUG-REPRO, which reproduces this exact scenario). It is not
 * duplicated here: every document this function's own query selects
 * satisfies expiresAt <= (query time), and its delete event necessarily
 * fires at or after that same instant, so the expiration exemption applies
 * unconditionally to every deletion cleanupExpiredSpotsHourly performs.
 */

const fs = require('fs');
const path = require('path');

describe('cleanupExpiredSpotsHourly Function contract', () => {
    it('CESH-1: Runtime-IAM canary config-contract — cleanupExpiredSpotsHourly (Wave 7A-2) runs as the dedicated parqueen-cleanup identity', () => {
        const src = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
        const start = src.indexOf('exports.cleanupExpiredSpotsHourly = onSchedule(');
        expect(start).toBeGreaterThan(-1);
        const fn = src.slice(start, src.indexOf('exports.cleanupExpiredInterests', start));
        expect(fn).toMatch(/serviceAccount:\s*'parqueen-cleanup@parkqueen-46475363-ccf36\.iam\.gserviceaccount\.com'/);
    });

    it('CESH-2: source-contract — query, batch size, and loop-until-exhaustion behavior are unchanged by the runtime migration', () => {
        const src = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
        const start = src.indexOf('exports.cleanupExpiredSpotsHourly = onSchedule(');
        const fn = src.slice(start, src.indexOf('exports.cleanupExpiredInterests', start));
        expect(fn).toMatch(/schedule:\s*"every 1 hours"/);
        expect(fn).toMatch(/timeZone:\s*"America\/Toronto"/);
        expect(fn).toMatch(/\.collection\("spots"\)/);
        expect(fn).toMatch(/\.where\("expiresAt",\s*"<=",\s*now\)/);
        expect(fn).toMatch(/\.limit\(500\)/);
        expect(fn).toMatch(/while \(true\)/);
        expect(fn).toMatch(/db\.batch\(\)/);
        expect(fn).not.toMatch(/source:\s*['"]system['"]/);
    });
});
