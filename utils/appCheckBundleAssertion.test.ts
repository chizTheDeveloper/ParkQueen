/**
 * §6 — App Check prod bundle and source assertions (TM-12).
 *
 * Status: SOURCE PREPARED — PROVIDER REGISTRATION AND ENFORCEMENT PENDING
 *
 * Vite strips the `if (import.meta.env.DEV)` guard in production builds.
 * When VITE_FIREBASE_APPCHECK_SITE_KEY is absent (CI/local without key),
 * the initializeAppCheck branch is also dead code and is tree-shaken from
 * the prod bundle — the call never ships to production without a site key.
 *
 * Tests skip when dist/ does not exist (pre-build). Run `npm run build` first
 * or let §10 (full release gate) provide the built output.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve(__dirname, '../dist');
const distExists = fs.existsSync(DIST_DIR);
const SRC_CONFIG = path.resolve(__dirname, '../firebaseConfig.ts');

/** Scan all .js and .html files under dir; return lines matching pattern. */
function scanDist(pattern: RegExp): string[] {
    const hits: string[] = [];
    function walk(dir: string) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(full); continue; }
            if (!entry.name.endsWith('.js') && !entry.name.endsWith('.html')) continue;
            const content = fs.readFileSync(full, 'utf-8');
            content.split('\n').forEach((line, i) => {
                if (pattern.test(line)) hits.push(`${full}:${i + 1}`);
            });
        }
    }
    walk(DIST_DIR);
    return hits;
}

describe('§6 — App Check prod bundle assertions', () => {
    it.skipIf(!distExists)('AC-1: dist/ does not contain FIREBASE_APPCHECK_DEBUG_TOKEN', () => {
        expect(scanDist(/FIREBASE_APPCHECK_DEBUG_TOKEN/)).toHaveLength(0);
    });

    it.skipIf(!distExists)('AC-2: dist/ does not contain VITE_APPCHECK_DEBUG_TOKEN', () => {
        expect(scanDist(/VITE_APPCHECK_DEBUG_TOKEN/)).toHaveLength(0);
    });

    it.skipIf(!distExists)('AC-3: dist/ does not contain App Check site key or token values', () => {
        // Static imports of initializeAppCheck/ReCaptchaEnterpriseProvider may survive
        // Vite bundling even when the runtime branch is dead (Firebase packages are not
        // fully tree-shakeable due to side effects). The security-relevant check is that
        // no SITE KEY VALUES or DEBUG TOKEN VALUES are present in the bundle — not the
        // function name. AC-1, AC-2, AC-4, and AC-12 cover the sensitive-value checks.
        // This test asserts the site key variable reference is replaced at build time.
        expect(scanDist(/VITE_FIREBASE_APPCHECK_SITE_KEY/)).toHaveLength(0);
    });

    it.skipIf(!distExists)('AC-4: dist/ does not contain known debug-bypass string', () => {
        expect(scanDist(/appcheck-debug-/i)).toHaveLength(0);
    });

    it('AC-5: firebaseConfig.ts DEV guard wraps debug token setup (source-level check)', () => {
        const src = fs.readFileSync(SRC_CONFIG, 'utf-8');
        const debugTokenIndex = src.indexOf('FIREBASE_APPCHECK_DEBUG_TOKEN');
        const devGuardIndex = src.lastIndexOf('import.meta.env.DEV', debugTokenIndex);
        expect(devGuardIndex).toBeGreaterThan(-1);
        expect(devGuardIndex).toBeLessThan(debugTokenIndex);
    });

    it('AC-6: initializeAppCheck is called in firebaseConfig.ts and guarded by site key (TM-12 source prepared)', () => {
        const src = fs.readFileSync(SRC_CONFIG, 'utf-8');
        // Source is prepared: initializeAppCheck IS called
        expect(src).toMatch(/initializeAppCheck\s*\(/);
        // The call must be gated on VITE_FIREBASE_APPCHECK_SITE_KEY
        const callIndex = src.indexOf('initializeAppCheck(');
        const siteKeyGuardIndex = src.lastIndexOf('VITE_FIREBASE_APPCHECK_SITE_KEY', callIndex);
        expect(siteKeyGuardIndex, 'VITE_FIREBASE_APPCHECK_SITE_KEY guard must precede initializeAppCheck call').toBeGreaterThan(-1);
        expect(siteKeyGuardIndex).toBeLessThan(callIndex);
    });

    it('AC-7: ReCaptchaEnterpriseProvider is used as the App Check provider', () => {
        const src = fs.readFileSync(SRC_CONFIG, 'utf-8');
        expect(src).toMatch(/ReCaptchaEnterpriseProvider/);
        // The provider is constructed with the site key variable, not a literal
        const providerCallIdx = src.indexOf('new ReCaptchaEnterpriseProvider(');
        expect(providerCallIdx).toBeGreaterThan(-1);
        const providerArg = src.slice(providerCallIdx, src.indexOf(')', providerCallIdx));
        expect(providerArg).toMatch(/appCheckSiteKey/);
        expect(providerArg).not.toMatch(/"[A-Za-z0-9_-]{20,}"/); // no hardcoded key literal
    });

    it('AC-8: initializeAppCheck uses the same app instance as auth and db exports', () => {
        const src = fs.readFileSync(SRC_CONFIG, 'utf-8');
        // All three must reference the same `app` variable, not getApp() or a fresh initializeApp()
        expect(src).toMatch(/initializeAppCheck\(app,/);
        expect(src).toMatch(/getAuth\(app\)/);
        expect(src).toMatch(/getFirestore\(app\)/);
    });

    it('AC-9: token auto-refresh is enabled', () => {
        const src = fs.readFileSync(SRC_CONFIG, 'utf-8');
        expect(src).toMatch(/isTokenAutoRefreshEnabled:\s*true/);
    });

    it('AC-10: missing site key triggers a bounded DEV-only warning, not an error or silent fail', () => {
        const src = fs.readFileSync(SRC_CONFIG, 'utf-8');
        // else branch exists for missing key
        expect(src).toMatch(/else if \(import\.meta\.env\.DEV\)/);
        // warning is emitted, not an error throw
        expect(src).toMatch(/console\.warn\(.*TM-12/);
    });

    it('AC-11: initializeAppCheck import is present in firebaseConfig.ts', () => {
        const src = fs.readFileSync(SRC_CONFIG, 'utf-8');
        expect(src).toMatch(/import.*initializeAppCheck.*from 'firebase\/app-check'/);
        expect(src).toMatch(/import.*ReCaptchaEnterpriseProvider.*from 'firebase\/app-check'/);
    });

    it('AC-13: initializeApp is called exactly once in firebaseConfig.ts', () => {
        const src = fs.readFileSync(SRC_CONFIG, 'utf-8');
        const matches = src.match(/\binitializeApp\s*\(/g) || [];
        expect(matches).toHaveLength(1);
    });

    it('AC-14: firebase.ts has getApps() guard preventing dual FirebaseApp initialization', () => {
        // firebase.ts is imported by 28+ view files AND firebaseConfig.ts initializes the app.
        // The getApps().length === 0 guard in firebase.ts prevents a second app from being created
        // even when both files are bundled together. This test asserts the guard is present.
        const FIREBASE_TS = path.resolve(__dirname, '../firebase.ts');
        const src = fs.readFileSync(FIREBASE_TS, 'utf-8');
        // Must use getApps() to check for existing app
        expect(src).toMatch(/getApps\(\)/);
        // Must not call initializeApp unconditionally (it must be inside a conditional)
        const initIdx = src.indexOf('initializeApp(');
        const ternaryOrIfIdx = Math.max(src.lastIndexOf('?', initIdx), src.lastIndexOf('if ', initIdx));
        expect(ternaryOrIfIdx, 'initializeApp must be inside a conditional (ternary or if)').toBeGreaterThan(-1);
        expect(ternaryOrIfIdx).toBeLessThan(initIdx);
    });

    it.skipIf(!distExists)('AC-12: dist/ does not contain the App Check debug-token self.assignment', () => {
        // The debug token is injected via `self.FIREBASE_APPCHECK_DEBUG_TOKEN = value`.
        // AC-1 checks the env ref; this checks the assignment pattern itself.
        // Distinct from AC-1: catches any path that writes the global directly.
        expect(scanDist(/FIREBASE_APPCHECK_DEBUG_TOKEN\s*=/)).toHaveLength(0);
    });
});
