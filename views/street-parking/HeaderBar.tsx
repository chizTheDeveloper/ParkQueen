import React from 'react';
import { Search, Camera, MessageSquare, Bell, Menu, MapPin, Star, Clock, Sliders, CloudSun } from 'lucide-react';
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
    activeFilterTab: string;
    setActiveFilterTab: (tab: string) => void;
    showLegend: boolean;
    setShowLegend: (show: boolean) => void;
    mapRef: React.RefObject<mapboxgl.Map | null>;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
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
    activeFilterTab,
    setActiveFilterTab,
    showLegend,
    setShowLegend,
    mapRef,
}) => {
    return (
        <header style={{ paddingTop: 'env(safe-area-inset-top)' }} className="w-full flex flex-col gap-1.5 pointer-events-auto">
            <div className="w-full max-w-[380px] mx-auto bg-[#07162c]/85 backdrop-blur-xl border border-white/10 rounded-full h-11 px-3 flex items-center justify-between shadow-xl transition-all duration-300">
                <button
                    onClick={() => setView(AppView.PROFILE)}
                    className="text-white/80 hover:text-white p-1.5 hover:bg-white/5 rounded-full transition-colors shrink-0"
                    aria-label="Menu"
                >
                    <Menu size={18} />
                </button>

                <div className="flex-1 mx-2 flex items-center gap-1.5">
                    <Search size={16} className="text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search location..."
                        className="bg-transparent border-none outline-none text-white text-xs w-full placeholder-gray-400 font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setSearchOpen(true)}
                    />
                </div>

                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        aria-label="Scanner"
                        onClick={() => setView(AppView.AI_ASSISTANT)}
                        className="p-1.5 text-white/85 hover:text-white hover:bg-white/5 rounded-full transition-colors shrink-0"
                    >
                        <Camera size={18} />
                    </button>

                    <button
                        type="button"
                        aria-label="Chat"
                        onClick={() => setView(AppView.MESSAGES)}
                        className="p-1.5 text-white/85 hover:text-white hover:bg-white/5 rounded-full transition-colors relative shrink-0"
                    >
                        <div className="relative">
                            <MessageSquare size={18} />
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
                        className="p-1.5 text-white/85 hover:text-white hover:bg-white/5 rounded-full transition-colors relative shrink-0"
                    >
                        <div className="relative">
                            <Bell size={18} />
                            {pendingUpdatesCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 bg-[#1e75ff] w-1.5 h-1.5 rounded-full animate-pulse shadow-md" />
                            )}
                        </div>
                    </button>
                </div>

                {searchOpen && (loading || results.length > 0) && (
                    <div className="absolute left-0 right-0 mt-2 top-full z-[9999] bg-[#07162c]/95 backdrop-blur-xl rounded-2xl max-h-60 overflow-y-auto border border-white/10 shadow-2xl p-2">
                        {loading && <div className="px-4 py-3 text-white/60 text-xs">Searching…</div>}

                        {!loading && results.map((r: any) => (
                            <button
                                key={r.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    setSearchQuery(r.place_name);
                                    setSearchOpen(false);
                                    setResults([]);

                                    mapRef.current?.easeTo({
                                        center: r.center,
                                        zoom: 14,
                                        duration: 800,
                                    });
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-xl transition-colors"
                            >
                                <div className="text-white font-medium text-xs">{r.text}</div>
                                <div className="text-[10px] text-white/50">{r.place_name}</div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {searchOpen && (
                <div className="w-full max-w-[380px] mx-auto flex justify-end">
                    <button onClick={handleCancelSearch} className="text-[#38bdf8] font-bold text-[10px] bg-white/5 border border-white/10 rounded-full py-1 px-3 mt-1">
                        Cancel Search
                    </button>
                </div>
            )}

            {!searchOpen && (
                <div className="w-full max-w-[380px] mx-auto mt-1 bg-[#07162c]/85 backdrop-blur-xl border border-white/10 rounded-2xl p-1 flex items-center justify-around text-[10px] shadow-lg">
                    <button
                        onClick={() => setActiveFilterTab('nearest')}
                        className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl font-semibold flex-1 transition-all ${
                            activeFilterTab === 'nearest'
                                ? 'bg-[#1e75ff]/20 text-[#38bdf8]'
                                : 'text-white/60 hover:text-white'
                        }`}
                    >
                        <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center transition-all ${
                            activeFilterTab === 'nearest' ? 'bg-[#1e75ff] text-white' : 'bg-white/5'
                        }`}>
                            <MapPin size={10} />
                        </div>
                        <span>Nearest</span>
                    </button>
                    <div className="w-[1px] h-5 bg-white/10" />

                    <button
                        onClick={() => setActiveFilterTab('favorites')}
                        className={`flex flex-col items-center gap-1.5 py-1 px-2 rounded-xl font-medium flex-1 transition-all ${
                            activeFilterTab === 'favorites'
                                ? 'bg-[#1e75ff]/20 text-[#38bdf8]'
                                : 'text-white/60 hover:text-white'
                        }`}
                    >
                        <Star size={14} />
                        <span>Favorites</span>
                    </button>
                    <div className="w-[1px] h-5 bg-white/10" />

                    <button
                        onClick={() => setActiveFilterTab('history')}
                        className={`flex flex-col items-center gap-1.5 py-1 px-2 rounded-xl font-medium flex-1 transition-all ${
                            activeFilterTab === 'history'
                                ? 'bg-[#1e75ff]/20 text-[#38bdf8]'
                                : 'text-white/60 hover:text-white'
                        }`}
                    >
                        <Clock size={14} />
                        <span>History</span>
                    </button>
                    <div className="w-[1px] h-5 bg-white/10" />

                    <button
                        onClick={() => {
                            setActiveFilterTab('filters');
                            setShowLegend(!showLegend);
                        }}
                        className={`flex flex-col items-center gap-1.5 py-1 px-2 rounded-xl font-medium flex-1 transition-all ${
                            activeFilterTab === 'filters'
                                ? 'bg-[#1e75ff]/20 text-[#38bdf8]'
                                : 'text-white/60 hover:text-white'
                        }`}
                    >
                        <Sliders size={14} />
                        <span>Filters</span>
                    </button>
                </div>
            )}

            {!searchOpen && (
                <div className="w-full max-w-[380px] mx-auto flex justify-start pl-1 mt-0.5">
                    <div className="flex items-center gap-1.5 bg-[#07162c]/85 backdrop-blur-xl border border-white/10 rounded-full px-2.5 py-1 w-fit text-[10px] font-semibold text-white/95 shadow-md pointer-events-auto">
                        <CloudSun size={13} className="text-yellow-400" />
                        <span>28°</span>
                    </div>
                </div>
            )}
        </header>
    );
};
