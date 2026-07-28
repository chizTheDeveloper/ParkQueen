/**
 * TM-17 — Static audit: functions/index.js must not log raw PII fields.
 * Acts as a regression gate so future log additions are reviewed.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import path from 'node:path';

const src = readFileSync(path.resolve('./functions/index.js'), 'utf-8');
const lines = src.split('\n').map((text, i) => ({ line: i + 1, text }));

function consoleLinesMatching(pattern: RegExp) {
    return lines.filter(({ text }) =>
        /console\.(log|warn|error)/.test(text) && pattern.test(text)
    );
}

describe('TM-17 — Functions log redaction audit', () => {
    it('no console call logs raw coordinates (lat= or lng=)', () => {
        expect(consoleLinesMatching(/lat=|lng=|lon=/)).toEqual([]);
    });

    it('no console call logs a raw userData reference', () => {
        expect(consoleLinesMatching(/\buserData\b/)).toEqual([]);
    });

    it('no console call logs fcmToken', () => {
        expect(consoleLinesMatching(/\bfcmToken\b/)).toEqual([]);
    });

    it('no console call logs a raw email value', () => {
        // Allow error-category strings like "email does not match" — block variable refs
        expect(consoleLinesMatching(/\bemail\s*[,)]/)).toEqual([]);
    });
});
