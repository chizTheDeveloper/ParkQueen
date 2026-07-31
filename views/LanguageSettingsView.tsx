import React, { useState } from 'react';
import { ChevronLeft, Check } from 'lucide-react';
import { t, useLang, getLang, setLang } from '../i18n';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface LanguageSettingsViewProps {
    user: any;
    onBack: () => void;
}

const LANGS: { code: 'en' | 'es'; labelKey: string }[] = [
    { code: 'en', labelKey: 'settings.language_english' },
    { code: 'es', labelKey: 'settings.language_spanish' },
];

export const LanguageSettingsView: React.FC<LanguageSettingsViewProps> = ({ user, onBack }) => {
    useLang();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const current = getLang();

    const handleSelect = async (code: 'en' | 'es') => {
        if (code === current || saving) return;
        const prev = current;
        setLang(code); // optimistic — updates localStorage + subscribers immediately
        setSaving(true);
        setError('');
        try {
            if (user?.id) {
                await updateDoc(doc(db, 'users', user.id, 'private', 'preferences'), { lang: code });
            }
        } catch {
            setLang(prev); // revert
            setError(t('settings.language_save_error'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4">
            <div className="max-w-md mx-auto flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={onBack} aria-label={t('settings.language_back_aria')} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 active:scale-95 transition-all shrink-0">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-xl font-bold text-[var(--color-text)] tracking-wide">{t('settings.language_title')}</h2>
                    <div className="w-10" />
                </div>

                <div className="space-y-3">
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                        <div className="divide-y divide-[var(--color-border)]">
                            {LANGS.map(({ code, labelKey }) => (
                                <button
                                    key={code}
                                    onClick={() => handleSelect(code)}
                                    disabled={saving}
                                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-40"
                                >
                                    <span className="font-semibold text-[var(--color-text)] text-sm">{t(labelKey as any)}</span>
                                    {current === code && <Check size={18} className="text-[#1e75ff] shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <p className="text-red-400 text-xs px-1">{error}</p>}
                </div>
            </div>
        </div>
    );
};
