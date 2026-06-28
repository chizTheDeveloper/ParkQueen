import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const ProgressBar = ({ step, total = 3 }: { step: number; total?: number }) => (
    <div className="flex gap-1.5 w-full max-w-xs mx-auto mb-10">
        {Array.from({ length: total }, (_, i) => i + 1).map(i => (
            <div key={i} className={`h-1 rounded-full flex-1 transition-all duration-300 ${i <= step ? 'bg-blue-500' : 'bg-[var(--color-border)]'}`} />
        ))}
    </div>
);

interface NameEntryViewProps {
    onComplete: (username: string) => void;
}

const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export const NameEntryView: React.FC<NameEntryViewProps> = ({ onComplete }) => {
    const [username, setUsername] = useState('');
    const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const validate = (val: string): string | null => {
        if (val.length < 3) return 'At least 3 characters';
        if (val.length > 20) return '20 characters max';
        if (!USERNAME_REGEX.test(val)) return 'Letters, numbers, underscores only. Must start with a letter.';
        if (/__/.test(val)) return 'No consecutive underscores';
        return null;
    };

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setError('');

        if (!username.trim()) { setAvailability('idle'); return; }

        const validationError = validate(username.trim());
        if (validationError) {
            setAvailability('invalid');
            setError(validationError);
            return;
        }

        setAvailability('checking');
        debounceRef.current = setTimeout(async () => {
            try {
                const normalized = username.trim().toLowerCase();
                const snap = await getDoc(doc(db, 'usernames', normalized));
                setAvailability(snap.exists() ? 'taken' : 'available');
            } catch {
                setAvailability('idle');
            }
        }, 400);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [username]);

    const handleSubmit = async () => {
        if (availability !== 'available' || submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const functions = getFunctions(getApp(), 'us-central1');
            await httpsCallable(functions, 'claimUsername')({ username: username.trim() });
            onComplete(username.trim());
        } catch (e: any) {
            const msg = e?.details || e?.message || 'Failed to claim username';
            if (msg.includes('taken')) setAvailability('taken');
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSkip = () => {
        const generated = `user_${Date.now().toString(36)}`;
        onComplete(generated);
    };

    return (
        <div className="h-full w-full bg-[var(--color-bg)] flex flex-col px-7 pt-14">
            <div>
                <ProgressBar step={3} />
                <h1 className="text-[24px] font-bold text-[var(--color-text)] leading-tight">Choose a username</h1>
                <p className="text-[15px] text-[var(--color-text-secondary)] mt-2 mb-8">This is how neighbors will see you</p>
                <div className="relative">
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                        placeholder="parkking42"
                        className="w-full bg-white/5 border border-[var(--color-border)] rounded-full py-4 px-5 pr-12 text-[var(--color-text)] font-semibold outline-none placeholder-[var(--color-text-secondary)] text-[16px] focus:border-blue-500 transition-all"
                        autoComplete="off"
                        autoFocus
                        maxLength={20}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {availability === 'checking' && <Loader2 size={18} className="text-[var(--color-text-secondary)] animate-spin" />}
                        {availability === 'available' && <Check size={18} className="text-emerald-400" />}
                        {(availability === 'taken' || availability === 'invalid') && <X size={18} className="text-red-400" />}
                    </div>
                </div>
                {availability === 'available' && (
                    <p className="text-emerald-400 text-xs mt-2 font-semibold">Username available</p>
                )}
                {availability === 'taken' && (
                    <p className="text-red-400 text-xs mt-2 font-semibold">Username already taken</p>
                )}
                {error && availability === 'invalid' && (
                    <p className="text-red-400 text-xs mt-2">{error}</p>
                )}
                {error && availability !== 'invalid' && availability !== 'taken' && (
                    <p className="text-red-400 text-xs mt-2">{error}</p>
                )}
            </div>

            <div className="flex-1" />

            <div className="pb-8 space-y-3">
                <button
                    onClick={handleSubmit}
                    disabled={availability !== 'available' || submitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.98] text-white font-semibold text-[16px] py-4 rounded-full shadow-lg shadow-blue-500/30 transition-all disabled:opacity-40 disabled:active:scale-100"
                >
                    {submitting ? 'Claiming...' : 'Start parking smarter'}
                </button>
                <button
                    onClick={handleSkip}
                    className="w-full text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-sm font-semibold py-2 transition-colors"
                >
                    Set up later
                </button>
            </div>
        </div>
    );
};
