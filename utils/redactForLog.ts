'use strict';

/**
 * Scrub an arbitrary object before passing it to console.log/error.
 *
 * Walks own enumerable string keys one level deep (or recursively when
 * `deep` is true) and replaces any key whose name matches a sensitive
 * field with the string "[REDACTED]".
 *
 * Sensitive fields (case-insensitive, substring match):
 *   phone, email, token, fcm, coordinate, lat, lng, lon, message,
 *   body, text, content, prompt, response, reply, password, secret,
 *   credential, key, auth, otp, code
 */

const SENSITIVE = /phone|email|token|fcm|lat\b|lng\b|lon\b|coordinate|message|body|text|content|prompt|response|reply|password|secret|credential|apikey|api_key|auth|otp|\bcode\b/i;

export function redactForLog<T extends object>(obj: T, deep = false): Partial<T> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj) as Array<keyof T>) {
        const k = key as string;
        if (SENSITIVE.test(k)) {
            out[k] = '[REDACTED]';
        } else if (deep && obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            out[k] = redactForLog(obj[key] as object, true);
        } else {
            out[k] = obj[key];
        }
    }
    return out as Partial<T>;
}
