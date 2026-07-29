/**
 * Firebase Storage Security Rules tests — ParQueen quarantine avatar architecture.
 *
 * Phase H quarantine design:
 *   avatarUploads/{uid}/{uploadId}/{file}  — client upload (owner write only)
 *   avatarCandidates/{**}                  — server-only (no client access)
 *   avatars/{uid}                           — server-published (owner read only)
 *
 * Run via:
 *   npm run test:storage:rules          (starts emulator automatically)
 *   npm run test:storage:rules:unit     (assumes emulator already on :9199)
 */
import { readFileSync } from 'node:fs';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const OWNER_UID  = 'owner-st-111';
const OTHER_UID  = 'other-st-222';
const UPLOAD_ID  = 'upload-abc123';
const PROJECT_ID = 'demo-parkqueen-storage-test';

// Tiny valid image payloads
const JPEG_DATA = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Uint8Array(1020)]);
const PNG_DATA  = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...new Uint8Array(1016)]);
const IMAGE_META = { contentType: 'image/jpeg' };

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

function ownerStorage() { return testEnv.authenticatedContext(OWNER_UID).storage(); }
function otherStorage() { return testEnv.authenticatedContext(OTHER_UID).storage(); }
function anonStorage()  { return testEnv.unauthenticatedContext().storage(); }

function uploadPath(uid = OWNER_UID, uploadId = UPLOAD_ID) {
    return `avatarUploads/${uid}/${uploadId}/original`;
}

// ── avatarUploads/ — client write rules ───────────────────────────────────────

describe('ST-01 – ST-09: avatarUploads/ write rules', () => {
    it('ST-01: owner can upload JPEG to their upload quarantine path', async () => {
        await assertSucceeds(
            uploadBytes(ref(ownerStorage(), uploadPath()), JPEG_DATA, IMAGE_META),
        );
    });

    it('ST-02: owner can upload PNG to their upload quarantine path', async () => {
        await assertSucceeds(
            uploadBytes(ref(ownerStorage(), uploadPath()), PNG_DATA, { contentType: 'image/png' }),
        );
    });

    it('ST-03: owner can upload WebP to their upload quarantine path', async () => {
        await assertSucceeds(
            uploadBytes(ref(ownerStorage(), uploadPath()), JPEG_DATA, { contentType: 'image/webp' }),
        );
    });

    it('ST-04: non-owner cannot upload to another user\'s upload path', async () => {
        await assertFails(
            uploadBytes(ref(otherStorage(), uploadPath(OWNER_UID)), JPEG_DATA, IMAGE_META),
        );
    });

    it('ST-05: unauthenticated cannot upload to any upload path', async () => {
        await assertFails(
            uploadBytes(ref(anonStorage(), uploadPath()), JPEG_DATA, IMAGE_META),
        );
    });

    it('ST-06: SVG (image/svg+xml) is rejected — not in MIME allowlist', async () => {
        await assertFails(
            uploadBytes(ref(ownerStorage(), uploadPath()), JPEG_DATA, { contentType: 'image/svg+xml' }),
        );
    });

    it('ST-07: GIF (image/gif) is rejected — not in allowlist', async () => {
        await assertFails(
            uploadBytes(ref(ownerStorage(), uploadPath()), JPEG_DATA, { contentType: 'image/gif' }),
        );
    });

    it('ST-08: application/pdf is rejected — not in allowlist', async () => {
        await assertFails(
            uploadBytes(ref(ownerStorage(), uploadPath()), new Uint8Array(512), { contentType: 'application/pdf' }),
        );
    });

    it('ST-09: upload > 5 MB is rejected', async () => {
        const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
        await assertFails(
            uploadBytes(ref(ownerStorage(), uploadPath()), oversized, IMAGE_META),
        );
    });
});

// ── avatarUploads/ — client read and delete denied ────────────────────────────

describe('ST-10 – ST-12: avatarUploads/ read/delete is server-only', () => {
    beforeAll(async () => {
        // Pre-seed a file bypassing rules so read/delete tests have something to check
        await testEnv.withSecurityRulesDisabled(async ctx => {
            await uploadBytes(ref(ctx.storage(), uploadPath()), JPEG_DATA, IMAGE_META);
        });
    });

    it('ST-10: owner cannot read (getBytes) their own upload path', async () => {
        await assertFails(getBytes(ref(ownerStorage(), uploadPath())));
    });

    it('ST-11: owner cannot delete their own upload path', async () => {
        await assertFails(deleteObject(ref(ownerStorage(), uploadPath())));
    });

    it('ST-12: other user cannot read upload path at all', async () => {
        await assertFails(getBytes(ref(otherStorage(), uploadPath(OWNER_UID))));
    });
});

// ── avatarCandidates/ — fully server-only ────────────────────────────────────

describe('ST-13 – ST-15: avatarCandidates/ is server-only (no client access)', () => {
    const candidatePath = `avatarCandidates/${OWNER_UID}/${UPLOAD_ID}.webp`;

    beforeAll(async () => {
        await testEnv.withSecurityRulesDisabled(async ctx => {
            await uploadBytes(ref(ctx.storage(), candidatePath), JPEG_DATA, { contentType: 'image/webp' });
        });
    });

    it('ST-13: owner cannot read a candidate file', async () => {
        await assertFails(getBytes(ref(ownerStorage(), candidatePath)));
    });

    it('ST-14: owner cannot write to avatarCandidates/', async () => {
        await assertFails(
            uploadBytes(ref(ownerStorage(), candidatePath), JPEG_DATA, { contentType: 'image/webp' }),
        );
    });

    it('ST-15: unauthenticated cannot read a candidate file', async () => {
        await assertFails(getBytes(ref(anonStorage(), candidatePath)));
    });
});

// ── avatars/ — server-published, owner-read, no client write ─────────────────

describe('ST-16 – ST-20: avatars/ published path rules', () => {
    const publishedPath = `avatars/${OWNER_UID}`;

    beforeAll(async () => {
        await testEnv.withSecurityRulesDisabled(async ctx => {
            await uploadBytes(ref(ctx.storage(), publishedPath), JPEG_DATA, IMAGE_META);
        });
    });

    it('ST-16: owner can read their published avatar', async () => {
        await assertSucceeds(getBytes(ref(ownerStorage(), publishedPath)));
    });

    it('ST-17: non-owner cannot read another user\'s published avatar', async () => {
        await assertFails(getBytes(ref(otherStorage(), publishedPath)));
    });

    it('ST-18: unauthenticated cannot read any published avatar', async () => {
        await assertFails(getBytes(ref(anonStorage(), publishedPath)));
    });

    it('ST-19: owner cannot write to published avatar path (server-only)', async () => {
        await assertFails(
            uploadBytes(ref(ownerStorage(), publishedPath), JPEG_DATA, IMAGE_META),
        );
    });

    it('ST-20: owner cannot delete their published avatar (server-only)', async () => {
        await assertFails(deleteObject(ref(ownerStorage(), publishedPath)));
    });
});

// ── Catch-all deny ─────────────────────────────────────────────────────────────

describe('ST-21 – ST-22: catch-all deny for paths outside avatar families', () => {
    it('ST-21: authenticated user cannot write to an arbitrary path', async () => {
        await assertFails(
            uploadBytes(ref(ownerStorage(), `users/${OWNER_UID}/data`), JPEG_DATA, IMAGE_META),
        );
    });

    it('ST-22: authenticated user cannot read an arbitrary path', async () => {
        await assertFails(getBytes(ref(ownerStorage(), 'private/secret')));
    });
});
