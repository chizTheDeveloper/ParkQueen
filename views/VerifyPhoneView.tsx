import React, { useState, useRef, useEffect } from 'react';
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const ProgressBar = ({ step, total = 2 }: { step: number; total?: number }) => (
    <div className="flex gap-1.5 w-full max-w-xs mx-auto mb-10">
        {Array.from({ length: total }, (_, i) => i + 1).map(i => (
            <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? 'bg-blue-500' : 'bg-[var(--color-border)]'}`} />
        ))}
    </div>
);

interface VerifyPhoneViewProps {
    phone: string;
    confirmationResult: ConfirmationResult;
    onVerify: (confirmationResult: ConfirmationResult) => void;
    onEditNumber: () => void;
}

export const VerifyPhoneView: React.FC<VerifyPhoneViewProps> = ({ phone, confirmationResult: initialConfirmation, onVerify, onEditNumber }) => {
    const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [cooldown, setCooldown] = useState(30);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const [confirmation, setConfirmation] = useState<ConfirmationResult>(initialConfirmation);
    const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const handleChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...digits];
        next[index] = value.slice(-1);
        setDigits(next);
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
        if (value && next.every(d => d !== '') && !verifying) {
            setTimeout(() => autoVerify(next.join('')), 100);
        }
    };

    const autoVerify = async (code: string) => {
        setError('');
        setVerifying(true);
        try {
            await confirmation.confirm(code);
            onVerify(confirmation);
        } catch (e: any) {
            console.error('OTP verification failed:', e);
            setError(e.code === 'auth/invalid-verification-code' ? 'Invalid code. Please check and try again.' : (e.message || 'Verification failed.'));
        } finally {
            setVerifying(false);
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        setError('');
        setVerifying(true);
        try {
            const code = digits.join('');
            await confirmation.confirm(code);
            onVerify(confirmation);
        } catch (e: any) {
            console.error('OTP verification failed:', e);
            if (e.code === 'auth/invalid-verification-code') {
                setError('Invalid code. Please check and try again.');
            } else {
                setError(e.message || 'Verification failed. Please try again.');
            }
        } finally {
            setVerifying(false);
        }
    };

    const handleResend = async () => {
        setError('');
        try {
            if (!recaptchaRef.current) {
                recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container-verify', { size: 'invisible' });
            }
            const fullDigits = phone.replace(/\D/g, '');
            const result = await signInWithPhoneNumber(auth, `+1${fullDigits}`, recaptchaRef.current);
            setConfirmation(result);
            setCooldown(30);
        } catch (e: any) {
            console.error('Resend failed:', e);
            setError('Failed to resend code. Please try again.');
        }
    };

    const allFilled = digits.every(d => d !== '');

    return (
        <div className="h-full w-full bg-[var(--color-bg)] flex flex-col px-7 pt-14">
            <div>
                <ProgressBar step={2} />
                <h1 id="otp-heading" className="text-[24px] font-bold text-[var(--color-text)] leading-tight">Enter your code</h1>
                <p className="text-[15px] text-[var(--color-text-secondary)] mt-2">
                    Sent to {phone}{' '}
                    <button onClick={onEditNumber} className="text-blue-400 font-semibold">Edit</button>
                </p>

                <div role="group" aria-labelledby="otp-heading" className="flex gap-2.5 justify-center mt-10">
                    {digits.map((d, i) => (
                        <input
                            key={i}
                            ref={el => { inputRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            aria-label={`Verification code digit ${i + 1} of 6`}
                            value={d}
                            onChange={e => handleChange(i, e.target.value)}
                            onKeyDown={e => handleKeyDown(i, e)}
                            className="w-12 h-14 bg-white/5 border border-[var(--color-border)] rounded-2xl text-center text-[var(--color-text)] text-xl font-bold outline-none focus:border-blue-500 transition-all"
                            autoFocus={i === 0}
                        />
                    ))}
                </div>

                {error && <p role="alert" className="text-red-400 text-sm mt-4 text-center">{error}</p>}

                <p className="text-center text-[14px] text-[var(--color-text-secondary)] mt-6">
                    {cooldown > 0 ? (
                        <>Resend code in {cooldown}s</>
                    ) : (
                        <button onClick={handleResend} className="text-blue-400 font-semibold">Resend code</button>
                    )}
                </p>
            </div>

            <div className="flex-1" />

            <div className="pb-8">
                <button
                    onClick={handleVerify}
                    disabled={!allFilled || verifying}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98] text-white font-semibold text-[16px] py-4 rounded-full shadow-lg shadow-blue-500/30 transition-all disabled:opacity-40 disabled:active:scale-100"
                >
                    {verifying ? 'Verifying...' : 'Verify'}
                </button>
            </div>
            <div id="recaptcha-container-verify" />
        </div>
    );
};
