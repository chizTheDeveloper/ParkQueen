import React from 'react';
import { Locate, MessageSquare } from 'lucide-react';
import { MapItem } from './types';
import { getDistance, formatTimeLeft } from './utils';

interface SpotDetailsCardProps {
    selectedItem: any;
    freeSpots: MapItem[];
    user: any;
    userLocation: [number, number] | null;
    spotAddress: string;
    trackedItemId: string | null;
    holdTimeRemaining: number | null;
    onTrackLocation: () => void;
    onClaimSpotClick: () => void;
    onEditSpot: (spot: any) => void;
    onDeletePing: () => void;
    onArrivalRelease: () => void;
    onMessageUser: (userId: string, context: string) => void;
}

export const SpotDetailsCard: React.FC<SpotDetailsCardProps> = ({
    selectedItem,
    freeSpots,
    user,
    userLocation,
    spotAddress,
    trackedItemId,
    holdTimeRemaining,
    onTrackLocation,
    onClaimSpotClick,
    onEditSpot,
    onDeletePing,
    onArrivalRelease,
    onMessageUser,
}) => {
    const getSpotToDisplay = () => {
        if (selectedItem) {
            const departureDate = selectedItem.reportedAt ? (typeof selectedItem.reportedAt.toDate === 'function' ? selectedItem.reportedAt.toDate() : new Date(selectedItem.reportedAt)) : null;
            const isScheduled = departureDate && departureDate.getTime() > Date.now() + 60_000;
            const departureText = departureDate
                ? (isScheduled ? departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Leaving Now')
                : 'N/A';
            const timeLeftMs = selectedItem.expiresAt ? (typeof selectedItem.expiresAt.toMillis === 'function' ? selectedItem.expiresAt.toMillis() : new Date(selectedItem.expiresAt).getTime()) - Date.now() : 0;
            const distanceVal = userLocation
                ? getDistance(userLocation[1], userLocation[0], selectedItem.lat, selectedItem.lng)
                : null;
            const distanceText = distanceVal
                ? (distanceVal * 0.621371 < 0.1
                    ? `${Math.round(distanceVal * 1000 * 1.09361)} yd`
                    : `${(distanceVal * 0.621371).toFixed(1)} mi`)
                : "120 yd";
            const holdStatus = selectedItem.holdRequestStatus;
            const isRequester = selectedItem.holdRequestedBy === user?.id;

            let dynamicRate = selectedItem.type === 'free' ? 'Free' : `$${(selectedItem.pricePerHour || 1.50).toFixed(2)}/hr`;
            let dynamicSubText = selectedItem.type === 'free'
                ? `Departure: ${departureText} • Expires: ${formatTimeLeft(timeLeftMs)}`
                : (selectedItem.description || 'Private driveways & lots');

            if (selectedItem.type === 'free') {
                if (holdStatus === 'pending') {
                    dynamicRate = '$2.00 Hold';
                    dynamicSubText = isRequester
                        ? "Hold requested. Waiting for owner..."
                        : "Hold requested by someone...";
                } else if (holdStatus === 'accepted') {
                    dynamicRate = '$2.00 Escrow';
                    if (holdTimeRemaining !== null) {
                        const mins = Math.floor(holdTimeRemaining / 60);
                        const secs = holdTimeRemaining % 60;
                        dynamicSubText = `Reserved! Arrive in ${mins}:${secs.toString().padStart(2, '0')} • Escrow active`;
                    } else {
                        dynamicSubText = "Reserved! Escrow active";
                    }
                } else if (holdStatus === 'completed') {
                    dynamicRate = 'Occupied';
                    dynamicSubText = "Payment released! Spot occupied.";
                }
            }

            return {
                id: selectedItem.id,
                title: selectedItem.title || spotAddress || "Street Parking Spot",
                typeLabel: selectedItem.type === 'free' ? 'Free' : (selectedItem.type === 'paid' ? 'Paid' : 'Public'),
                statusLabel: selectedItem.status,
                distance: distanceText,

                rawSpot: selectedItem.type === 'free' ? selectedItem : null,
                rate: dynamicRate,
                subText: dynamicSubText
            };
        } else if (freeSpots.length > 0) {
            let closest = freeSpots[0];
            if (userLocation) {
                let minDistance = Infinity;
                freeSpots.forEach(s => {
                    const dist = getDistance(userLocation[1], userLocation[0], s.lat, s.lng);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closest = s;
                    }
                });
            }
            const distanceVal = userLocation
                ? getDistance(userLocation[1], userLocation[0], closest.lat, closest.lng)
                : null;
            const distanceText = distanceVal
                ? (distanceVal * 0.621371 < 0.1
                    ? `${Math.round(distanceVal * 1000 * 1.09361)} yd`
                    : `${(distanceVal * 0.621371).toFixed(1)} mi`)
                : "120 yd";

            const holdStatus = closest.holdRequestStatus;
            const isRequester = closest.holdRequestedBy === user?.id;

            let dynamicRate = 'Free';
            let dynamicSubText = `${distanceText} • ${closest.status || 'available'}`;

            if (holdStatus === 'pending') {
                dynamicRate = '$2.00 Hold';
                dynamicSubText = isRequester
                    ? `${distanceText} • Hold requested. Waiting...`
                    : `${distanceText} • Hold requested by someone`;
            } else if (holdStatus === 'accepted') {
                dynamicRate = '$2.00 Escrow';
                dynamicSubText = `${distanceText} • Reserved! Escrow active`;
            } else if (holdStatus === 'completed') {
                dynamicRate = 'Occupied';
                dynamicSubText = `${distanceText} • Occupied`;
            }

            return {
                id: closest.id,
                title: closest.title || spotAddress || "Street Parking Spot",
                typeLabel: 'Free',
                statusLabel: closest.status,
                distance: distanceText,

                rawSpot: closest,
                rate: dynamicRate,
                subText: dynamicSubText
            };
        } else {
            return null;
        }
    };

    const spotToDisplay = getSpotToDisplay();
    if (!spotToDisplay) return null;

    let badgeBgColor = 'bg-[#1e75ff]';
    if (spotToDisplay.typeLabel === 'Paid') badgeBgColor = 'bg-[#22c55e]';
    if (spotToDisplay.typeLabel === 'Public') badgeBgColor = 'bg-[#a855f7]';

    return (
        <div className="w-full max-w-[380px] mx-auto bg-[#07162c]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-3.5 shadow-2xl transition-all">
            <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-2xl ${badgeBgColor} flex flex-col items-center justify-center text-white shadow-lg shrink-0`}>
                    <span className="font-extrabold text-lg">P</span>
                    <span className="text-[9px] font-medium">{spotToDisplay.distance}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-[#38bdf8] uppercase tracking-wider">| {spotToDisplay.typeLabel} Parking</span>
                    <h3 className="text-sm font-bold text-white truncate mt-0.5">{spotToDisplay.title}</h3>
                    <p className="text-[11px] text-white/50 mt-0.5 truncate">
                        {spotToDisplay.subText}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-lg">
                        {spotToDisplay.rate}
                    </span>
                </div>
            </div>

                <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-white/5">
                    <button
                        onClick={onTrackLocation}
                        className={`flex-1 font-bold py-1.5 rounded-xl flex items-center justify-center gap-1 transition-all text-[11px] shadow-md ${
                            trackedItemId === spotToDisplay.id
                                ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400'
                                : 'bg-[#1e75ff] hover:bg-blue-600 text-white'
                        }`}
                    >
                        <Locate size={12} />
                        <span>{trackedItemId === spotToDisplay.id ? 'Untrack' : 'Track'}</span>
                    </button>

                    {spotToDisplay.rawSpot && (
                        <>
                            {user?.id !== spotToDisplay.rawSpot.finderId && (
                                <button
                                    onClick={() => onMessageUser(spotToDisplay.rawSpot!.finderId, `Spot pinged by ${spotToDisplay.rawSpot!.finderName}`)}
                                    className="bg-white/10 hover:bg-white/20 text-white p-1.5 rounded-xl flex items-center justify-center transition-all shadow-md shrink-0"
                                    title="Message User"
                                >
                                    <MessageSquare size={14} />
                                </button>
                            )}

                            {user?.id !== spotToDisplay.rawSpot.finderId && spotToDisplay.rawSpot.status !== 'claimed' && (
                                <button
                                    onClick={onClaimSpotClick}
                                    className="flex-1 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold py-1.5 rounded-xl transition-all text-[11px] shadow-md shadow-amber-600/20"
                                >
                                    Claim Spot
                                </button>
                            )}

                            {user?.id === spotToDisplay.rawSpot.finderId && (
                                <div className="flex flex-1 gap-1.5">
                                    <button
                                        onClick={() => onEditSpot(spotToDisplay.rawSpot)}
                                        className="flex-1 bg-blue-600/50 hover:bg-blue-600 text-white font-bold py-1.5 rounded-xl transition-all text-[11px]"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={onDeletePing}
                                        className="flex-1 border border-red-500/50 hover:bg-red-500/10 text-red-400 font-bold py-1.5 rounded-xl transition-all text-[11px]"
                                    >
                                        Delete
                                    </button>
                                </div>
                            )}

                            {spotToDisplay.rawSpot.status === 'claimed' && spotToDisplay.rawSpot.claimedBy === user?.id && spotToDisplay.rawSpot.holdRequestStatus === 'accepted' && (
                                <button
                                    onClick={onArrivalRelease}
                                    className="flex-1 bg-green-600 hover:bg-green-500 active:scale-95 text-white font-bold py-1.5 rounded-xl transition-all text-[11px] shadow-md shadow-green-600/20 text-white"
                                >
                                    I've Arrived (Release $2)
                                </button>
                            )}

                            {spotToDisplay.rawSpot.status === 'claimed' && spotToDisplay.rawSpot.claimedBy === user?.id && spotToDisplay.rawSpot.holdRequestStatus !== 'accepted' && (
                                <span className="text-[10px] font-bold text-amber-400 self-center px-2 py-0.5 bg-amber-500/10 rounded-lg">Claimed by You!</span>
                            )}

                            {spotToDisplay.rawSpot.status === 'claimed' && spotToDisplay.rawSpot.claimedBy !== user?.id && user?.id !== spotToDisplay.rawSpot.finderId && (
                                <span className="text-[10px] font-bold text-gray-500 self-center px-2 py-0.5 bg-gray-500/10 rounded-lg">Claimed</span>
                            )}
                        </>
                    )}
                </div>
        </div>
    );
};
