import React, { useState } from 'react';

const ProgressBar = ({ step }: { step: number }) => (
    <div className="flex gap-1.5 w-full max-w-xs mx-auto mb-10">
        {[1, 2, 3].map(i => (
            <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? 'bg-blue-500' : 'bg-white/10'}`} />
        ))}
    </div>
);

interface CreateAccountViewProps {
    onContinue: (phone: string) => void;
}

export const CreateAccountView: React.FC<CreateAccountViewProps> = ({ onContinue }) => {
    const [phone, setPhone] = useState('');

    return (
        <div className="h-full w-full bg-[#07162c] flex flex-col px-7 pt-14">
            <div>
                <ProgressBar step={1} />
                <h1 className="text-[24px] font-bold text-white leading-tight">What's your number?</h1>
                <p className="text-[15px] text-white/50 mt-2 mb-8">We'll text you a code to verify it's you</p>
                <div className="relative bg-white/5 rounded-full border border-white/10 focus-within:border-blue-500 transition-all">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
                        <span className="text-white/70 font-semibold text-[15px]">+1</span>
                    </div>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 555-1234"
                        className="w-full bg-transparent py-4 pl-14 pr-5 text-white font-semibold outline-none placeholder-white/25 text-[16px] rounded-full"
                        autoFocus
                    />
                </div>
            </div>

            <div className="flex-1" />

            <div className="pb-8">
                {/* TODO: Wire up Firebase phone auth (RecaptchaVerifier + signInWithPhoneNumber) here */}
                <button
                    onClick={() => onContinue(phone)}
                    disabled={phone.length < 7}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98] text-white font-semibold text-[16px] py-4 rounded-full shadow-lg shadow-blue-500/30 transition-all disabled:opacity-40 disabled:active:scale-100"
                >
                    Send code
                </button>
            </div>
        </div>
    );
};
