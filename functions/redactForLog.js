'use strict';
/**
 * Server-side log redaction for Cloud Functions (TM-17).
 * Mirrors utils/redactForLog.ts — keep the SENSITIVE regex in sync.
 *
 * Usage:
 *   const { redactForLog } = require('./redactForLog');
 *   console.log('user prefs', JSON.stringify(redactForLog(userData)));
 */

const SENSITIVE = /phone|email|token|fcm|lat\b|lng\b|lon\b|coordinate|message|body|text|content|prompt|response|reply|password|secret|credential|apikey|api_key|auth|otp|\bcode\b/i;

function redactForLog(obj, deep = false) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const out = {};
    for (const key of Object.keys(obj)) {
        if (SENSITIVE.test(key)) {
            out[key] = '[REDACTED]';
        } else if (deep && obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            out[key] = redactForLog(obj[key], true);
        } else {
            out[key] = obj[key];
        }
    }
    return out;
}

module.exports = { redactForLog };
