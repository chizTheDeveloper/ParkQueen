import React, { useState, useRef, useEffect } from 'react';

const ProgressBar = ({ step }: { step: number }) => (
    <div className="flex gap-1.5 w-full max-w-xs mx-auto mb-10">
        {[1, 2, 3].map(i => (
            <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? 'bg-blue-500' : 'bg-white/10'}`} />
        ))}
    </div>
);

interface VerifyPhoneViewProps {
    phone: string;
    onVerify: () => void;
    onEditNumber: () => void;
}

export const VerifyPhoneView: React.FC<VerifyPhoneViewProps> = ({ phone, onVerify, onEditNumber }) => {
    const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [cooldown, setCooldown] = useState(30);

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
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const allFilled = digits.every(d => d !== '');

    return (
        <div className="h-full w-full bg-[#07162c] flex flex-col px-7 pt-14">
            <div>
                <ProgressBar step={2} />
                <h1 className="text-[24px] font-bold text-white leading-tight">Enter your code</h1>
                <p className="text-[15px] text-white/50 mt-2">
                    Sent to {phone}{' '}
                    <button onClick={onEditNumber} className="text-blue-400 font-semibold">Edit</button>
                </p>

                <div className="flex gap-2.5 justify-center mt-10">
                    {digits.map((d, i) => (
                        <input
                            key={i}
                            ref={el => { inputRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={d}
                            onChange={e => handleChange(i, e.target.value)}
                            onKeyDown={e => handleKeyDown(i, e)}
                            className="w-12 h-14 bg-white/5 border border-white/10 rounded-2xl text-center text-white text-xl font-bold outline-none focus:border-blue-500 transition-all"
                            autoFocus={i === 0}
                        />
                    ))}
                </div>

                <p className="text-center text-[14px] text-white/40 mt-6">
                    {cooldown > 0 ? (
                        <>Resend code in {cooldown}s</>
                    ) : (
                        // TODO: Wire up actual resend logic when Firebase phone auth is integrated
                        <button onClick={() => setCooldown(30)} className="text-blue-400 font-semibold">Resend code</button>
                    )}
                </p>
            </div>

            <div className="flex-1" />

            <div className="pb-8">
                {/* TODO: Verify the OTP code with Firebase confirmationResult.confirm(code) */}
                <button
                    onClick={onVerify}
                    disabled={!allFilled}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98] text-white font-semibold text-[16px] py-4 rounded-full shadow-lg shadow-blue-500/30 transition-all disabled:opacity-40 disabled:active:scale-100"
                >
                    Verify
                </button>
            </div>
        </div>
    );
};
