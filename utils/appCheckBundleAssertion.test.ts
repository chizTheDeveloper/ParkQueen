/**
 * §6 — App Check prod bundle assertions (TM-12).
 *
 * Vite strips the `if (import.meta.env.DEV)` guard in production builds.
 * These tests confirm the debug token setup never reaches the prod bundle.
 *
 * TM-12 remains OPEN: initializeAppCheck() is never called. Firebase App Check
 * enrollment requires a provider-side configuration decision (reCAPTCHA v3 /
 * DeviceCheck / Play Integrity). That decision must come from the product team.
 *
 * Tests skip when dist/ does not exist (pre-build). Run `npm run build` first
 * or let §10 (full release gate) provide the built output.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve(__dirname, '../dist');
const distExists = fs.existsSync(DIST_DIR);

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

    it.skipIf(!distExists)('AC-3: dist/ does not contain initializeAppCheck call', () => {
        expect(scanDist(/initializeAppCheck/)).toHaveLength(0);
    });

    it.skipIf(!distExists)('AC-4: dist/ does not contain known debug-bypass string', () => {
        // Firebase App Check debug tokens begin with this prefix in test environments
        expect(scanDist(/appcheck-debug-/i)).toHaveLength(0);
    });

    it('AC-5: firebaseConfig.ts DEV guard wraps debug token setup (source-level check)', () => {
        const src = fs.readFileSync(path.resolve(__dirname, '../firebaseConfig.ts'), 'utf-8');
        // The debug token assignment must be inside a DEV guard, not at module scope
        const debugTokenIndex = src.indexOf('FIREBASE_APPCHECK_DEBUG_TOKEN');
        const devGuardIndex = src.lastIndexOf('import.meta.env.DEV', debugTokenIndex);
        expect(devGuardIndex).toBeGreaterThan(-1);
        // DEV guard must precede the token assignment
        expect(devGuardIndex).toBeLessThan(debugTokenIndex);
    });

    it('AC-6: initializeAppCheck is never called in firebaseConfig.ts (TM-12 open)', () => {
        const src = fs.readFileSync(path.resolve(__dirname, '../firebaseConfig.ts'), 'utf-8');
        expect(src).not.toMatch(/initializeAppCheck\s*\(/);
    });
});
