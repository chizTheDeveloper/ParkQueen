import React, { useState } from 'react';

const ProgressBar = ({ step, total = 3 }: { step: number; total?: number }) => (
    <div className="flex gap-1.5 w-full max-w-xs mx-auto mb-10">
        {Array.from({ length: total }, (_, i) => i + 1).map(i => (
            <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? 'bg-blue-500' : 'bg-[var(--color-border)]'}`} />
        ))}
    </div>
);

interface NameEntryViewProps {
    onComplete: (fullName: string) => void;
}

export const NameEntryView: React.FC<NameEntryViewProps> = ({ onComplete }) => {
    const [fullName, setFullName] = useState('');

    return (
        <div className="h-full w-full bg-[var(--color-bg)] flex flex-col px-7 pt-14">
            <div>
                <ProgressBar step={3} />
                <h1 className="text-[24px] font-bold text-[var(--color-text)] leading-tight">What should we call you?</h1>
                <p className="text-[15px] text-[var(--color-text-secondary)] mt-2 mb-8">This is how neighbors will see you</p>
                <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-white/5 border border-[var(--color-border)] rounded-full py-4 px-5 text-[var(--color-text)] font-semibold outline-none placeholder-[var(--color-text-secondary)] text-[16px] focus:border-blue-500 transition-all"
                    autoComplete="name"
                    autoFocus
                />
            </div>

            <div className="flex-1" />

            <div className="pb-8">
                <button
                    onClick={() => onComplete(fullName.trim())}
                    disabled={!fullName.trim()}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98] text-white font-semibold text-[16px] py-4 rounded-full shadow-lg shadow-blue-500/30 transition-all disabled:opacity-40 disabled:active:scale-100"
                >
                    Start parking smarter
                </button>
            </div>
        </div>
    );
};
