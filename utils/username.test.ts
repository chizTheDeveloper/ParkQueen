import { describe, it, expect } from 'vitest';
import { validateUsername, isStaleResponse, USERNAME_MIN, USERNAME_MAX } from './username';
import { moderateUsername } from './moderation';

// ─── Format validation ──────────────────────────────────────────────────────

describe('validateUsername — length', () => {
    it('empty string → min-length error', () => {
        expect(validateUsername('')).toBe('edit_profile.username_min_length');
    });

    it('1 char → min-length error', () => {
        expect(validateUsername('a')).toBe('edit_profile.username_min_length');
    });

    it('2 chars → min-length error', () => {
        expect(validateUsername('ab')).toBe('edit_profile.username_min_length');
    });

    it('exactly MIN chars → valid', () => {
        expect(validateUsername('abc')).toBeNull();
    });

    it('exactly MAX chars → valid', () => {
        expect(validateUsername('a'.repeat(USERNAME_MAX))).toBeNull();
    });

    it('MAX + 1 chars → max-length error', () => {
        expect(validateUsername('a'.repeat(USERNAME_MAX + 1))).toBe('edit_profile.username_max_length');
    });
});

describe('validateUsername — allowed characters', () => {
    it('letters only → valid', () => {
        expect(validateUsername('juanparks')).toBeNull();
    });

    it('letters + digits → valid', () => {
        expect(validateUsername('parker42')).toBeNull();
    });

    it('letters + underscore → valid', () => {
        expect(validateUsername('juan_parks')).toBeNull();
    });

    // Backend allows trailing single underscore — mirror exactly
    it('trailing single underscore → valid (backend allows this)', () => {
        expect(validateUsername('hello_')).toBeNull();
    });

    it('starts with digit → invalid chars error', () => {
        expect(validateUsername('1parker')).toBe('edit_profile.username_invalid_chars');
    });

    it('starts with underscore → invalid chars error', () => {
        expect(validateUsername('_parker')).toBe('edit_profile.username_invalid_chars');
    });

    it('contains space → invalid chars error', () => {
        expect(validateUsername('juan parks')).toBe('edit_profile.username_invalid_chars');
    });

    it('contains hyphen → invalid chars error', () => {
        expect(validateUsername('juan-parks')).toBe('edit_profile.username_invalid_chars');
    });

    it('contains @ → invalid chars error', () => {
        expect(validateUsername('juan@parks')).toBe('edit_profile.username_invalid_chars');
    });

    it('consecutive underscores → double-underscore error', () => {
        expect(validateUsername('a__b')).toBe('edit_profile.username_no_double_underscores');
    });

    it('three consecutive underscores → double-underscore error', () => {
        expect(validateUsername('a___b')).toBe('edit_profile.username_no_double_underscores');
    });
});

// ─── Moderation (uses shared production helper) ─────────────────────────────

describe('moderateUsername — brand impersonation', () => {
    it('parqueen → blocked', () => {
        expect(moderateUsername('parqueen')).not.toBeNull();
    });

    it('parkqueen → blocked', () => {
        expect(moderateUsername('parkqueen')).not.toBeNull();
    });

    it('leet parqueen variant p4rqu33n → blocked', () => {
        expect(moderateUsername('p4rqu33n')).not.toBeNull();
    });

    it('parkqueen_user → blocked', () => {
        expect(moderateUsername('parkqueen_user')).not.toBeNull();
    });
});

describe('moderateUsername — reserved words', () => {
    it('admin → blocked', () => {
        expect(moderateUsername('admin')).not.toBeNull();
    });

    it('admin_jay → blocked (substring of STRONG_RESERVED)', () => {
        expect(moderateUsername('admin_jay')).not.toBeNull();
    });

    it('mod alone → blocked (exact token match)', () => {
        expect(moderateUsername('mod')).not.toBeNull();
    });

    it('modparker → passes (mod not an exact token here)', () => {
        // SHORT_RESERVED uses exact token splitting — modparker has no _ separator
        expect(moderateUsername('modparker')).toBeNull();
    });

    it('support → blocked', () => {
        expect(moderateUsername('support')).not.toBeNull();
    });
});

describe('moderateUsername — clean names pass', () => {
    it('juanparks → passes', () => {
        expect(moderateUsername('juanparks')).toBeNull();
    });

    it('ParkingPro → passes', () => {
        expect(moderateUsername('ParkingPro')).toBeNull();
    });
});

// ─── Stale-response guard ───────────────────────────────────────────────────

describe('isStaleResponse', () => {
    it('same generation → not stale', () => {
        expect(isStaleResponse(3, 3)).toBe(false);
    });

    it('older generation → stale', () => {
        expect(isStaleResponse(3, 2)).toBe(true);
    });

    it('gen 1 older than gen 5 → stale', () => {
        expect(isStaleResponse(5, 1)).toBe(true);
    });

    it('generation 0 (initial) → stale when current is 1', () => {
        expect(isStaleResponse(1, 0)).toBe(true);
    });
});
