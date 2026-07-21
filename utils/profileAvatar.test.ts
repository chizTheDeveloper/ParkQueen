import { describe, it, expect } from 'vitest';
import { getInitials } from './profileAvatar';

describe('getInitials', () => {
    it('returns first char of username when not a generated handle', () => {
        expect(getInitials('parkqueen')).toBe('P');
    });

    it('uppercases the initial', () => {
        expect(getInitials('alice')).toBe('A');
    });

    it('ignores user_ generated handles and falls through to fullName', () => {
        expect(getInitials('user_abc123', 'Jay Castro')).toBe('JC');
    });

    it('uses fullName two-word initials when username is user_', () => {
        expect(getInitials('user_xyz', 'Maria Lopez')).toBe('ML');
    });

    it('uses first initial for single-word fullName', () => {
        expect(getInitials('user_xyz', 'Madonna')).toBe('M');
    });

    it('returns null when both username and fullName are missing', () => {
        expect(getInitials()).toBeNull();
    });

    it('returns null when username is user_ and fullName is missing', () => {
        expect(getInitials('user_abc')).toBeNull();
    });

    it('uses last word for second initial in multi-word names', () => {
        expect(getInitials('user_x', 'First Middle Last')).toBe('FL');
    });
});
