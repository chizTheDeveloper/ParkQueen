import React from 'react';
import { Search, Camera, MessageSquare, Bell } from 'lucide-react';
import { AppView } from '../../types';

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

const UserAvatar = ({ user, onClick }: { user: any; onClick: () => void }) => {
    const initials = (user?.fullName || user?.username || 'PQ')
        .split(' ')
        .map((w: string) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <button
            onClick={onClick}
            className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[13px] font-bold text-white"
            aria-label="Profile"
        >
            {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center">
                    {initials}
                </div>
            )}
        </button>
    );
};

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
    return (
        <header style={{ paddingTop: 'env(safe-area-inset-top)' }} className="w-full flex flex-col gap-1.5 pointer-events-auto">
            <div className="w-full max-w-[380px] mx-auto bg-[var(--color-card)] backdrop-blur-xl border border-[var(--color-border)] rounded-full h-[50px] px-3.5 flex items-center justify-between shadow-xl transition-all duration-300">
                <UserAvatar user={user} onClick={() => setView(AppView.PROFILE)} />

                <div className="flex-1 mx-2.5 flex items-center gap-2.5">
                    <Search size={17} className="text-[var(--color-text-secondary)]" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Check parking near..."
                        className="bg-transparent border-none outline-none text-[var(--color-text)] text-[14px] w-full placeholder-[var(--color-text-secondary)] font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setSearchOpen(true)}
                    />
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        aria-label="AI Sign Scanner"
                        onClick={() => setView(AppView.AI_ASSISTANT)}
                        className="flex items-center gap-1 bg-[#1e75ff]/15 border border-[#1e75ff]/30 rounded-full px-2 py-1 text-[#38bdf8] hover:bg-[#1e75ff]/25 active:scale-95 transition-all shrink-0"
                    >
                        <Camera size={13} />
                        <span className="text-[10px] font-bold tracking-wide">AI</span>
                    </button>

                    <button
                        type="button"
                        aria-label="Chat"
                        onClick={() => setView(AppView.MESSAGES)}
                        className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-overlay)] rounded-full transition-colors relative shrink-0"
                    >
                        <div className="relative">
                            <MessageSquare size={17} />
                            {unreadMessagesCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 bg-[#1e75ff] w-1.5 h-1.5 rounded-full animate-pulse shadow-md" />
                            )}
                        </div>
                    </button>

                    <button
                        type="button"
                        aria-label="Notifications"
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
                                <span className="absolute -top-0.5 -right-0.5 bg-[#1e75ff] w-1.5 h-1.5 rounded-full animate-pulse shadow-md" />
                            )}
                        </div>
                    </button>
                </div>

                {searchOpen && (loading || results.length > 0) && (
                    <div className="absolute left-0 right-0 mt-2 top-full z-[9999] bg-[var(--color-glass)] backdrop-blur-xl rounded-2xl max-h-60 overflow-y-auto border border-[var(--color-border)] shadow-2xl p-2">
                        {loading && <div className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">Searching…</div>}

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
                        Cancel Search
                    </button>
                </div>
            )}
        </header>
    );
};
