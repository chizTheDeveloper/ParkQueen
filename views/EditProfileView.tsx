import React, { useState, useEffect, useRef } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db } from '../firebase';
import { ChevronLeft, Check, X, Loader2 } from 'lucide-react';

import { moderateUsername } from '../utils/moderation';

const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

function validateUsername(val: string): string | null {
    if (val.length < 3) return 'At least 3 characters';
    if (val.length > 20) return '20 characters max';
    if (!USERNAME_REGEX.test(val)) return 'Letters, numbers, underscores only. Must start with a letter.';
    if (/__/.test(val)) return 'No consecutive underscores';
    return moderateUsername(val);
}

export const EditProfileView = ({ onBack }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState('');
    const [originalUsername, setOriginalUsername] = useState('');
    const [usernameAvailability, setUsernameAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'unchanged'>('idle');
    const [usernameError, setUsernameError] = useState('');
    const [fullName, setFullName] = useState('');
    const [dob, setDob] = useState('');
    const [gender, setGender] = useState('');
    const [saving, setSaving] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setUser(data);
                    setUsername(data.username || '');
                    setOriginalUsername(data.username || '');
                    setFullName(data.fullName || '');
                    setDob(data.dob || '');
                    setGender(data.gender || '');
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Username availability check
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setUsernameError('');

        const trimmed = username.trim();
        if (!trimmed) { setUsernameAvailability('idle'); return; }
        if (trimmed.toLowerCase() === originalUsername.toLowerCase()) { setUsernameAvailability('unchanged'); return; }

        const err = validateUsername(trimmed);
        if (err) { setUsernameAvailability('invalid'); setUsernameError(err); return; }

        setUsernameAvailability('checking');
        debounceRef.current = setTimeout(async () => {
            try {
                const snap = await getDoc(doc(db, 'usernames', trimmed.toLowerCase()));
                setUsernameAvailability(snap.exists() ? 'taken' : 'available');
            } catch { setUsernameAvailability('idle'); }
        }, 400);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [username, originalUsername]);

    const handleSave = async () => {
        if (!user || saving) return;
        setSaving(true);
        setUsernameError('');

        try {
            const trimmedUsername = username.trim();
            const usernameChanged = trimmedUsername.toLowerCase() !== originalUsername.toLowerCase();

            if (usernameChanged) {
                const functions = getFunctions(getApp(), 'us-central1');
                await httpsCallable(functions, 'claimUsername')({ username: trimmedUsername });
            }

            const updates: Record<string, any> = { fullName };
            if (dob) updates.dob = dob;
            if (gender) updates.gender = gender;
            if (!usernameChanged && Object.keys(updates).length > 0) {
                await updateDoc(doc(db, 'users', user.id), updates);
            }

            onBack();
        } catch (e: any) {
            const msg = e?.details || e?.message || 'Failed to save';
            setUsernameError(msg);
        } finally {
            setSaving(false);
        }
    };

    const usernameChanged = username.trim().toLowerCase() !== originalUsername.toLowerCase();
    const canSave = !saving && (
        (!usernameChanged) ||
        (usernameChanged && usernameAvailability === 'available')
    );

    return (
        <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4">
            <div className="max-w-md mx-auto flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold text-[var(--color-text)] tracking-wide">Edit Profile</h1>
                </div>

                {loading ? (
                    <div className="flex justify-center p-10"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div></div>
                ) : user ? (
                    <div className="space-y-5 bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-3xl p-5 shadow-xl">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 px-1">Username</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                                    maxLength={20}
                                    className="block w-full px-4 py-3 pr-12 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl text-[var(--color-text)] outline-none focus:border-[#1e75ff] transition-all text-sm"
                                    placeholder="Choose a username"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    {usernameAvailability === 'checking' && <Loader2 size={16} className="text-[var(--color-text-secondary)] animate-spin" />}
                                    {usernameAvailability === 'available' && <Check size={16} className="text-emerald-400" />}
                                    {(usernameAvailability === 'taken' || usernameAvailability === 'invalid') && <X size={16} className="text-red-400" />}
                                    {usernameAvailability === 'unchanged' && <Check size={16} className="text-[var(--color-text-secondary)]" />}
                                </div>
                            </div>
                            {usernameAvailability === 'available' && <p className="text-emerald-400 text-[10px] mt-1 px-1 font-semibold">Username available</p>}
                            {usernameAvailability === 'taken' && <p className="text-red-400 text-[10px] mt-1 px-1 font-semibold">Username already taken</p>}
                            {usernameError && usernameAvailability === 'invalid' && <p className="text-red-400 text-[10px] mt-1 px-1">{usernameError}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 px-1">Name</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="block w-full px-4 py-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl text-[var(--color-text)] outline-none focus:border-[#1e75ff] transition-all text-sm"
                                placeholder="Your name (optional)"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 px-1">Date of Birth</label>
                            <input
                                type="date"
                                value={dob}
                                onChange={(e) => setDob(e.target.value)}
                                className="block w-full px-4 py-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl text-[var(--color-text)] outline-none focus:border-[#1e75ff] transition-all text-sm dark:[color-scheme:dark]"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 px-1">Gender</label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                className="block w-full px-4 py-3 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl text-[var(--color-text)] outline-none focus:border-[#1e75ff] transition-all text-sm appearance-none"
                            >
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                        </div>

                        {usernameError && usernameAvailability !== 'invalid' && usernameAvailability !== 'taken' && (
                            <p className="text-red-400 text-xs text-center">{usernameError}</p>
                        )}

                        <div className="pt-2">
                            <button
                                onClick={handleSave}
                                disabled={!canSave}
                                className="w-full bg-[#1e75ff] hover:bg-blue-600 active:scale-95 text-white font-bold py-3.5 rounded-2xl transition-all text-sm shadow-md shadow-blue-500/20 disabled:opacity-40"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10 bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl text-[var(--color-text-secondary)]">Please log in to edit your profile.</div>
                )}
            </div>
        </div>
    );
};
