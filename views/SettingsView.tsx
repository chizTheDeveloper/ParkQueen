import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Edit, Mail, Bell, MapPin, Moon, LogOut, Trash2, Check } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { db } from '../firebase';
import { AppView } from '../types';

interface SettingsViewProps {
    user: any;
    setView: (view: AppView) => void;
    onBack: () => void;
    onLogout: () => void;
    onDeleteAccount: () => void;
    theme: string;
    toggleTheme: () => void;
}

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!checked)} className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[#1e75ff]' : 'bg-[var(--color-border)]'}`}>
        <div className={`absolute top-0.5 left-[2px] w-5 h-5 rounded-full shadow transition-transform ${checked ? 'translate-x-5 bg-white' : 'bg-white dark:bg-gray-300'}`} />
    </button>
);

export const SettingsView: React.FC<SettingsViewProps> = ({ user, setView, onBack, onLogout, onDeleteAccount, theme, toggleTheme }) => {
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(user?.notificationsEnabled ?? true);
    const [sharePreciseLocation, setSharePreciseLocation] = useState<boolean>(user?.sharePreciseLocation ?? true);
    const [emailStep, setEmailStep] = useState<'view' | 'input' | 'otp'>('view');
    const [emailDraft, setEmailDraft] = useState(user?.email || '');
    const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
    const [otpCooldown, setOtpCooldown] = useState(0);
    const [emailError, setEmailError] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (otpCooldown <= 0) return;
        const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [otpCooldown]);

    const handleSendEmailOTP = async () => {
        setEmailError('');
        setEmailSending(true);
        try {
            const functions = getFunctions(getApp(), 'us-central1');
            await httpsCallable(functions, 'generateEmailOTP')({ email: emailDraft.trim() });
            setEmailStep('otp');
            setOtpDigits(Array(6).fill(''));
            setOtpCooldown(60);
        } catch (e: any) {
            setEmailError(e.details || e.message || 'Failed to send code.');
        } finally {
            setEmailSending(false);
        }
    };

    const handleVerifyEmailOTP = async () => {
        setEmailError('');
        setEmailSending(true);
        try {
            const functions = getFunctions(getApp(), 'us-central1');
            await httpsCallable(functions, 'verifyEmailOTP')({ email: emailDraft.trim(), code: otpDigits.join('') });
            setEmailStep('view');
        } catch (e: any) {
            setEmailError(e.details || e.message || 'Verification failed.');
        } finally {
            setEmailSending(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...otpDigits];
        next[index] = value.slice(-1);
        setOtpDigits(next);
        if (value && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
    };

    const updatePref = (field: string, value: boolean) => {
        if (user?.id) {
            updateDoc(doc(db, 'users', user.id), { [field]: value }).catch(e => console.warn(`Failed to update ${field}`, e));
        }
    };

    return (
        <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4">
            <div className="max-w-md mx-auto flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-xl font-bold text-[var(--color-text)] tracking-wide">Settings</h2>
                </div>

                <div className="space-y-6">
                    {/* Account */}
                    <div>
                        <h3 className="font-bold text-[var(--color-text-secondary)] text-xs uppercase tracking-wider mb-2.5 px-1">Account</h3>
                        <div className="bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl divide-y divide-[var(--color-border)] overflow-hidden">
                            <button onClick={() => setView(AppView.EDIT_PROFILE)} className="w-full p-4 flex items-center justify-between text-left hover:bg-[#0b2240]/40 transition-colors">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Edit size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-[var(--color-text)] text-sm">Edit profile</h4>
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Update your information</p>
                                    </div>
                                </div>
                                <ChevronLeft size={16} className="text-[var(--color-text-secondary)] rotate-180" />
                            </button>
                            <div className="w-full p-4">
                                {emailStep === 'otp' ? (
                                    <div>
                                        <div className="flex items-center gap-3.5 mb-3">
                                            <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Mail size={18} /></div>
                                            <div>
                                                <h4 className="font-bold text-[var(--color-text)] text-sm">Enter code</h4>
                                                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Sent to {emailDraft}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 justify-center mb-3">
                                            {otpDigits.map((d, i) => (
                                                <input key={i} ref={el => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={d}
                                                    onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)}
                                                    className="w-10 h-12 bg-white/5 border border-[var(--color-border)] rounded-xl text-center text-[var(--color-text)] text-lg font-bold outline-none focus:border-blue-500 transition-all"
                                                    autoFocus={i === 0} />
                                            ))}
                                        </div>
                                        {emailError && <p className="text-red-400 text-xs text-center mb-2">{emailError}</p>}
                                        <div className="flex items-center justify-between">
                                            <button onClick={() => setEmailStep('input')} className="text-[var(--color-text-secondary)] text-xs">Back</button>
                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : <button onClick={handleSendEmailOTP} className="text-blue-400 font-semibold">Resend</button>}
                                            </p>
                                        </div>
                                        <button onClick={handleVerifyEmailOTP} disabled={otpDigits.some(d => !d) || emailSending}
                                            className="w-full mt-3 py-2.5 rounded-xl font-bold text-white text-sm active:scale-95 transition-transform disabled:opacity-40"
                                            style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}>
                                            {emailSending ? 'Verifying...' : 'Verify'}
                                        </button>
                                    </div>
                                ) : emailStep === 'input' ? (
                                    <div className="flex items-center gap-3.5">
                                        <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Mail size={18} /></div>
                                        <div className="flex-1">
                                            <input type="email" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} placeholder="you@example.com"
                                                className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text)] text-sm outline-none focus:border-[#1e75ff] transition-all" autoFocus />
                                            {emailError && <p className="text-red-400 text-xs mt-1">{emailError}</p>}
                                        </div>
                                        <button onClick={handleSendEmailOTP} disabled={!emailDraft.includes('@') || emailSending}
                                            className="text-[#38bdf8] font-bold text-xs shrink-0 disabled:opacity-40">
                                            {emailSending ? 'Sending...' : 'Send code'}
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={() => setEmailStep('input')} className="w-full flex items-center justify-between text-left">
                                        <div className="flex items-center gap-3.5">
                                            <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Mail size={18} /></div>
                                            <div>
                                                <h4 className="font-bold text-[var(--color-text)] text-sm">Email address</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-xs text-[var(--color-text-secondary)]">{user?.email || 'Add email'}</p>
                                                    {user?.email && user?.emailVerified && (
                                                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Check size={8} />Verified</span>
                                                    )}
                                                    {user?.email && !user?.emailVerified && (
                                                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Unverified</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronLeft size={16} className="text-[var(--color-text-secondary)] rotate-180" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Preferences */}
                    <div>
                        <h3 className="font-bold text-[var(--color-text-secondary)] text-xs uppercase tracking-wider mb-2.5 px-1">Preferences</h3>
                        <div className="bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-2xl divide-y divide-[var(--color-border)] overflow-hidden">
                            <div className="w-full p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Bell size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-[var(--color-text)] text-sm">Notifications</h4>
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Spot alerts and updates</p>
                                    </div>
                                </div>
                                <Toggle checked={notificationsEnabled} onChange={(v) => { setNotificationsEnabled(v); updatePref('notificationsEnabled', v); }} />
                            </div>
                            <div className="w-full p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><MapPin size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-[var(--color-text)] text-sm">Share precise location</h4>
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Used for nearby spot detection</p>
                                    </div>
                                </div>
                                {/* ponytail: sharePreciseLocation needs checking in StreetParkingView's geolocation watch when wired up */}
                                <Toggle checked={sharePreciseLocation} onChange={(v) => { setSharePreciseLocation(v); updatePref('sharePreciseLocation', v); }} />
                            </div>
                            <div className="w-full p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Moon size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-[var(--color-text)] text-sm">Dark theme</h4>
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{theme === 'dark' ? 'On' : 'Off'}</p>
                                    </div>
                                </div>
                                <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div>
                        <h3 className="font-bold text-[var(--color-text-secondary)] text-xs uppercase tracking-wider mb-2.5 px-1">Danger Zone</h3>
                        <div className="space-y-3">
                            <button onClick={onLogout} className="w-full border border-[#1e75ff]/30 bg-transparent text-[#38bdf8] hover:bg-[#1e75ff]/10 active:scale-95 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2.5 transition-all text-sm">
                                <LogOut size={16} />
                                <span>Log out</span>
                            </button>
                            <button onClick={onDeleteAccount} className="w-full border border-red-500/30 bg-transparent text-red-500 hover:bg-red-500/10 active:scale-95 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2.5 transition-all text-sm">
                                <Trash2 size={16} />
                                <span>Delete account</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
