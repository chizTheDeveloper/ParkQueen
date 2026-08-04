'use strict';

const fs = require('fs');
const path = require('path');

let indexModule;
try {
    indexModule = require('./index.js');
} catch (e) {
    console.warn('[generateEmailOTP] Could not load index.js:', e.message);
}

describe('GE — generateEmailOTP security invariants', () => {
    it('(GE-1) generates a six-digit OTP with a cryptographically secure integer source', () => {
        expect(indexModule?._generateEmailOtpCode).toBeTypeOf('function');
        expect(indexModule._generateEmailOtpCode()).toMatch(/^\d{6}$/);
        expect(indexModule._generateEmailOtpCode(() => 100000)).toBe('100000');
        expect(indexModule._generateEmailOtpCode(() => 999999)).toBe('999999');

        const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
        const block = source.slice(
            source.indexOf('exports.generateEmailOTP ='),
            source.indexOf('// 5) Verify email OTP'),
        );
        expect(block).toContain('_generateEmailOtpCode()');
        expect(source).toContain("require('crypto').randomInt");
        expect(block).not.toContain('Math.random');
    });
});
