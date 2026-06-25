import React, { useState } from 'react';
import { ChevronLeft, Edit, Mail, Bell, MapPin, Moon, LogOut, Trash2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
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
    <button onClick={() => onChange(!checked)} className="relative shrink-0 w-11 h-6 rounded-full transition-colors" style={{ backgroundColor: checked ? '#1e75ff' : 'rgba(255,255,255,0.1)' }}>
        <div className={`absolute top-0.5 left-[2px] w-5 h-5 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
);

export const SettingsView: React.FC<SettingsViewProps> = ({ user, setView, onBack, onLogout, onDeleteAccount, theme, toggleTheme }) => {
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(user?.notificationsEnabled ?? true);
    const [sharePreciseLocation, setSharePreciseLocation] = useState<boolean>(user?.sharePreciseLocation ?? true);
    const [editingEmail, setEditingEmail] = useState(false);
    const [emailDraft, setEmailDraft] = useState(user?.email || '');

    const updatePref = (field: string, value: boolean) => {
        if (user?.id) {
            updateDoc(doc(db, 'users', user.id), { [field]: value }).catch(e => console.warn(`Failed to update ${field}`, e));
        }
    };

    return (
        <div className="min-h-full bg-dark-900 text-white pt-4 pb-20 px-4">
            <div className="max-w-md mx-auto flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all shrink-0">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-xl font-bold text-white tracking-wide">Settings</h2>
                </div>

                <div className="space-y-6">
                    {/* Account */}
                    <div>
                        <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-2.5 px-1">Account</h3>
                        <div className="bg-[#07162c]/60 border border-white/5 backdrop-blur-md rounded-2xl divide-y divide-white/5 overflow-hidden">
                            <button onClick={() => setView(AppView.EDIT_PROFILE)} className="w-full p-4 flex items-center justify-between text-left hover:bg-[#0b2240]/40 transition-colors">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Edit size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">Edit profile</h4>
                                        <p className="text-xs text-gray-400 mt-0.5">Update your information</p>
                                    </div>
                                </div>
                                <ChevronLeft size={16} className="text-gray-400 rotate-180" />
                            </button>
                            <div className="w-full p-4">
                                {editingEmail ? (
                                    <div className="flex items-center gap-3.5">
                                        <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Mail size={18} /></div>
                                        <div className="flex-1">
                                            <input
                                                type="email"
                                                value={emailDraft}
                                                onChange={(e) => setEmailDraft(e.target.value)}
                                                placeholder="you@example.com"
                                                className="w-full bg-[#07162c]/60 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-[#1e75ff] transition-all"
                                                autoFocus
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (emailDraft.trim() && user?.id) {
                                                    updateDoc(doc(db, 'users', user.id), { email: emailDraft.trim(), emailVerified: false }).catch(e => console.warn('Failed to update email', e));
                                                }
                                                setEditingEmail(false);
                                            }}
                                            className="text-[#38bdf8] font-bold text-xs shrink-0"
                                        >
                                            Save
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={() => setEditingEmail(true)} className="w-full flex items-center justify-between text-left">
                                        <div className="flex items-center gap-3.5">
                                            <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Mail size={18} /></div>
                                            <div>
                                                <h4 className="font-bold text-white text-sm">Email address</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-xs text-gray-400">{user?.email || 'Add email'}</p>
                                                    {user?.email && !user?.emailVerified && (
                                                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Unverified</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronLeft size={16} className="text-gray-400 rotate-180" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Preferences */}
                    <div>
                        <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-2.5 px-1">Preferences</h3>
                        <div className="bg-[#07162c]/60 border border-white/5 backdrop-blur-md rounded-2xl divide-y divide-white/5 overflow-hidden">
                            <div className="w-full p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Bell size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">Notifications</h4>
                                        <p className="text-xs text-gray-400 mt-0.5">Spot alerts and updates</p>
                                    </div>
                                </div>
                                <Toggle checked={notificationsEnabled} onChange={(v) => { setNotificationsEnabled(v); updatePref('notificationsEnabled', v); }} />
                            </div>
                            <div className="w-full p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><MapPin size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">Share precise location</h4>
                                        <p className="text-xs text-gray-400 mt-0.5">Used for nearby spot detection</p>
                                    </div>
                                </div>
                                {/* ponytail: sharePreciseLocation needs checking in StreetParkingView's geolocation watch when wired up */}
                                <Toggle checked={sharePreciseLocation} onChange={(v) => { setSharePreciseLocation(v); updatePref('sharePreciseLocation', v); }} />
                            </div>
                            <div className="w-full p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Moon size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">Dark theme</h4>
                                        <p className="text-xs text-gray-400 mt-0.5">{theme === 'dark' ? 'On' : 'Off'}</p>
                                    </div>
                                </div>
                                <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div>
                        <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-2.5 px-1">Danger Zone</h3>
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
