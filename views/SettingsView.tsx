import React, { useState, useRef, useEffect } from 'react';
import { useFocusOnMount } from '../hooks/useFocusOnMount';
import { ChevronLeft, ChevronRight, Edit, Mail, Bell, MapPin, Moon, LogOut, Trash2, Check, Navigation, ScanLine, Play, Globe } from 'lucide-react';
import { t, useLang, setLang, getLang } from '../i18n';
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
    useLang();
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(user?.notificationsEnabled ?? true);
    const [notificationRadius, setNotificationRadius] = useState<number>(user?.notificationRadius ?? 1);
    const [sharePreciseLocation, setSharePreciseLocation] = useState<boolean>(user?.sharePreciseLocation ?? true);
    const [emailStep, setEmailStep] = useState<'view' | 'input' | 'otp'>('view');
    const [emailDraft, setEmailDraft] = useState(user?.email || '');
    const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
    const [otpCooldown, setOtpCooldown] = useState(0);
    const [emailError, setEmailError] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const headingRef = useRef<HTMLHeadingElement>(null);
    useFocusOnMount(headingRef);

    useEffect(() => {
        if (otpCooldown <= 0) return;
        const timer = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
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
            setEmailError(e.details || e.message || t('settings.email_send_failed'));
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
            setEmailError(e.details || e.message || t('settings.email_verify_failed'));
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

    const updatePref = (field: string, value: boolean | number) => {
        if (user?.id) {
            updateDoc(doc(db, 'users', user.id), { [field]: value }).catch(e => console.warn(`Failed to update ${field}`, e));
        }
    };

    return (
        <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4">
            <div className="max-w-md mx-auto flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={onBack} aria-label={t('settings.back_aria')} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 active:scale-95 transition-all shrink-0">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-[var(--color-text)] tracking-wide focus:outline-none">{t('settings.title')}</h2>
                    <div className="w-10" />
                </div>

                <div className="space-y-3">

                    {/* Account */}
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                        <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
                            <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">{t('settings.section_account')}</p>
                        </div>
                        <div className="divide-y divide-[var(--color-border)]">

                            {/* Edit Profile */}
                            <button onClick={() => setView(AppView.EDIT_PROFILE)} className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Edit size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-[var(--color-text)] text-sm">{t('settings.edit_profile')}</h4>
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('settings.edit_profile_subtitle')}</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-[var(--color-text-secondary)]" />
                            </button>

                            {/* Email */}
                            <div className="w-full p-4">
                                {emailStep === 'otp' ? (
                                    <div>
                                        <div className="flex items-center gap-3.5 mb-4">
                                            <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Mail size={18} /></div>
                                            <div>
                                                <h4 className="font-bold text-[var(--color-text)] text-sm">{t('settings.email_enter_code')}</h4>
                                                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('settings.email_sent_to', { email: emailDraft })}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 justify-center mb-3">
                                            {otpDigits.map((d, i) => (
                                                <input key={i} ref={el => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={d}
                                                    onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)}
                                                    className="w-10 h-12 bg-white/5 border border-[var(--color-border)] rounded-xl text-center text-[var(--color-text)] text-lg font-bold outline-none focus:border-[#1e75ff] transition-all"
                                                    autoFocus={i === 0} />
                                            ))}
                                        </div>
                                        {emailError && <p className="text-red-400 text-xs text-center mb-2">{emailError}</p>}
                                        <div className="flex items-center justify-between mb-3">
                                            <button onClick={() => setEmailStep('input')} className="text-[var(--color-text-secondary)] text-xs hover:text-[var(--color-text)] transition-colors">{t('settings.email_back')}</button>
                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                                {otpCooldown > 0 ? t('settings.email_resend_in', { seconds: otpCooldown }) : <button onClick={handleSendEmailOTP} className="text-[#38bdf8] font-semibold">{t('settings.email_resend')}</button>}
                                            </p>
                                        </div>
                                        <button onClick={handleVerifyEmailOTP} disabled={otpDigits.some(d => !d) || emailSending}
                                            className="w-full py-2.5 rounded-xl font-bold text-white text-sm active:scale-95 transition-transform disabled:opacity-40"
                                            style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}>
                                            {emailSending ? t('settings.email_verifying') : t('settings.email_verify')}
                                        </button>
                                    </div>
                                ) : emailStep === 'input' ? (
                                    <div className="flex items-center gap-3.5">
                                        <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Mail size={18} /></div>
                                        <div className="flex-1">
                                            <input type="email" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} placeholder="you@example.com"
                                                className="w-full bg-white/5 border border-[var(--color-border)] rounded-xl px-3 py-2 text-[var(--color-text)] text-sm outline-none focus:border-[#1e75ff] transition-all" autoFocus />
                                            {emailError && <p className="text-red-400 text-xs mt-1">{emailError}</p>}
                                        </div>
                                        <button onClick={handleSendEmailOTP} disabled={!emailDraft.includes('@') || emailSending}
                                            className="text-[#38bdf8] font-bold text-xs shrink-0 disabled:opacity-40">
                                            {emailSending ? t('settings.email_sending') : t('settings.email_send_code')}
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={() => setEmailStep('input')} className="w-full flex items-center justify-between text-left">
                                        <div className="flex items-center gap-3.5">
                                            <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Mail size={18} /></div>
                                            <div>
                                                <h4 className="font-bold text-[var(--color-text)] text-sm">{t('settings.email_address')}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-xs text-[var(--color-text-secondary)]">{user?.email || t('settings.email_add')}</p>
                                                    {user?.email && user?.emailVerified && (
                                                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Check size={8} />{t('settings.email_verified')}</span>
                                                    )}
                                                    {user?.email && !user?.emailVerified && (
                                                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{t('settings.email_unverified')}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-[var(--color-text-secondary)]" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Preferences */}
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                        <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
                            <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">{t('settings.section_preferences')}</p>
                        </div>
                        <div className="divide-y divide-[var(--color-border)]">

                            {/* Notifications toggle */}
                            <div className="w-full p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Bell size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-[var(--color-text)] text-sm">{t('settings.notifications')}</h4>
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('settings.notifications_subtitle')}</p>
                                    </div>
                                </div>
                                <Toggle checked={notificationsEnabled} onChange={(v) => { setNotificationsEnabled(v); updatePref('notificationsEnabled', v); }} />
                            </div>

                            {/* Notification radius */}
                            <div className="w-full p-4">
                                <div className="flex items-center gap-3.5 mb-3">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><ScanLine size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-[var(--color-text)] text-sm">{t('settings.notif_radius')}</h4>
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('settings.notif_radius_subtitle')}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {[0.5, 1, 2, 5].map(r => (
                                        <button key={r} onClick={() => { setNotificationRadius(r); updatePref('notificationRadius', r); }}
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                                notificationRadius === r
                                                    ? 'bg-[#1e75ff] text-white'
                                                    : 'bg-white/5 border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-white/10'
                                            }`}>
                                            {r} mi
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Share precise location */}
                            <div className="w-full p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Navigation size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-[var(--color-text)] text-sm">{t('settings.precise_location')}</h4>
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('settings.precise_location_subtitle')}</p>
                                    </div>
                                </div>
                                <Toggle checked={sharePreciseLocation} onChange={(v) => { setSharePreciseLocation(v); updatePref('sharePreciseLocation', v); }} />
                            </div>

                            {/* Dark theme */}
                            <div className="w-full p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Moon size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-[var(--color-text)] text-sm">{t('settings.dark_theme')}</h4>
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('settings.dark_theme_subtitle')}</p>
                                    </div>
                                </div>
                                <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
                            </div>

                            {/* Language */}
                            <button
                                onClick={() => {
                                    const next = getLang() === 'en' ? 'es' : 'en';
                                    setLang(next);
                                    if (user?.id) {
                                        updateDoc(doc(db, 'users', user.id), { lang: next }).catch(() => {});
                                    }
                                }}
                                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors"
                                aria-label={t('settings.language_toggle_aria')}
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Globe size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-[var(--color-text)] text-sm">{t('settings.language.title')}</h4>
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                                            {getLang() === 'en' ? t('language.english') : t('language.spanish')}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-[var(--color-text-secondary)]" />
                            </button>
                        </div>
                    </div>

                    {/* Help */}
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                        <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
                            <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">{t('settings.section_help')}</p>
                        </div>
                        <button
                            onClick={() => {
                                localStorage.removeItem('parqueenAppTourSeen_v1');
                                setView(AppView.MAP);
                            }}
                            className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-white/5 active:bg-white/10 transition-colors"
                        >
                            <div className="w-9 h-9 rounded-xl bg-[#1e75ff]/10 flex items-center justify-center text-[#1e75ff] shrink-0">
                                <Play size={17} />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-[var(--color-text)]">{t('tour.replay_label')}</p>
                                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('tour.replay_subtitle')}</p>
                            </div>
                        </button>
                    </div>

                    {/* Account Actions */}
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                        <div className="px-4 pt-3.5 pb-2 border-b border-[var(--color-border)]">
                            <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">{t('settings.section_account_actions')}</p>
                        </div>
                        <div className="divide-y divide-[var(--color-border)]">
                            <button onClick={onLogout} className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-white/5 active:bg-white/10 transition-colors">
                                <div className="w-9 h-9 rounded-xl bg-[#1e75ff]/10 flex items-center justify-center text-[#38bdf8] shrink-0">
                                    <LogOut size={17} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-[#38bdf8]">{t('settings.logout')}</p>
                                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('settings.logout_subtitle')}</p>
                                </div>
                            </button>
                            <button onClick={onDeleteAccount} className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-white/5 active:bg-white/10 transition-colors">
                                <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                                    <Trash2 size={17} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-red-400">{t('settings.delete_account')}</p>
                                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('settings.delete_account_subtitle')}</p>
                                </div>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
