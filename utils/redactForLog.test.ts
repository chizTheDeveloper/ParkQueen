import { describe, it, expect } from 'vitest';
import { redactForLog } from './redactForLog';

describe('redactForLog', () => {
    it('passes through non-sensitive keys unchanged', () => {
        const result = redactForLog({ uid: 'abc123', status: 'ok', count: 5 });
        expect(result).toEqual({ uid: 'abc123', status: 'ok', count: 5 });
    });

    it('redacts phone', () => {
        expect(redactForLog({ phone: '+15555551234', uid: 'x' })).toEqual({
            phone: '[REDACTED]', uid: 'x',
        });
    });

    it('redacts email', () => {
        expect(redactForLog({ email: 'user@example.com' }).email).toBe('[REDACTED]');
    });

    it('redacts FCM token (key contains "token")', () => {
        expect(redactForLog({ fcmToken: 'tok123', name: 'Jay' })).toEqual({
            fcmToken: '[REDACTED]', name: 'Jay',
        });
    });

    it('redacts coordinate fields (lat, lng, lon)', () => {
        const r = redactForLog({ lat: 40.7, lng: -74.0, uid: 'x' });
        expect(r.lat).toBe('[REDACTED]');
        expect(r.lng).toBe('[REDACTED]');
        expect(r.uid).toBe('x');
    });

    it('redacts message body', () => {
        const r = redactForLog({ messageBody: 'hello', senderId: 'u1' });
        expect(r.messageBody).toBe('[REDACTED]');
        expect(r.senderId).toBe('u1');
    });

    it('redacts text and content', () => {
        expect(redactForLog({ text: 'hi', content: 'stuff', uid: 'x' })).toEqual({
            text: '[REDACTED]', content: '[REDACTED]', uid: 'x',
        });
    });

    it('redacts AI prompt and response', () => {
        const r = redactForLog({ prompt: 'summarize this', response: 'summary here' });
        expect(r.prompt).toBe('[REDACTED]');
        expect(r.response).toBe('[REDACTED]');
    });

    it('redacts reply (smart reply candidate)', () => {
        expect(redactForLog({ reply: 'On my way!' }).reply).toBe('[REDACTED]');
    });

    it('redacts password, secret, credential', () => {
        const r = redactForLog({ password: 'hunter2', secret: 'abc', credential: 'cred' });
        expect(r.password).toBe('[REDACTED]');
        expect(r.secret).toBe('[REDACTED]');
        expect(r.credential).toBe('[REDACTED]');
    });

    it('redacts auth and otp', () => {
        const r = redactForLog({ authToken: 'tok', otp: '123456' });
        expect(r.authToken).toBe('[REDACTED]');
        expect(r.otp).toBe('[REDACTED]');
    });

    it('does NOT redact "uid", "status", "step", "error"', () => {
        const r = redactForLog({ uid: 'u1', status: 'failed', step: 'userDoc', error: 'timeout' });
        expect(r).toEqual({ uid: 'u1', status: 'failed', step: 'userDoc', error: 'timeout' });
    });

    it('handles nested objects with deep=true', () => {
        const r = redactForLog({ meta: { phone: '+1', uid: 'u2' }, uid: 'u1' }, true);
        expect((r.meta as any).phone).toBe('[REDACTED]');
        expect((r.meta as any).uid).toBe('u2');
        expect(r.uid).toBe('u1');
    });

    it('does NOT recurse nested objects without deep=true', () => {
        const inner = { phone: '+1' };
        const r = redactForLog({ meta: inner, uid: 'u1' });
        // Without deep, nested objects are passed through unchanged
        expect(r.meta).toBe(inner);
    });

    it('handles null and number values safely', () => {
        const r = redactForLog({ uid: null as any, count: 0 });
        expect(r.uid).toBeNull();
        expect(r.count).toBe(0);
    });
});
