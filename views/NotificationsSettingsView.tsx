import React, { useEffect, useState } from 'react';
import { ChevronLeft, Bell } from 'lucide-react';
import { t, useLang } from '../i18n';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { NotificationEnableCard } from '../components/NotificationEnableCard';
import { deriveNotificationPresentation } from '../utils/notificationPresentation';
import type { NotificationRuntimeState } from '../utils/notificationRegistration';

interface NotificationsSettingsViewProps {
    user: any;
    onBack: () => void;
    notificationRuntime?: NotificationRuntimeState | null;
    notificationBusy?: boolean;
    onEnableNotifications?: () => void;
    onRecheckNotifications?: () => void;
}

const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        role="switch"
        aria-label={t('settings.notifications')}
        aria-checked={checked}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${checked ? 'bg-[#1e75ff]' : 'bg-[var(--color-border)]'}`}
    >
        <div className={`absolute top-0.5 left-[2px] w-5 h-5 rounded-full shadow transition-transform ${checked ? 'translate-x-5 bg-white' : 'bg-white dark:bg-gray-300'}`} />
    </button>
);

const RADIUS_OPTIONS = [1, 2, 3, 5];

export const NotificationsSettingsView: React.FC<NotificationsSettingsViewProps> = ({
    user,
    onBack,
    notificationRuntime,
    notificationBusy = false,
    onEnableNotifications,
    onRecheckNotifications,
}) => {
    useLang();
    const [enabled, setEnabled] = useState<boolean>(user?.notificationsEnabled ?? true);
    const [radius, setRadius] = useState<number>(user?.notificationRadius ?? 1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        setEnabled(user?.notificationsEnabled ?? true);
    }, [user?.notificationsEnabled]);
    const deliveryEnabled = notificationRuntime === undefined
        ? enabled
        : deriveNotificationPresentation(enabled, notificationRuntime ?? null).kind === 'enabled';

    const writePref = async (field: string, value: boolean | number) => {
        if (!user?.id) return;
        setSaving(true);
        setError('');
        try {
            await updateDoc(doc(db, 'users', user.id, 'private', 'preferences'), { [field]: value });
        } catch {
            setError(t('settings.pref_save_error'));
            // revert local state
            if (field === 'notificationsEnabled') setEnabled(v => !v);
            if (field === 'notificationRadius') setRadius(user?.notificationRadius ?? 1);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = (v: boolean) => {
        if (v) {
            onEnableNotifications?.();
            return;
        }
        setEnabled(false);
        writePref('notificationsEnabled', false);
    };

    const handleRadius = (r: number) => {
        setRadius(r);
        writePref('notificationRadius', r);
    };

    return (
        <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4">
            <div className="max-w-md mx-auto flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={onBack} aria-label={t('settings.notif_settings_back_aria')} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 active:scale-95 transition-all shrink-0">
                        <ChevronLeft size={20} />
                    </button>
                    <h2 className="text-xl font-bold text-[var(--color-text)] tracking-wide">{t('settings.notif_settings_title')}</h2>
                    <div className="w-10" />
                </div>

                <div className="space-y-3">
                    {onEnableNotifications && onRecheckNotifications && (
                        <NotificationEnableCard
                            runtime={notificationRuntime ?? null}
                            productPreferenceEnabled={enabled}
                            busy={notificationBusy}
                            onEnable={onEnableNotifications}
                            onRecheck={onRecheckNotifications}
                        />
                    )}
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
                        <div className="divide-y divide-[var(--color-border)]">

                            {/* Enable toggle */}
                            <div className="p-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="bg-[#1e75ff]/10 p-2.5 rounded-xl text-[#38bdf8] shrink-0"><Bell size={18} /></div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-[var(--color-text)] text-sm">{t('settings.notifications')}</h4>
                                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-snug">{t('settings.notif_description')}</p>
                                    </div>
                                </div>
                                <Toggle checked={deliveryEnabled} onChange={handleToggle} disabled={saving || notificationBusy} />
                            </div>

                            {/* Radius chips — only when enabled */}
                            {deliveryEnabled && (
                                <div className="p-4">
                                    <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">{t('settings.notif_radius')}</p>
                                    <div className="flex gap-2 flex-wrap">
                                        {RADIUS_OPTIONS.map(r => (
                                            <button
                                                key={r}
                                                onClick={() => handleRadius(r)}
                                                disabled={saving}
                                                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 ${radius === r ? 'bg-[#1e75ff] text-white' : 'bg-white/5 border border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}
                                            >
                                                {r} mi
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {error && <p className="text-red-400 text-xs px-1">{error}</p>}
                </div>
            </div>
        </div>
    );
};
