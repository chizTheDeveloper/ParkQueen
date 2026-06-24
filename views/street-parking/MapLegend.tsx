import React from 'react';
import { MapPin } from 'lucide-react';

interface MapLegendProps {
    searchOpen: boolean;
    showLegend: boolean;
    showFree: boolean;
    setShowFree: (v: boolean) => void;
}

export const MapLegend: React.FC<MapLegendProps> = ({ searchOpen, showLegend, showFree, setShowFree }) => {
    if (searchOpen || !showLegend) return null;

    return (
        <div className="absolute left-4 top-20 bg-[#07162c]/90 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl w-44 pointer-events-auto flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300 z-25">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-0.5">Map Legend</div>
            <div className="flex flex-col gap-2.5">
                <label className="flex items-center justify-between cursor-pointer group select-none">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#1e75ff]/10 flex items-center justify-center text-[#1e75ff] border border-[#1e75ff]/20">
                            <MapPin size={11} fill="currentColor" fillOpacity={0.2} />
                        </div>
                        <div className="text-left">
                            <div className="text-[10px] font-bold text-white leading-tight text-xs">Free Parking</div>
                            <div className="text-[8px] text-gray-400 leading-tight">Community ping</div>
                        </div>
                    </div>
                    <input
                        type="checkbox"
                        checked={showFree}
                        onChange={() => setShowFree(!showFree)}
                        className="w-3.5 h-3.5 rounded border-white/20 text-[#1e75ff] focus:ring-0 bg-white/5 cursor-pointer accent-[#1e75ff]"
                    />
                </label>
            </div>
        </div>
    );
};
