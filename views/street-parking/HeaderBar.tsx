import React from 'react';
import { Search, Camera, MessageSquare, Bell } from 'lucide-react';
import { AppView } from '../../types';
import { t, useLang } from '../../i18n';
import { AvatarComposite } from '../../components/AvatarComposite';

interface HeaderBarProps {
    user: any;
    setView: (view: AppView) => void;
    inputRef: React.RefObject<HTMLInputElement>;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    searchOpen: boolean;
    setSearchOpen: (open: boolean) => void;
    results: any[];
    setResults: (r: any[]) => void;
    loading: boolean;
    handleCancelSearch: () => void;
    unreadMessagesCount: number;
    pendingUpdatesCount: number;
    setPendingUpdatesCount: (n: number) => void;
    onSelectResult: (result: any) => void;
}

const UserAvatar = ({ user, onClick }: { user: any; onClick: () => void }) => (
    <button
        onClick={onClick}
        className="rounded-full overflow-hidden shrink-0"
        aria-label="Profile"
    >
        <AvatarComposite avatar={user?.avatar} userId={user?.id ?? ''} size={32} aria-label="Profile" />
    </button>
);

export const HeaderBar: React.FC<HeaderBarProps> = ({
    user,
    setView,
    inputRef,
    searchQuery,
    setSearchQuery,
    searchOpen,
    setSearchOpen,
    results,
    setResults,
    loading,
    handleCancelSearch,
    unreadMessagesCount,
    pendingUpdatesCount,
    setPendingUpdatesCount,
    onSelectResult,
}) => {
    useLang();
    return (
        <header style={{ paddingTop: 'env(safe-area-inset-top)' }} className="w-full flex flex-col gap-1.5 pointer-events-auto">
            <div data-tour="search" className="w-full max-w-[380px] mx-auto bg-[var(--color-card)] backdrop-blur-xl border border-[var(--color-border)] rounded-full h-[50px] px-3.5 flex items-center justify-between shadow-xl transition-all duration-300">
                <span data-tour="profile" className="inline-flex shrink-0">
                    <UserAvatar user={user} onClick={() => setView(AppView.PROFILE)} />
                </span>

                <div className="flex-1 mx-2.5 flex items-center gap-2.5">
                    <Search size={17} className="text-[var(--color-text-secondary)]" />
                    <input
                        ref={inputRef}
                        type="text"
                        aria-label={t('common.search_placeholder')}
                        aria-expanded={searchOpen && (loading || results.length > 0)}
                        aria-haspopup="listbox"
                        placeholder={t('common.search_placeholder')}
                        className="bg-transparent border-none outline-none text-[var(--color-text)] text-[14px] w-full placeholder-[var(--color-text-secondary)] font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setSearchOpen(true)}
                        onKeyDown={(e) => { if (e.key === 'Escape') handleCancelSearch(); }}
                    />
                </div>

                <div className="flex items-center gap-1">
                    <button
                        data-tour="ai"
                        type="button"
                        aria-label="AI Sign Scanner"
                        title="AI Sign Scanner"
                        onClick={() => setView(AppView.AI_ASSISTANT)}
                        className="flex items-center gap-1 bg-[#1e75ff]/15 border border-[#1e75ff]/30 rounded-full px-2 py-1 text-[#38bdf8] hover:bg-[#1e75ff]/25 active:scale-95 transition-all shrink-0"
                    >
                        <Camera size={13} />
                        <span className="text-[10px] font-bold tracking-wide">AI</span>
                    </button>

                    <button
                        data-tour="messages"
                        type="button"
                        aria-label="Chat"
                        title="Chat"
                        onClick={() => setView(AppView.MESSAGES)}
                        className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-overlay)] rounded-full transition-colors relative shrink-0"
                    >
                        <div className="relative">
                            <MessageSquare size={17} />
                            {unreadMessagesCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 bg-[#1e75ff] w-1.5 h-1.5 rounded-full animate-pulse motion-reduce:animate-none shadow-md" />
                            )}
                        </div>
                    </button>

                    <button
                        data-tour="bell"
                        type="button"
                        aria-label={t('common.nearby_activity')}
                        title={t('common.nearby_activity')}
                        onClick={() => {
                            localStorage.setItem('lastViewedNotifications', Date.now().toString());
                            localStorage.setItem('pendingUpdatesCount', '0');
                            setPendingUpdatesCount(0);
                            setView(AppView.NOTIFICATIONS);
                        }}
                        className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-overlay)] rounded-full transition-colors relative shrink-0"
                    >
                        <div className="relative">
                            <Bell size={17} />
                            {pendingUpdatesCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 bg-[#1e75ff] w-1.5 h-1.5 rounded-full animate-pulse motion-reduce:animate-none shadow-md" />
                            )}
                        </div>
                    </button>
                </div>

                {searchOpen && (loading || results.length > 0) && (
                    <div aria-live="polite" className="absolute left-0 right-0 mt-2 top-full z-[9999] bg-[var(--color-glass)] backdrop-blur-xl rounded-2xl max-h-60 overflow-y-auto border border-[var(--color-border)] shadow-2xl p-2">
                        {loading && <div className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{t('common.searching')}</div>}

                        {!loading && results.map((r: any) => (
                            <button
                                key={r.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => onSelectResult(r)}
                                className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-xl transition-colors"
                            >
                                <div className="text-[var(--color-text)] font-medium text-xs">{r.text}</div>
                                <div className="text-[10px] text-[var(--color-text-secondary)]">{r.place_name}</div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {searchOpen && (
                <div className="w-full max-w-[380px] mx-auto flex justify-end">
                    <button onClick={handleCancelSearch} className="text-[#38bdf8] font-bold text-[10px] bg-white/5 border border-[var(--color-border)] rounded-full py-1 px-3 mt-1">
                        {t('common.cancel_search')}
                    </button>
                </div>
            )}
        </header>
    );
};
