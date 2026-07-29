/**
 * Firebase Storage Security Rules tests — ParQueen avatar paths.
 *
 * Run via:
 *   npm run test:storage:rules          (starts emulator automatically)
 *   npm run test:storage:rules:unit     (assumes emulator already on :9199)
 *
 * Requires Java 11+ and Firebase CLI with the Storage emulator installed.
 */
import { readFileSync } from 'node:fs';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const OWNER_UID   = 'owner-st-111';
const OTHER_UID   = 'other-st-222';
const PROJECT_ID  = 'demo-parkqueen-storage-test';

// 1 KB image-shaped payload
const IMAGE_DATA  = new Uint8Array(1024).fill(0xff);
const IMAGE_META  = { contentType: 'image/jpeg' };

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        storage: {
            rules: readFileSync('storage.rules', 'utf8'),
            host: 'localhost',
            port: 9199,
        },
    });
});

afterAll(async () => {
    await testEnv.cleanup();
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function ownerStorage()   { return testEnv.authenticatedContext(OWNER_UID).storage(); }
function otherStorage()   { return testEnv.authenticatedContext(OTHER_UID).storage(); }
function anonStorage()    { return testEnv.unauthenticatedContext().storage(); }
function ownerPath()      { return `avatars/${OWNER_UID}`; }

// ── Write (upload) ─────────────────────────────────────────────────────────────

describe('Storage Rules — avatar write', () => {
    it('ST-01: owner can upload an image to their own avatar path', async () => {
        await assertSucceeds(
            uploadBytes(ref(ownerStorage(), ownerPath()), IMAGE_DATA, IMAGE_META),
        );
    });

    it('ST-02: non-owner cannot upload to another user\'s avatar path', async () => {
        await assertFails(
            uploadBytes(ref(otherStorage(), ownerPath()), IMAGE_DATA, IMAGE_META),
        );
    });

    it('ST-03: unauthenticated cannot upload to any avatar path', async () => {
        await assertFails(
            uploadBytes(ref(anonStorage(), ownerPath()), IMAGE_DATA, IMAGE_META),
        );
    });

    it('ST-04: upload with non-image MIME type is rejected (MIME spoof)', async () => {
        await assertFails(
            uploadBytes(
                ref(ownerStorage(), ownerPath()),
                new Uint8Array(512),
                { contentType: 'application/pdf' },
            ),
        );
    });

    it('ST-04b: upload with text/plain MIME type is rejected', async () => {
        await assertFails(
            uploadBytes(
                ref(ownerStorage(), ownerPath()),
                new Uint8Array(512),
                { contentType: 'text/plain' },
            ),
        );
    });

    it('ST-05: upload > 5 MB is rejected', async () => {
        const oversized = new Uint8Array(5 * 1024 * 1024 + 1); // 5,242,881 bytes
        await assertFails(
            uploadBytes(ref(ownerStorage(), ownerPath()), oversized, IMAGE_META),
        );
    });
});

// ── Read ───────────────────────────────────────────────────────────────────────

describe('Storage Rules — avatar read', () => {
    // Ensure the file exists before read tests
    beforeAll(async () => {
        await testEnv.withSecurityRulesDisabled(async ctx => {
            await uploadBytes(ref(ctx.storage(), ownerPath()), IMAGE_DATA, IMAGE_META);
        });
    });

    it('ST-06: owner can read (getBytes) their own avatar', async () => {
        await assertSucceeds(getBytes(ref(ownerStorage(), ownerPath())));
    });

    it('ST-07: non-owner cannot read (getBytes) another user\'s avatar via SDK', async () => {
        await assertFails(getBytes(ref(otherStorage(), ownerPath())));
    });

    it('ST-08: unauthenticated cannot read (getBytes) any avatar via SDK', async () => {
        await assertFails(getBytes(ref(anonStorage(), ownerPath())));
    });
});

// ── Delete ─────────────────────────────────────────────────────────────────────

describe('Storage Rules — avatar delete', () => {
    beforeAll(async () => {
        await testEnv.withSecurityRulesDisabled(async ctx => {
            await uploadBytes(ref(ctx.storage(), ownerPath()), IMAGE_DATA, IMAGE_META);
        });
    });

    it('ST-09: owner can delete their own avatar', async () => {
        await assertSucceeds(deleteObject(ref(ownerStorage(), ownerPath())));
    });

    it('ST-10: non-owner cannot delete another user\'s avatar', async () => {
        // Re-upload for this check
        await testEnv.withSecurityRulesDisabled(async ctx => {
            await uploadBytes(ref(ctx.storage(), ownerPath()), IMAGE_DATA, IMAGE_META);
        });
        await assertFails(deleteObject(ref(otherStorage(), ownerPath())));
    });

    it('ST-11: unauthenticated cannot delete any avatar', async () => {
        await assertFails(deleteObject(ref(anonStorage(), ownerPath())));
    });
});

// ── §8 — SVG acceptance policy ───────────────────────────────────────────────
// image/svg+xml matches the 'image/.*' rule, so SVG uploads are accepted.
// This is intentional: the Vision SafeSearch moderation step runs server-side,
// and SVGs loaded via <img> or CSS background-image do not execute scripts in
// modern browsers. Parsona avatars (SVG-based) are stored as Firestore manifest
// data, not Storage objects, so they bypass this path entirely.
// Known gap: EXIF metadata is NOT stripped from uploaded photos.
// Photos taken on mobile may embed GPS coordinates in EXIF. The Vision API
// SafeSearch does not read or strip EXIF. Mitigation: server-side EXIF stripping
// (e.g., via Sharp) before storage should be added in a future release.

describe('§8 — Storage Rules: SVG and MIME policy', () => {
    it('ST-14: SVG (image/svg+xml) is accepted — documented intentional tradeoff', async () => {
        // SVGs via <img> do not execute scripts; Parsona SVGs use Firestore manifests, not Storage.
        await assertSucceeds(
            uploadBytes(
                ref(ownerStorage(), ownerPath()),
                new Uint8Array(512),
                { contentType: 'image/svg+xml' },
            ),
        );
    });

    it('ST-15: WebP is accepted (image/webp matches image/.*)', async () => {
        await assertSucceeds(
            uploadBytes(
                ref(ownerStorage(), ownerPath()),
                IMAGE_DATA,
                { contentType: 'image/webp' },
            ),
        );
    });

    it('ST-16: application/octet-stream is rejected even if file is an image', async () => {
        // Content-Type mismatch: bytes might be a JPEG but declared type is binary blob → rejected
        await assertFails(
            uploadBytes(
                ref(ownerStorage(), ownerPath()),
                IMAGE_DATA,
                { contentType: 'application/octet-stream' },
            ),
        );
    });
});

// ── Catch-all deny ─────────────────────────────────────────────────────────────

describe('Storage Rules — catch-all deny', () => {
    it('ST-12: authenticated user cannot write to a path outside /avatars', async () => {
        await assertFails(
            uploadBytes(
                ref(ownerStorage(), `users/${OWNER_UID}/data`),
                IMAGE_DATA,
                IMAGE_META,
            ),
        );
    });

    it('ST-13: authenticated user cannot read a path outside /avatars', async () => {
        await assertFails(getBytes(ref(ownerStorage(), 'private/secret')));
    });
});

// ── Direct vs subdirectory path coverage ──────────────────────────────────────

describe('Storage Rules — direct avatar path (match /avatars/{uid})', () => {
    it('ST-14: owner can upload directly to avatars/{uid} (no subdirectory)', async () => {
        // ProfileView uploads to this exact path — confirms the direct match rule fires
        await assertSucceeds(
            uploadBytes(ref(ownerStorage(), `avatars/${OWNER_UID}`), IMAGE_DATA, IMAGE_META),
        );
    });

    it('ST-15: non-owner cannot upload to avatars/{otherUid} direct path', async () => {
        await assertFails(
            uploadBytes(ref(ownerStorage(), `avatars/${OTHER_UID}`), IMAGE_DATA, IMAGE_META),
        );
    });
});
