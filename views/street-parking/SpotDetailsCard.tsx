import React, { useState } from 'react';
import { MessageSquare, MapPin, Clock, Navigation, Car } from 'lucide-react';
import { MapItem } from './types';
import { getDistance, formatTimeLeft } from './utils';
import { getVehicleHex, VehicleIcon } from '../../utils/vehicleIcon';
import { getTierForTitle, TIER_VISUALS } from '../../utils/crowns';
import { CrownBadge } from '../../utils/CrownBadge';
import { db } from '../../firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

const QUICK_REPLIES = ['On my way out', 'Be there in a few minutes', 'Already left, go ahead', 'Running a bit late'];

interface SpotDetailsCardProps {
    selectedItem: any;
    freeSpots: MapItem[];
    user: any;
    userLocation: [number, number] | null;
    spotAddress: string;
    onHeadingThere: () => void;
    onEditSpot: (spot: any) => void;
    onDeletePing: () => void;
    onArrival: () => void;
    onCancelByFinder: (reason: string) => void;
    onCancelByClaimer: (reason: string) => void;
    onDriverArrived: () => void;
    onMessageUser: (userId: string, context: string) => void;
    nearbyInterestCount?: number;
    interestError: string | null;
    estDriveMinutes: number | null;
    isWithinArrivalRange: boolean;
    maxEtaMinutes: number;
    manageMode?: boolean;
    nowMs?: number;
}

export const SpotDetailsCard: React.FC<SpotDetailsCardProps> = ({
    selectedItem, freeSpots, user, userLocation, spotAddress,
    onHeadingThere, onEditSpot, onDeletePing, onArrival,
    onCancelByFinder, onCancelByClaimer, onDriverArrived, onMessageUser,
    nearbyInterestCount = 0, interestError, estDriveMinutes, isWithinArrivalRange, maxEtaMinutes, manageMode = false, nowMs = Date.now(),
}) => {
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [messageSent, setMessageSent] = useState(false);
    const [showClaimerReasons, setShowClaimerReasons] = useState(false);
    const [showFinderReasons, setShowFinderReasons] = useState(false);

    if (!selectedItem) return null;

    const distanceVal = userLocation ? getDistance(userLocation[1], userLocation[0], selectedItem.lat, selectedItem.lng) : null;
    const distanceText = distanceVal
        ? (distanceVal * 0.621371 < 0.1 ? `${Math.round(distanceVal * 1000 * 1.09361)} yd` : `${(distanceVal * 0.621371).toFixed(1)} mi`)
        : '';

    const departureDate = selectedItem.reportedAt ? (typeof selectedItem.reportedAt.toDate === 'function' ? selectedItem.reportedAt.toDate() : new Date(selectedItem.reportedAt)) : null;
    const isScheduled = departureDate && departureDate.getTime() > nowMs;
    const departureText = departureDate ? (isScheduled ? departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Leaving Now') : '';
    const timeLeftMs = selectedItem.expiresAt ? (typeof selectedItem.expiresAt.toMillis === 'function' ? selectedItem.expiresAt.toMillis() : new Date(selectedItem.expiresAt).getTime()) - Date.now() : 0;

    const isFinder = user?.id === selectedItem.finderId;
    const isInterestedUser = user?.id === selectedItem.interestedUserId;
    const spotStatus = selectedItem.status;

    type CardState = 'available' | 'my_claim' | 'my_ping_available' | 'my_ping_claimed' | 'third_party';
    let state: CardState;
    if (isFinder && spotStatus === 'interested' && !manageMode) state = 'my_ping_claimed';
    else if (isFinder) state = 'my_ping_available';
    else if (isInterestedUser && spotStatus === 'interested') state = 'my_claim';
    else if (spotStatus === 'available') state = 'available';
    else state = 'third_party';

    const sendQuickReply = async (text: string) => {
        if (!user || !selectedItem.interestedUserId) return;
        const otherUserId = selectedItem.interestedUserId;
        const chatId = [user.id, otherUserId].sort().join('_');
        const chatRef = doc(db, 'chats', chatId);
        await setDoc(chatRef, {
            id: chatId,
            participants: [user.id, otherUserId],
            participantNames: { [user.id]: user.fullName || 'Driver', [otherUserId]: selectedItem.interestedUserName || 'Driver' },
            relatedSpotTitle: selectedItem.title || spotAddress || 'Street Spot',
            lastMessage: text,
            lastMessageTimestamp: serverTimestamp(),
            lastSenderId: user.id,
        }, { merge: true });
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
            senderId: user.id, text, timestamp: serverTimestamp(),
        });
        setShowQuickReplies(false);
        setMessageSent(true);
        setTimeout(() => setMessageSent(false), 2000);
    };

    // For the finder's own ping, read vehicle info from the live user object (always current).
    // For others, read from the denormalized spot fields (written at ping creation time).
    const vehicleColor = isFinder ? (user?.vehicleColor || selectedItem.finderVehicleColor) : selectedItem.finderVehicleColor;
    const vehicleType = isFinder ? (user?.vehicleType || selectedItem.finderVehicleType) : selectedItem.finderVehicleType;
    const vehicleBrand = isFinder ? (user?.vehicleBrand || selectedItem.finderVehicleBrand) : selectedItem.finderVehicleBrand;

    const vehicleHex = getVehicleHex(vehicleColor);
    const hasVehicle = vehicleType || vehicleColor || vehicleBrand;
    const vehicleLabel = [vehicleColor, vehicleBrand, vehicleType].filter(Boolean).join(' · ');

    // Finder initial avatar
    const finderName = selectedItem.finderName || 'Driver';
    const finderInitial = finderName.charAt(0).toUpperCase();

    // Status badge config
    const badgeConfig = state === 'my_claim'
        ? { label: 'En Route', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' }
        : spotStatus === 'available' && isScheduled
        ? { label: 'Soon', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' }
        : spotStatus === 'available'
        ? { label: 'Free', color: 'text-green-400 bg-green-500/10 border-green-500/20' }
        : { label: 'Reserved', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };

    // Claimer heading to spot — finder's vehicle is the hero
    if (state === 'my_claim') {
        return (
            <div>
                <p className="text-[11px] font-bold text-[#38bdf8] uppercase tracking-widest text-center mb-4">You're on your way</p>

                {/* Finder avatar + name */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold text-xl"
                        style={{ background: 'linear-gradient(135deg, #1e75ff, #0ea5e9)' }}>
                        {finderInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-lg font-extrabold text-[var(--color-text)] truncate">{finderName}</p>
                        {selectedItem.finderTitle && (() => {
                            const ft = getTierForTitle(selectedItem.finderTitle);
                            return (
                                <div className="flex items-center gap-1 mt-0.5">
                                    <CrownBadge tier={ft} size={11} />
                                    <span className="text-[11px] font-semibold" style={{ color: TIER_VISUALS[ft].textColor }}>{selectedItem.finderTitle}</span>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Vehicle hero — what to look out for */}
                {hasVehicle && (
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 mb-4">
                        <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-3">Look out for</p>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-white/10"
                                style={{ background: vehicleHex + '33' }}>
                                <VehicleIcon type={vehicleType} color={vehicleColor} size={26} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-base font-extrabold text-[var(--color-text)] truncate">
                                    {[vehicleColor, vehicleBrand].filter(Boolean).join(' ') || vehicleType}
                                </p>
                                {vehicleType && (vehicleColor || vehicleBrand) && (
                                    <p className="text-sm text-[var(--color-text-secondary)]">{vehicleType}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {interestError && <p className="text-red-400 text-xs mb-2 text-center">{interestError}</p>}
                {messageSent && <p className="text-emerald-400 text-xs mb-2 text-center font-semibold">Message sent</p>}

                {showQuickReplies && (
                    <div className="mb-3 grid grid-cols-2 gap-1.5">
                        {QUICK_REPLIES.map(msg => (
                            <button key={msg} onClick={() => sendQuickReply(msg)}
                                className="bg-white/5 border border-[var(--color-border)] hover:bg-white/10 text-[var(--color-text)] font-semibold py-2.5 px-2 rounded-2xl text-xs transition-all active:scale-95">
                                {msg}
                            </button>
                        ))}
                    </div>
                )}

                {showClaimerReasons ? (
                    <div>
                        <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest text-center mb-3">Why are you canceling?</p>
                        <div className="space-y-2 mb-2">
                            {["Found parking elsewhere", "Traffic is too heavy", "Changed my mind"].map(reason => (
                                <button key={reason} onClick={() => onCancelByClaimer(reason)}
                                    className="w-full py-3 px-4 rounded-2xl text-sm font-semibold border border-[var(--color-border)] bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)] text-left">
                                    {reason}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowClaimerReasons(false)}
                            className="w-full py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-all">
                            ← Back
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => setShowClaimerReasons(true)}
                            className="px-4 border border-red-500/40 hover:bg-red-500/10 text-red-400 font-bold py-3.5 rounded-2xl transition-all text-sm active:scale-95">
                            Cancel
                        </button>
                        <button onClick={() => setShowQuickReplies(!showQuickReplies)}
                            className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-[var(--color-text)] flex items-center justify-center transition-all shrink-0 active:scale-95">
                            <MessageSquare size={16} />
                        </button>
                        <button onClick={onArrival} disabled={!isWithinArrivalRange}
                            className="flex-1 font-bold py-3.5 rounded-2xl transition-all text-sm active:scale-95 text-white disabled:opacity-40"
                            style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}>
                            {isWithinArrivalRange ? "I've arrived" : (distanceText ? `${distanceText} away` : "Get closer")}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Finder view — claimer's vehicle is the hero
    if (state === 'my_ping_claimed') {
        const vc = selectedItem.interestedUserVehicleColor;
        const vt = selectedItem.interestedUserVehicleType;
        const vb = selectedItem.interestedUserVehicleBrand;
        const claimerName = selectedItem.interestedUserName || 'Someone';
        const claimerInitial = claimerName.charAt(0).toUpperCase();
        const vehicleHexClaimer = getVehicleHex(vc);
        const hasClaimerVehicle = vc || vt || vb;

        return (
            <div>
                {/* Label */}
                <p className="text-[11px] font-bold text-[#38bdf8] uppercase tracking-widest text-center mb-4">On their way to your spot</p>

                {/* Avatar + name + ETA */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold text-xl"
                        style={{ background: 'linear-gradient(135deg, #1e75ff, #0ea5e9)' }}>
                        {claimerInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-lg font-extrabold text-[var(--color-text)] truncate">{claimerName}</p>
                        {selectedItem.interestedUserTitle && (() => {
                            const ct = getTierForTitle(selectedItem.interestedUserTitle);
                            return (
                                <div className="flex items-center gap-1 mt-0.5">
                                    <CrownBadge tier={ct} size={11} />
                                    <span className="text-[11px] font-semibold" style={{ color: TIER_VISUALS[ct].textColor }}>{selectedItem.interestedUserTitle}</span>
                                </div>
                            );
                        })()}
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-3xl font-extrabold text-[var(--color-text)]">{selectedItem.etaMinutes}</p>
                        <p className="text-[9px] font-bold text-[#38bdf8] uppercase tracking-wide">min away</p>
                        <p className="text-[8px] text-[var(--color-text-secondary)] mt-0.5">est. arrival</p>
                    </div>
                </div>

                {/* Vehicle hero — what to look out for */}
                {hasClaimerVehicle && (
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 mb-4">
                        <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-3">Look out for</p>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-white/10"
                                style={{ background: vehicleHexClaimer + '33' }}>
                                <VehicleIcon type={vt} color={vc} size={26} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-base font-extrabold text-[var(--color-text)] truncate">
                                    {[vc, vb].filter(Boolean).join(' ') || vt}
                                </p>
                                {vt && (vc || vb) && (
                                    <p className="text-sm text-[var(--color-text-secondary)]">{vt}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {messageSent && <p className="text-emerald-400 text-xs mb-2 text-center font-semibold">Message sent</p>}
                {showQuickReplies && (
                    <div className="mb-3 grid grid-cols-2 gap-1.5">
                        {QUICK_REPLIES.map(msg => (
                            <button key={msg} onClick={() => sendQuickReply(msg)}
                                className="bg-white/5 border border-[var(--color-border)] hover:bg-white/10 text-[var(--color-text)] font-semibold py-2.5 px-2 rounded-2xl text-xs transition-all active:scale-95">
                                {msg}
                            </button>
                        ))}
                    </div>
                )}

                {showFinderReasons ? (
                    <div>
                        <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest text-center mb-3">What's happening?</p>
                        <div className="space-y-2 mb-2">
                            <button onClick={onDriverArrived}
                                className="w-full py-3 px-4 rounded-2xl text-sm font-semibold border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 transition-all active:scale-95 text-emerald-400 text-left">
                                The driver arrived ✓
                            </button>
                            {["Can't wait anymore", "Spot no longer available"].map(reason => (
                                <button key={reason} onClick={() => onCancelByFinder(reason)}
                                    className="w-full py-3 px-4 rounded-2xl text-sm font-semibold border border-[var(--color-border)] bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)] text-left">
                                    {reason}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowFinderReasons(false)}
                            className="w-full py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-all">
                            ← Back
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={() => setShowFinderReasons(true)}
                            className="px-4 border border-red-500/40 hover:bg-red-500/10 text-red-400 font-bold py-3.5 rounded-2xl transition-all text-sm active:scale-95">
                            Cancel
                        </button>
                        <button onClick={() => setShowQuickReplies(!showQuickReplies)}
                            className="flex-1 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-sm active:scale-95"
                            style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}>
                            <MessageSquare size={14} />
                            Message
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Someone else's ping — no address, just enough to decide
    if (state === 'available') {
        return (
            <div>
                <p className="text-[11px] font-bold text-[#38bdf8] uppercase tracking-widest text-center mb-4">Available spot</p>

                <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold text-xl"
                        style={{ background: 'linear-gradient(135deg, #1e75ff, #0ea5e9)' }}>
                        {finderInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-lg font-extrabold text-[var(--color-text)] truncate">{finderName}</p>
                        {selectedItem.finderTitle && (() => {
                            const ft = getTierForTitle(selectedItem.finderTitle);
                            return (
                                <div className="flex items-center gap-1 mt-0.5">
                                    <CrownBadge tier={ft} size={11} />
                                    <span className="text-[11px] font-semibold" style={{ color: TIER_VISUALS[ft].textColor }}>{selectedItem.finderTitle}</span>
                                </div>
                            );
                        })()}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-xl border shrink-0 ${badgeConfig.color}`}>
                        {badgeConfig.label}
                    </span>
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 mb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock size={14} className={isScheduled ? 'text-yellow-400 shrink-0' : 'text-green-400 shrink-0'} />
                            <span className="text-sm font-bold text-[var(--color-text)]">
                                {isScheduled ? `Leaving at ${departureText}` : 'Leaving now'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {distanceText && (
                                <span className="text-sm font-bold text-[var(--color-text-secondary)]">{distanceText}</span>
                            )}
                            {timeLeftMs > 0 && (
                                <span className="text-xs text-[var(--color-text-secondary)]">{formatTimeLeft(timeLeftMs)} left</span>
                            )}
                        </div>
                    </div>
                </div>

                {interestError && <p className="text-red-400 text-xs mb-3 text-center">{interestError}</p>}

                <div className="flex gap-2">
                    <button onClick={() => onMessageUser(selectedItem.finderId, `Spot pinged by ${finderName}`)}
                        className="bg-white/10 hover:bg-white/20 text-[var(--color-text)] p-3.5 rounded-2xl flex items-center justify-center transition-all shrink-0 active:scale-95">
                        <MessageSquare size={16} />
                    </button>
                    {estDriveMinutes !== null && estDriveMinutes > maxEtaMinutes ? (
                        <span className="flex-1 text-xs text-[var(--color-text-secondary)] self-center text-center">
                            Too far (~{estDriveMinutes} min drive)
                        </span>
                    ) : (
                        <button onClick={onHeadingThere}
                            className="flex-1 font-bold py-3.5 rounded-2xl transition-all text-sm active:scale-95 text-white flex items-center justify-center gap-1.5"
                            style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)' }}>
                            <Navigation size={14} />
                            I'm heading there
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Finder's own ping management view — address visible, edit/delete actions
    if (state === 'my_ping_available') {
        return (
            <div>
                <p className="text-[11px] font-bold text-[#38bdf8] uppercase tracking-widest text-center mb-4">Your shared spot</p>

                <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold text-xl"
                        style={{ background: 'linear-gradient(135deg, #1e75ff, #0ea5e9)' }}>
                        {finderInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-lg font-extrabold text-[var(--color-text)] truncate">{finderName}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border inline-block mt-0.5 ${badgeConfig.color}`}>
                            {badgeConfig.label}
                        </span>
                    </div>
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 mb-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-[#38bdf8] shrink-0" />
                        <span className="text-sm font-semibold text-[var(--color-text)] truncate">
                            {selectedItem.title || spotAddress || 'Street Parking Spot'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock size={14} className={isScheduled ? 'text-yellow-400 shrink-0' : 'text-green-400 shrink-0'} />
                            <span className="text-sm font-bold text-[var(--color-text)]">
                                {isScheduled ? `Leaving at ${departureText}` : 'Leaving now'}
                            </span>
                        </div>
                        {timeLeftMs > 0 && (
                            <span className="text-xs text-[var(--color-text-secondary)]">{formatTimeLeft(timeLeftMs)} left</span>
                        )}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => onEditSpot(selectedItem)}
                        className="flex-1 bg-white/10 hover:bg-white/20 text-[var(--color-text)] font-bold py-3.5 rounded-2xl transition-all text-sm active:scale-95">
                        Edit
                    </button>
                    <button onClick={onDeletePing}
                        className="flex-1 border border-red-500/50 hover:bg-red-500/10 text-red-400 font-bold py-3.5 rounded-2xl transition-all text-sm active:scale-95">
                        Delete
                    </button>
                </div>
            </div>
        );
    }

    // Third party — spot is taken
    return (
        <div>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold text-xl"
                    style={{ background: 'linear-gradient(135deg, #1e75ff, #0ea5e9)' }}>
                    {finderInitial}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-lg font-extrabold text-[var(--color-text)] truncate">{finderName}</p>
                    {selectedItem.finderTitle && (
                        <p className="text-[11px] font-semibold text-[#38bdf8] mt-0.5">{selectedItem.finderTitle}</p>
                    )}
                </div>
            </div>
            <span className="flex w-full text-xs font-bold text-amber-400 justify-center px-2 py-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                Someone is already heading there
            </span>
        </div>
    );
};
