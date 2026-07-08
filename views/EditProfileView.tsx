import React, { useState, useEffect, useRef } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db } from '../firebase';
import { ChevronLeft, Check, X, Loader2, ChevronDown } from 'lucide-react';

import { moderateUsername, moderateDisplayName } from '../utils/moderation';

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
    const [dobMonth, setDobMonth] = useState('');
    const [dobDay, setDobDay] = useState('');
    const [dobYear, setDobYear] = useState('');
    const [gender, setGender] = useState('');
    const [homeArea, setHomeArea] = useState('');
    const [driverType, setDriverType] = useState('');
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
                    if (data.dob) {
                        const [y, m, d] = data.dob.split('-');
                        setDobYear(y || '');
                        setDobMonth(m || '');
                        setDobDay(d || '');
                    }
                    setGender(data.gender || '');
                    setHomeArea(data.homeArea || '');
                    setDriverType(data.driverType || '');
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

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

        const nameError = moderateDisplayName(fullName.trim());
        if (nameError) {
            setUsernameError(nameError);
            return;
        }

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
            if (dobMonth && dobDay && dobYear) updates.dob = `${dobYear}-${dobMonth}-${dobDay}`;
            if (gender) updates.gender = gender;
            if (homeArea) updates.homeArea = homeArea;
            if (driverType) updates.driverType = driverType;
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

    const fieldClass = "block w-full px-4 py-3.5 bg-transparent text-[var(--color-text)] outline-none text-sm placeholder:text-[var(--color-text-secondary)]";
    const rowClass = "bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden";

    return (
        <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-24 px-4">
            <div className="max-w-md mx-auto flex flex-col">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={onBack}
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold tracking-wide">Edit Profile</h1>
                </div>

                {loading ? (
                    <div className="flex justify-center p-10">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                    </div>
                ) : user ? (
                    <div className="flex flex-col gap-6">

                        {/* Identity section */}
                        <div>
                            <div className={rowClass}><div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]"><p className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">Identity</p></div>
                                <div className="px-4 pt-3 pb-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Username</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                                        maxLength={20}
                                        className={`${fieldClass} pr-12 pb-3.5`}
                                        placeholder="Choose a username"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        {usernameAvailability === 'checking' && <Loader2 size={16} className="text-[var(--color-text-secondary)] animate-spin" />}
                                        {usernameAvailability === 'available' && <Check size={16} className="text-emerald-400" />}
                                        {(usernameAvailability === 'taken' || usernameAvailability === 'invalid') && <X size={16} className="text-red-400" />}
                                        {usernameAvailability === 'unchanged' && <Check size={16} className="text-[var(--color-text-secondary)]" />}
                                    </div>
                                </div>
                            </div>
                            {usernameAvailability === 'available' && <p className="text-emerald-400 text-[10px] mt-1.5 px-2 font-semibold">Username available</p>}
                            {usernameAvailability === 'taken' && <p className="text-red-400 text-[10px] mt-1.5 px-2 font-semibold">Username already taken</p>}
                            {usernameError && usernameAvailability === 'invalid' && <p className="text-red-400 text-[10px] mt-1.5 px-2">{usernameError}</p>}
                        </div>

                        {/* Personal Info section */}
                        <div>
                            <div className={`${rowClass} divide-y divide-[var(--color-border)]`}><div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]"><p className="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">Personal Info</p></div>

                                {/* Name */}
                                <div>
                                    <div className="px-4 pt-3 pb-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Name</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className={`${fieldClass} pb-3.5`}
                                        placeholder="Your name (optional)"
                                    />
                                </div>

                                {/* Home Area */}
                                <div>
                                    <div className="px-4 pt-3 pb-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Home Area</span>
                                        <span className="text-[10px] text-[var(--color-text-secondary)] ml-1.5 opacity-50">optional</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={homeArea}
                                        onChange={(e) => setHomeArea(e.target.value)}
                                        className={`${fieldClass} pb-3.5`}
                                        placeholder="e.g. Upper West Side, Downtown Brooklyn"
                                    />
                                </div>

                                {/* Driver Type */}
                                <div className="relative">
                                    <div className="px-4 pt-3 pb-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Driver Type</span>
                                        <span className="text-[10px] text-[var(--color-text-secondary)] ml-1.5 opacity-50">optional</span>
                                    </div>
                                    <select
                                        value={driverType}
                                        onChange={(e) => setDriverType(e.target.value)}
                                        className={`${fieldClass} pb-3.5 pr-10 appearance-none cursor-pointer dark:[color-scheme:dark]`}
                                        style={{ backgroundColor: 'var(--color-card)' }}
                                    >
                                        <option value="">Select driver type</option>
                                        <option value="Daily commuter">Daily commuter</option>
                                        <option value="Occasional driver">Occasional driver</option>
                                        <option value="Rideshare / delivery">Rideshare / delivery</option>
                                    </select>
                                    <ChevronDown size={16} className="absolute right-4 bottom-4 text-[var(--color-text-secondary)] pointer-events-none" />
                                </div>

                                {/* Date of Birth */}
                                <div>
                                    <div className="px-4 pt-3 pb-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Date of Birth</span>
                                        <span className="text-[10px] text-[var(--color-text-secondary)] ml-1.5 opacity-50">optional</span>
                                    </div>
                                    <div className="flex gap-2 px-4 pb-3.5">
                                        {[
                                            {
                                                value: dobMonth, setter: setDobMonth, placeholder: 'Month',
                                                options: ['01','02','03','04','05','06','07','08','09','10','11','12'],
                                                labels: ['January','February','March','April','May','June','July','August','September','October','November','December'],
                                            },
                                            {
                                                value: dobDay, setter: setDobDay, placeholder: 'Day',
                                                options: Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')),
                                                labels: null,
                                            },
                                            {
                                                value: dobYear, setter: setDobYear, placeholder: 'Year',
                                                options: Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - 13 - i)),
                                                labels: null,
                                            },
                                        ].map(({ value, setter, placeholder, options, labels }) => (
                                            <div key={placeholder} className="relative flex-1">
                                                <select
                                                    value={value}
                                                    onChange={(e) => setter(e.target.value)}
                                                    className="w-full py-2.5 pl-3 pr-7 rounded-xl text-sm appearance-none cursor-pointer border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[#1e75ff] transition-all dark:[color-scheme:dark]"
                                                    style={{ backgroundColor: 'var(--color-card)' }}
                                                >
                                                    <option value="">{placeholder}</option>
                                                    {options.map((o, i) => (
                                                        <option key={o} value={o}>{labels ? labels[i] : o}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Gender */}
                                <div className="relative">
                                    <div className="px-4 pt-3 pb-1">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Gender</span>
                                        <span className="text-[10px] text-[var(--color-text-secondary)] ml-1.5 opacity-50">optional</span>
                                    </div>
                                    <select
                                        value={gender}
                                        onChange={(e) => setGender(e.target.value)}
                                        className={`${fieldClass} pb-3.5 pr-10 appearance-none cursor-pointer dark:[color-scheme:dark]`}
                                        style={{ backgroundColor: 'var(--color-card)' }}
                                    >
                                        <option value="">Select gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                        <option value="Prefer not to say">Prefer not to say</option>
                                    </select>
                                    <ChevronDown size={16} className="absolute right-4 bottom-4 text-[var(--color-text-secondary)] pointer-events-none" />
                                </div>


                            </div>
                        </div>

                        {/* Save error */}
                        {usernameError && usernameAvailability !== 'invalid' && usernameAvailability !== 'taken' && (
                            <p className="text-red-400 text-xs text-center">{usernameError}</p>
                        )}

                        {/* Save button */}
                        <button
                            onClick={handleSave}
                            disabled={!canSave}
                            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 active:scale-95"
                            style={{
                                background: canSave ? 'linear-gradient(90deg, #1e75ff, #0ea5e9)' : undefined,
                                backgroundColor: canSave ? undefined : '#1e75ff',
                                color: '#fff',
                                boxShadow: canSave ? '0 4px 20px rgba(30,117,255,0.35)' : 'none',
                            }}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>

                    </div>
                ) : (
                    <div className="text-center py-10 bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl text-[var(--color-text-secondary)]">
                        Please log in to edit your profile.
                    </div>
                )}
            </div>
        </div>
    );
};
