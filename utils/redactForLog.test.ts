/**
 * TM-17 — Direct tests for functions/redactForLog.js.
 * Tests the server helper against the same fixture set used for client reasoning,
 * preventing silent drift between the two implementations.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { redactForLog } = require(path.resolve('./functions/redactForLog.js'));

describe('TM-17 — redactForLog server helper', () => {
    it('redacts sensitive keys', () => {
        const r = redactForLog({ email: 'a@b.com', fcmToken: 'tok', username: 'alice' });
        expect(r.email).toBe('[REDACTED]');
        expect(r.fcmToken).toBe('[REDACTED]');
        expect(r.username).toBe('alice');
    });

    it('passes through non-sensitive scalars', () => {
        expect(redactForLog({ crowns: 5, username: 'bob', status: 'active' }))
            .toEqual({ crowns: 5, username: 'bob', status: 'active' });
    });

    it('shallow mode does not redact nested objects', () => {
        const r = redactForLog({ meta: { email: 'a@b.com', crowns: 5 } });
        expect(r.meta).toEqual({ email: 'a@b.com', crowns: 5 }); // nested untouched
    });

    it('deep=true redacts nested sensitive keys', () => {
        const r = redactForLog({ meta: { email: 'a@b.com', crowns: 5 } }, true);
        expect(r.meta.email).toBe('[REDACTED]');
        expect(r.meta.crowns).toBe(5);
    });

    it('returns non-objects unchanged', () => {
        expect(redactForLog(null)).toBeNull();
        expect(redactForLog('string')).toBe('string');
        expect(redactForLog(42)).toBe(42);
        expect(redactForLog([1, 2])).toEqual([1, 2]);
    });

    it('redacts all SENSITIVE regex variants', () => {
        const obj = {
            phone: '555', email: 'x', token: 't', fcm: 'f',
            lat: 1, lng: 2, lon: 3, coordinate: [0, 0],
            message: 'hi', body: 'b', text: 't', content: 'c',
            prompt: 'p', response: 'r', reply: 'x', password: 'pw',
            secret: 's', credential: 'c', apikey: 'k', api_key: 'k2',
            auth: 'a', otp: '123456', code: '654321',
        };
        const r = redactForLog(obj);
        for (const key of Object.keys(obj)) {
            expect(r[key], `key '${key}' should be redacted`).toBe('[REDACTED]');
        }
    });

    it('does not mutate the input object', () => {
        const input = { email: 'a@b.com', crowns: 5 };
        redactForLog(input);
        expect(input.email).toBe('a@b.com');
    });
});
