import React from 'react';
import { Map, Calendar, Wallet, User } from 'lucide-react';
import { AppView } from '../../types';

interface NavigationBarProps {
    setView: (view: AppView) => void;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({ setView }) => {
    return (
        <div className="w-full max-w-[380px] mx-auto bg-[var(--color-glass)] backdrop-blur-xl border border-[var(--color-border)] rounded-3xl py-2 px-5 flex items-center justify-between shadow-2xl">
            <button
                onClick={() => setView(AppView.MAP)}
                className="flex flex-col items-center gap-0.5 text-[#1e75ff] flex-1"
            >
                <Map size={18} />
                <span className="text-[9px] font-bold">Map</span>
            </button>

            <button
                onClick={() => setView(AppView.PARKING_SPACE)}
                className="flex flex-col items-center gap-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] flex-1 transition-colors"
            >
                <Calendar size={18} />
                <span className="text-[9px] font-medium">Bookings</span>
            </button>

            <button
                onClick={() => alert("Wallet features coming soon!")}
                className="flex flex-col items-center gap-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] flex-1 transition-colors"
            >
                <Wallet size={18} />
                <span className="text-[9px] font-medium">Wallet</span>
            </button>

            <button
                onClick={() => setView(AppView.PROFILE)}
                className="flex flex-col items-center gap-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] flex-1 transition-colors"
            >
                <User size={18} />
                <span className="text-[9px] font-medium">Profile</span>
            </button>
        </div>
    );
};
