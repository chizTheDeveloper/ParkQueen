import React from 'react';
import { Locate, MessageSquare, Navigation, Clock, X } from 'lucide-react';
import { MapItem } from './types';
import { getDistance, formatTimeLeft } from './utils';

interface SpotDetailsCardProps {
    selectedItem: any;
    freeSpots: MapItem[];
    user: any;
    userLocation: [number, number] | null;
    spotAddress: string;
    trackedItemId: string | null;
    onTrackLocation: () => void;
    onHeadingThere: () => void;
    onEditSpot: (spot: any) => void;
    onDeletePing: () => void;
    onArrival: () => void;
    onCancelByFinder: () => void;
    onDelayByFinder: () => void;
    onMessageUser: (userId: string, context: string) => void;
    interestError: string | null;
    estDriveMinutes: number | null;
    isWithinArrivalRange: boolean;
    maxEtaMinutes: number;
}

export const SpotDetailsCard: React.FC<SpotDetailsCardProps> = ({
    selectedItem, freeSpots, user, userLocation, spotAddress, trackedItemId,
    onTrackLocation, onHeadingThere, onEditSpot, onDeletePing, onArrival,
    onCancelByFinder, onDelayByFinder, onMessageUser,
    interestError, estDriveMinutes, isWithinArrivalRange, maxEtaMinutes,
}) => {
    if (!selectedItem) return null;

    const distanceVal = userLocation ? getDistance(userLocation[1], userLocation[0], selectedItem.lat, selectedItem.lng) : null;
    const distanceText = distanceVal
        ? (distanceVal * 0.621371 < 0.1 ? `${Math.round(distanceVal * 1000 * 1.09361)} yd` : `${(distanceVal * 0.621371).toFixed(1)} mi`)
        : '';

    const departureDate = selectedItem.reportedAt ? (typeof selectedItem.reportedAt.toDate === 'function' ? selectedItem.reportedAt.toDate() : new Date(selectedItem.reportedAt)) : null;
    const isScheduled = departureDate && departureDate.getTime() > Date.now() + 60_000;
    const departureText = departureDate ? (isScheduled ? departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Leaving Now') : '';
    const timeLeftMs = selectedItem.expiresAt ? (typeof selectedItem.expiresAt.toMillis === 'function' ? selectedItem.expiresAt.toMillis() : new Date(selectedItem.expiresAt).getTime()) - Date.now() : 0;

    const isFinder = user?.id === selectedItem.finderId;
    const isInterestedUser = user?.id === selectedItem.interestedUserId;
    const spotStatus = selectedItem.status;

    let subText = '';
    if (spotStatus === 'available') {
        subText = `Departure: ${departureText} • Expires: ${formatTimeLeft(timeLeftMs)}`;
    } else if (spotStatus === 'interested') {
        if (isFinder) {
            subText = `Someone is heading there, ETA ~${selectedItem.etaMinutes || '?'} min`;
        } else if (isInterestedUser) {
            subText = 'Driver is preparing to leave';
        } else {
            subText = 'Someone is heading there';
        }
    }

    return (
        <div className="w-full max-w-[380px] mx-auto bg-[var(--color-glass)] backdrop-blur-xl border border-[var(--color-border)] rounded-3xl p-3.5 shadow-2xl transition-all">
            <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#1e75ff] flex flex-col items-center justify-center text-white shadow-lg shrink-0">
                    <span className="font-extrabold text-lg">P</span>
                    {distanceText && <span className="text-[9px] font-medium">{distanceText}</span>}
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-[#38bdf8] uppercase tracking-wider">| Free Parking</span>
                    <h3 className="text-sm font-bold text-[var(--color-text)] truncate mt-0.5">{selectedItem.title || spotAddress || 'Street Parking Spot'}</h3>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 truncate">{subText}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                    spotStatus === 'available' ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                    : spotStatus === 'interested' ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                    : 'text-red-400 bg-red-500/10 border border-red-500/20'
                }`}>
                    {spotStatus === 'available' ? 'Free' : spotStatus === 'interested' ? 'Reserved' : 'Occupied'}
                </span>
            </div>

            {interestError && (
                <p className="text-red-400 text-xs mt-2 text-center">{interestError}</p>
            )}

            <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-[var(--color-border)]">
                <button onClick={onTrackLocation}
                    className={`flex-1 font-bold py-1.5 rounded-xl flex items-center justify-center gap-1 transition-all text-[11px] shadow-md ${
                        trackedItemId === selectedItem.id
                            ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400'
                            : 'bg-[#1e75ff] hover:bg-blue-600 text-white'
                    }`}>
                    <Locate size={12} />
                    <span>{trackedItemId === selectedItem.id ? 'Untrack' : 'Track'}</span>
                </button>

                {/* Not the finder, spot is available */}
                {!isFinder && spotStatus === 'available' && (
                    <>
                        <button onClick={() => onMessageUser(selectedItem.finderId, `Spot pinged by ${selectedItem.finderName}`)}
                            className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-xl flex items-center justify-center transition-all shadow-md shrink-0">
                            <MessageSquare size={14} />
                        </button>
                        {estDriveMinutes !== null && estDriveMinutes > maxEtaMinutes ? (
                            <span className="flex-1 text-[10px] text-[var(--color-text-secondary)] self-center text-center">
                                Too far (~{estDriveMinutes} min drive)
                            </span>
                        ) : (
                            <button onClick={onHeadingThere}
                                className="flex-1 font-bold py-1.5 rounded-xl transition-all text-[11px] shadow-md active:scale-95 text-white"
                                style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}>
                                I'm heading there
                            </button>
                        )}
                    </>
                )}

                {/* Finder, spot is available */}
                {isFinder && spotStatus === 'available' && (
                    <div className="flex flex-1 gap-1.5">
                        <button onClick={() => onEditSpot(selectedItem)}
                            className="flex-1 bg-blue-600/50 hover:bg-blue-600 text-white font-bold py-1.5 rounded-xl transition-all text-[11px]">
                            Edit
                        </button>
                        <button onClick={onDeletePing}
                            className="flex-1 border border-red-500/50 hover:bg-red-500/10 text-red-400 font-bold py-1.5 rounded-xl transition-all text-[11px]">
                            Delete
                        </button>
                    </div>
                )}

                {/* Finder, someone is interested */}
                {isFinder && spotStatus === 'interested' && (
                    <div className="flex flex-1 gap-1.5">
                        <button onClick={onDelayByFinder}
                            className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-bold py-1.5 rounded-xl transition-all text-[11px] border border-amber-500/30">
                            Need more time
                        </button>
                        <button onClick={onCancelByFinder}
                            className="flex-1 border border-red-500/50 hover:bg-red-500/10 text-red-400 font-bold py-1.5 rounded-xl transition-all text-[11px]">
                            Cancel
                        </button>
                    </div>
                )}

                {/* Interested user heading to spot */}
                {isInterestedUser && spotStatus === 'interested' && (
                    <button onClick={onArrival} disabled={!isWithinArrivalRange}
                        className="flex-1 font-bold py-1.5 rounded-xl transition-all text-[11px] shadow-md active:scale-95 text-white disabled:opacity-40"
                        style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}>
                        {isWithinArrivalRange ? "I've arrived" : `Arrive within 200ft to confirm`}
                    </button>
                )}

                {/* Third party viewing an interested spot */}
                {!isFinder && !isInterestedUser && spotStatus === 'interested' && (
                    <span className="flex-1 text-[10px] font-bold text-amber-400 self-center text-center px-2 py-0.5 bg-amber-500/10 rounded-lg">
                        Someone is heading there
                    </span>
                )}
            </div>
        </div>
    );
};
