import React from 'react';
import { Bell, Map, MessageSquare, User } from 'lucide-react';
import { t, useLang } from '../../i18n';
import { AppView } from '../../types';

interface NavigationBarProps {
    currentView: AppView;
    setView: (view: AppView) => void;
    unreadMessagesCount?: number;
    pendingUpdatesCount?: number;
}

const badgeLabel = (count: number) => count > 99 ? '99+' : String(count);

export const NavigationBar: React.FC<NavigationBarProps> = ({
    currentView,
    setView,
    unreadMessagesCount = 0,
    pendingUpdatesCount = 0,
}) => {
    useLang();

    const navigate = (view: AppView) => {
        if (view === AppView.NOTIFICATIONS) {
            localStorage.setItem('lastViewedNotifications', Date.now().toString());
            localStorage.setItem('pendingUpdatesCount', '0');
        }
        setView(view);
    };

    const items = [
        { view: AppView.MAP, label: t('nav.map'), visualLabel: t('nav.map'), Icon: Map, badge: 0, badgeId: undefined, tour: undefined },
        {
            view: AppView.NOTIFICATIONS,
            label: pendingUpdatesCount > 0
                ? t('nav.nearby_new', { count: badgeLabel(pendingUpdatesCount) })
                : t('common.nearby_activity'),
            visualLabel: t('nav.nearby'),
            Icon: Bell,
            badge: pendingUpdatesCount,
            badgeId: 'activity',
            tour: 'bell',
        },
        {
            view: AppView.MESSAGES,
            label: unreadMessagesCount > 0
                ? t('nav.messages_unread', { count: badgeLabel(unreadMessagesCount) })
                : t('nav.messages'),
            visualLabel: t('nav.messages'),
            Icon: MessageSquare,
            badge: unreadMessagesCount,
            badgeId: 'messages',
            tour: 'messages',
        },
        {
            view: AppView.PROFILE,
            label: t('nav.profile'),
            visualLabel: t('nav.profile'),
            Icon: User,
            badge: 0,
            badgeId: undefined,
            tour: 'profile',
        },
    ] as const;

    return (
        <nav className="mobile-primary-nav md:hidden" aria-label={t('nav.primary')}>
            <div className="mobile-primary-nav-surface">
                {items.map(({ view, label, visualLabel, Icon, badge, badgeId, tour }) => {
                    const active = currentView === view;
                    return (
                        <button
                            key={view}
                            type="button"
                            data-tour={tour}
                            aria-label={label}
                            aria-current={active ? 'page' : undefined}
                            onClick={() => navigate(view)}
                            className={`mobile-primary-nav-item${active ? ' is-active' : ''}`}
                        >
                            <span className="mobile-primary-nav-icon-wrap" aria-hidden="true">
                                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                                {!!badge && badge > 0 && badgeId && (
                                    <span data-nav-badge={badgeId} className="mobile-primary-nav-badge">
                                        {badgeLabel(badge)}
                                    </span>
                                )}
                            </span>
                            <span className="mobile-primary-nav-label">{visualLabel}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};
