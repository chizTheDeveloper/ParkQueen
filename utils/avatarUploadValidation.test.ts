import { describe, it, expect } from 'vitest';
import { validateAvatarUpload, AVATAR_MAX_BYTES } from './avatarUploadValidation';

const JPEG_BYTES = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Uint8Array(508)]);
const PNG_BYTES  = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...new Uint8Array(504)]);
const WEBP_BYTES = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ...new Uint8Array(500),
]);
// HEIC's ISO-BMFF ftyp box — a real unsupported format, not random bytes.
const HEIC_BYTES = new Uint8Array([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ...new Uint8Array(500),
]);
const UNKNOWN_BYTES = new Uint8Array(512).fill(0x00);

function makeFile(bytes: Uint8Array, name: string, type: string): File {
    return new File([bytes.buffer as ArrayBuffer], name, { type });
}

describe('validateAvatarUpload', () => {
    it('1: JPEG with file.type=image/jpeg is accepted with explicit image/jpeg contentType', async () => {
        const result = await validateAvatarUpload(makeFile(JPEG_BYTES, 'a.jpg', 'image/jpeg'));
        expect(result).toEqual({ ok: true, contentType: 'image/jpeg' });
    });

    it('2: PNG with file.type=image/png is accepted', async () => {
        const result = await validateAvatarUpload(makeFile(PNG_BYTES, 'a.png', 'image/png'));
        expect(result).toEqual({ ok: true, contentType: 'image/png' });
    });

    it('3: WebP with file.type=image/webp is accepted', async () => {
        const result = await validateAvatarUpload(makeFile(WEBP_BYTES, 'a.webp', 'image/webp'));
        expect(result).toEqual({ ok: true, contentType: 'image/webp' });
    });

    it('4: JPEG bytes with blank file.type — magic-byte detection returns image/jpeg', async () => {
        const result = await validateAvatarUpload(makeFile(JPEG_BYTES, 'a', ''));
        expect(result).toEqual({ ok: true, contentType: 'image/jpeg' });
    });

    it('5: PNG bytes with blank file.type — magic-byte detection returns image/png', async () => {
        const result = await validateAvatarUpload(makeFile(PNG_BYTES, 'a', ''));
        expect(result).toEqual({ ok: true, contentType: 'image/png' });
    });

    it('6: WebP bytes with blank file.type — magic-byte detection returns image/webp', async () => {
        const result = await validateAvatarUpload(makeFile(WEBP_BYTES, 'a', ''));
        expect(result).toEqual({ ok: true, contentType: 'image/webp' });
    });

    it('7: unrecognized bytes are rejected client-side (no Firebase upload attempted)', async () => {
        const result = await validateAvatarUpload(makeFile(UNKNOWN_BYTES, 'a', ''));
        expect(result).toEqual({ ok: false, reason: 'unsupported_format' });
    });

    it('8: HEIC is rejected — not falsely labelled as JPEG merely to pass the rule', async () => {
        const result = await validateAvatarUpload(makeFile(HEIC_BYTES, 'a.heic', 'image/heic'));
        expect(result).toEqual({ ok: false, reason: 'unsupported_format' });
    });

    it('9: file >= 5 MiB is rejected client-side regardless of valid MIME', async () => {
        const oversized = new Uint8Array(AVATAR_MAX_BYTES);
        oversized.set(JPEG_BYTES);
        const result = await validateAvatarUpload(makeFile(oversized, 'a.jpg', 'image/jpeg'));
        expect(result).toEqual({ ok: false, reason: 'too_large' });
    });

    it('a file.type outside the allowlist still falls through to magic-byte detection', async () => {
        // e.g. application/octet-stream (Firebase SDK's own fallback) must not
        // be trusted at face value — bytes are checked rather than rejecting outright.
        const result = await validateAvatarUpload(makeFile(PNG_BYTES, 'a', 'application/octet-stream'));
        expect(result).toEqual({ ok: true, contentType: 'image/png' });
    });
});
