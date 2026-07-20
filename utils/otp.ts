/** Keep only digits, max 6 characters */
export const filterOtpInput = (raw: string): string =>
    raw.replace(/\D/g, '').slice(0, 6);

/** Map a Firebase OTP error code to the corresponding i18n message key */
export const otpErrorKey = (code: string): string => {
    switch (code) {
        case 'auth/invalid-verification-code': return 'verify_phone.invalid_code';
        case 'auth/code-expired':              return 'verify_phone.expired';
        case 'auth/too-many-requests':         return 'verify_phone.too_many';
        default:                               return 'verify_phone.failed_retry';
    }
};

/** True when the OTP string is exactly 6 digits */
export const isOtpComplete = (code: string): boolean => code.length === 6;
