import React, { useState, useEffect, useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const ProgressBar = ({ step, total = 2 }: { step: number; total?: number }) => (
    <div className="flex gap-1.5 w-full max-w-xs mx-auto mb-10">
        {Array.from({ length: total }, (_, i) => i + 1).map(i => (
            <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? 'bg-blue-500' : 'bg-[var(--color-border)]'}`} />
        ))}
    </div>
);

interface CreateAccountViewProps {
    onContinue: (phone: string, confirmationResult: ConfirmationResult) => void;
}

export const CreateAccountView: React.FC<CreateAccountViewProps> = ({ onContinue }) => {
    const [phone, setPhone] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

    useEffect(() => {
        if (!recaptchaRef.current) {
            recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
        }
        return () => { recaptchaRef.current = null; };
    }, []);

    const handleSend = async () => {
        setError('');
        setSending(true);
        try {
            const digits = phone.replace(/\D/g, '');
            const fullNumber = `+1${digits}`;
            const result = await signInWithPhoneNumber(auth, fullNumber, recaptchaRef.current!);
            onContinue(phone, result);
        } catch (e: any) {
            console.error('Send OTP failed:', e);
            if (e.code === 'auth/too-many-requests') {
                setError('Too many attempts. Please try again later.');
            } else if (e.code === 'auth/invalid-phone-number') {
                setError('Invalid phone number. Please check and try again.');
            } else {
                setError(e.message || 'Failed to send code. Please try again.');
            }
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="h-full w-full bg-[var(--color-bg)] flex flex-col px-7 pt-14">
            <div>
                <ProgressBar step={1} />
                <h1 className="text-[24px] font-bold text-[var(--color-text)] leading-tight">What's your number?</h1>
                <p className="text-[15px] text-[var(--color-text-secondary)] mt-2 mb-8">We'll text you a code to verify it's you</p>
                <div className="relative bg-white/5 rounded-full border border-[var(--color-border)] focus-within:border-blue-500 transition-all">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
                        <span className="text-[var(--color-text-secondary)] font-semibold text-[15px]">+1</span>
                    </div>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 555-1234"
                        className="w-full bg-transparent py-4 pl-14 pr-5 text-[var(--color-text)] font-semibold outline-none placeholder-[var(--color-text-secondary)] text-[16px] rounded-full"
                        autoFocus
                    />
                </div>
                {error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
            </div>

            <div className="flex-1" />

            <div className="pb-8">
                <button
                    onClick={handleSend}
                    disabled={phone.replace(/\D/g, '').length < 10 || sending}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98] text-white font-semibold text-[16px] py-4 rounded-full shadow-lg shadow-blue-500/30 transition-all disabled:opacity-40 disabled:active:scale-100"
                >
                    {sending ? 'Sending...' : 'Send code'}
                </button>
            </div>
            <div id="recaptcha-container" />
        </div>
    );
};
