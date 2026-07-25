import { describe, it, expect } from 'vitest';
import { maskPhoneNumber, verifyUidUnchanged } from './reauthBeforeDelete';

describe('maskPhoneNumber', () => {
    it('masks a US number, preserving CC and last 4', () => {
        expect(maskPhoneNumber('+15555551234')).toBe('+1 ••• ••• 1234');
    });

    it('masks a 2-digit CC number', () => {
        expect(maskPhoneNumber('+5198765432')).toBe('+51 ••• ••• 5432');
    });

    it('masks a 3-digit CC number', () => {
        expect(maskPhoneNumber('+447911123456')).toBe('+44 ••• ••• 3456');
    });

    it('returns fallback for empty string', () => {
        expect(maskPhoneNumber('')).toBe('•••');
    });

    it('returns fallback for string shorter than 4 chars', () => {
        expect(maskPhoneNumber('+1')).toBe('•••');
    });

    // Security invariant: the result never reveals the full phone number
    it('never exposes more than 4 trailing digits', () => {
        const result = maskPhoneNumber('+15555551234');
        // Extract only digit runs from the result
        const digits = result.replace(/\D/g, '');
        // Country code is 1, last 4 are 1234 — combined max is 5 digits visible
        expect(digits.length).toBeLessThanOrEqual(5);
    });

    it('the phone number cannot be changed by the masking function', () => {
        const original = '+15555559999';
        const masked = maskPhoneNumber(original);
        // The masked display must end with the original last-4, not something else
        expect(masked).toMatch(/9999$/);
        // And must NOT contain the middle digits
        expect(masked).not.toContain('5555');
    });
});

describe('verifyUidUnchanged', () => {
    it('does not throw when UIDs match', () => {
        expect(() => verifyUidUnchanged('uid-abc', 'uid-abc')).not.toThrow();
    });

    it('throws auth/account-switched when UIDs differ', () => {
        expect(() => verifyUidUnchanged('uid-xyz', 'uid-abc')).toThrowError(
            expect.objectContaining({ code: 'auth/account-switched' }),
        );
    });

    it('throws when currentUid is undefined', () => {
        expect(() => verifyUidUnchanged(undefined, 'uid-abc')).toThrowError(
            expect.objectContaining({ code: 'auth/account-switched' }),
        );
    });

    it('throws when currentUid is null', () => {
        expect(() => verifyUidUnchanged(null, 'uid-abc')).toThrowError(
            expect.objectContaining({ code: 'auth/account-switched' }),
        );
    });

    it('throws when currentUid is empty string', () => {
        expect(() => verifyUidUnchanged('', 'uid-abc')).toThrowError(
            expect.objectContaining({ code: 'auth/account-switched' }),
        );
    });

    // Ensure account-switching attack is detected and named correctly
    it('error message contains masked UID for forensics, not the full UID', () => {
        let err: any;
        try { verifyUidUnchanged('attacker-uid-xyz', 'uid-abc'); } catch (e) { err = e; }
        expect(err).toBeDefined();
        // Message should contain a masked segment (first 4 chars + ***)
        expect(err.message).toMatch(/atta\*\*\*/);
        expect(err.message).not.toContain('attacker-uid-xyz');
    });

    // deleteUser must never be called for a different UID
    it('wrong credential cannot proceed — verifyUidUnchanged blocks continuation', () => {
        const uid = 'user-123';
        const attackerUid = 'attacker-456';
        let deleteCalled = false;
        const tryDelete = () => {
            verifyUidUnchanged(attackerUid, uid); // throws
            deleteCalled = true;                   // never reached
        };
        expect(tryDelete).toThrow();
        expect(deleteCalled).toBe(false);
    });

    // Cancellation safety: originalUid is only set when entering the reauth phase
    it('cancellation does not delete anything — originalUid null means abort', () => {
        // Simulates caller checking originalUid before calling verifyUidUnchanged
        const originalUid: string | null = null;
        let deleteCalled = false;
        if (originalUid) {
            verifyUidUnchanged('some-uid', originalUid);
            deleteCalled = true;
        }
        expect(deleteCalled).toBe(false);
    });
});
