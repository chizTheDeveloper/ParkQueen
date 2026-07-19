import React, { useState, useEffect, useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { t, useLang } from '../i18n';
import { ChevronLeft, Shield, Loader2 } from 'lucide-react';
import { SignupProgress } from '../components/SignupProgress';

interface CreateAccountViewProps {
    onContinue: (phone: string, confirmationResult: ConfirmationResult) => void;
    onBack: () => void;
}

const formatPhone = (digits: string): string => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const CreateAccountView: React.FC<CreateAccountViewProps> = ({ onContinue, onBack }) => {
    useLang();
    const [digits, setDigits] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

    const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    useEffect(() => {
        if (!recaptchaRef.current) {
            recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
        }
        return () => { recaptchaRef.current = null; };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value.replace(/\D/g, '');
        // Normalize pasted +1XXXXXXXXXX (11 digits starting with 1)
        if (raw.length === 11 && raw.startsWith('1')) raw = raw.slice(1);
        setDigits(raw.slice(0, 10));
    };

    const handleSend = async () => {
        if (digits.length < 10 || sending) return;
        setError('');
        setSending(true);
        try {
            const result = await signInWithPhoneNumber(auth, `+1${digits}`, recaptchaRef.current!);
            onContinue(formatPhone(digits), result);
        } catch (e: any) {
            console.error('Send OTP failed:', e);
            if (e.code === 'auth/too-many-requests') setError(t('create_account.error_too_many'));
            else if (e.code === 'auth/invalid-phone-number') setError(t('create_account.error_invalid'));
            else setError(e.message || t('create_account.error_generic'));
        } finally {
            setSending(false);
        }
    };

    const isValid = digits.length === 10;

    return (
        <div className="h-full w-full bg-[var(--color-bg)] flex flex-col px-6 pt-10">

            {/* Top nav row */}
            <div className="flex items-center justify-between mb-3">
                <button
                    onClick={onBack}
                    aria-label={t('create_account.back_aria')}
                    className="w-11 h-11 -ml-1 flex items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text)] active:opacity-70 transition-all"
                >
                    <ChevronLeft size={22} />
                </button>
                <span className="text-[12px] font-semibold text-[var(--color-text-secondary)] tracking-wide">
                    {t('create_account.step')}
                </span>
            </div>

            {/* 4-segment progress */}
            <SignupProgress step={1} />

            {/* Content block — entrance animation */}
            <div className={prefersReduced ? '' : 'auth-fade-in'}>

                {/* Eyebrow */}
                <p className="text-[11px] font-bold tracking-[0.13em] text-blue-400 uppercase mb-3 mt-2">
                    {t('create_account.eyebrow')}
                </p>

                {/* Headline */}
                <h1 className="text-[26px] font-bold text-[var(--color-text)] leading-tight mb-2">
                    {t('create_account.headline')}
                </h1>

                {/* Supporting */}
                <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed mb-8">
                    {t('create_account.supporting')}
                </p>

                {/* Phone input */}
                <label
                    className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-secondary)] mb-2"
                    htmlFor="phone-input"
                >
                    {t('create_account.label')}
                </label>
                <div
                    className={`flex items-center bg-[var(--color-card)] border rounded-[18px] transition-all duration-[180ms] ${
                        error
                            ? 'border-red-500/70 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]'
                            : 'border-[var(--color-border)] focus-within:border-blue-500 focus-within:shadow-[0_0_0_3px_rgba(30,117,255,0.18)]'
                    }`}
                    style={{ height: 58 }}
                >
                    {/* Country code — static display, no interaction affordance */}
                    <div
                        className="flex items-center gap-2 pl-4 pr-3 border-r border-[var(--color-border)] shrink-0 h-full select-none"
                        aria-hidden="true"
                    >
                        <span className="text-[18px] leading-none">🇺🇸</span>
                        <span className="text-[15px] font-semibold text-[var(--color-text-secondary)]">+1</span>
                    </div>

                    <input
                        id="phone-input"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        aria-label={t('create_account.label')}
                        aria-describedby={error ? 'phone-error' : 'phone-trust'}
                        aria-invalid={!!error}
                        value={formatPhone(digits)}
                        onChange={handleChange}
                        placeholder="(555) 555-1234"
                        className="flex-1 bg-transparent px-4 h-full text-[var(--color-text)] font-semibold outline-none placeholder-[var(--color-text-secondary)]/50 text-[16px]"
                    />
                </div>

                {/* Error or trust note */}
                {error ? (
                    <p id="phone-error" role="alert" className="text-red-400 text-[13px] mt-2 font-medium">
                        {error}
                    </p>
                ) : (
                    <p id="phone-trust" className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)] mt-2.5">
                        <Shield size={12} className="shrink-0 opacity-60" />
                        {t('create_account.trust')}
                    </p>
                )}
            </div>

            {/* Spacer — capped so CTA stays reachable when keyboard is open */}
            <div className="flex-1" style={{ maxHeight: 56 }} />

            {/* CTA */}
            <div className="pb-8">
                <button
                    onClick={handleSend}
                    disabled={!isValid || sending}
                    aria-busy={sending}
                    className={`w-full font-bold text-[16px] rounded-full flex items-center justify-center gap-2 transition-all duration-[160ms] ${
                        isValid && !sending
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.985] text-white shadow-lg shadow-blue-500/25'
                            : 'text-white/45 cursor-not-allowed'
                    }`}
                    style={{
                        height: 58,
                        ...((!isValid || sending) && { background: 'rgba(20, 40, 80, 0.55)' }),
                    }}
                >
                    {sending ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            {t('create_account.sending')}
                        </>
                    ) : (
                        t('create_account.send')
                    )}
                </button>
            </div>

            <div id="recaptcha-container" />
        </div>
    );
};
