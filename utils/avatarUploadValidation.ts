/**
 * Client-side avatar upload validation — mirrors storage.rules' size and MIME
 * predicates so invalid files never reach Firebase Storage, and returns a
 * verified contentType to pass explicitly to uploadBytes rather than trusting
 * File.type, which browsers leave blank or set inconsistently for some
 * sources (screenshots, HEIC camera photos, drag-and-drop).
 */

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const SUPPORTED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type SupportedAvatarMimeType = typeof SUPPORTED_AVATAR_MIME_TYPES[number];

export type AvatarValidationResult =
    | { ok: true; contentType: SupportedAvatarMimeType }
    | { ok: false; reason: 'too_large' | 'unsupported_format' };

async function detectMimeFromMagicBytes(file: Blob): Promise<SupportedAvatarMimeType | null> {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());

    if (head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF) return 'image/jpeg';

    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47 &&
        head[4] === 0x0D && head[5] === 0x0A && head[6] === 0x1A && head[7] === 0x0A) return 'image/png';

    if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
        head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) return 'image/webp';

    return null;
}

export async function validateAvatarUpload(file: File): Promise<AvatarValidationResult> {
    if (file.size >= AVATAR_MAX_BYTES) return { ok: false, reason: 'too_large' };

    if ((SUPPORTED_AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
        return { ok: true, contentType: file.type as SupportedAvatarMimeType };
    }

    const detected = await detectMimeFromMagicBytes(file);
    if (detected) return { ok: true, contentType: detected };

    return { ok: false, reason: 'unsupported_format' };
}
