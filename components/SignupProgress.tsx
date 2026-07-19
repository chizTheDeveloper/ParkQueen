import React from 'react';

export const SignupProgress = ({ step, total = 4 }: { step: number; total?: number }) => (
    <div className="flex gap-1.5 w-full mb-5">
        {Array.from({ length: total }, (_, i) => i + 1).map(i => (
            <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? 'bg-blue-500' : 'bg-[var(--color-border)]'}`} />
        ))}
    </div>
);
