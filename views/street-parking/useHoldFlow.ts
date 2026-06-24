import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { MapItem } from './types';
import { drawRoute, clearRoute, NYC_CENTER } from './utils';

interface UseHoldFlowOptions {
    selectedItem: any;
    setSelectedItem: React.Dispatch<React.SetStateAction<any>>;
    user: any;
    freeSpots: MapItem[];
    userLocation: [number, number] | null;
    mapRef: React.RefObject<mapboxgl.Map | null>;
    activeRouteDestinationRef: React.MutableRefObject<[number, number] | null>;
}

export function useHoldFlow({
    selectedItem,
    setSelectedItem,
    user,
    freeSpots,
    userLocation,
    mapRef,
    activeRouteDestinationRef,
}: UseHoldFlowOptions) {
    const [trackedItemId, setTrackedItemId] = useState<string | null>(null);
    const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
    const [holdTimeRemaining, setHoldTimeRemaining] = useState<number | null>(null);
    const [lastCompletedHoldId, setLastCompletedHoldId] = useState<string | null>(null);
    const [finderSuccessNotification, setFinderSuccessNotification] = useState<string | null>(null);

    // Auto-responder: if claimant is testing alone, auto-accept hold request after 3s
    useEffect(() => {
        if (!selectedItem || !user || !db) return;
        if (selectedItem.holdRequestedBy === user.id && selectedItem.holdRequestStatus === 'pending') {
            const timer = setTimeout(async () => {
                try {
                    const spotRef = doc(db, "spots", selectedItem.id);
                    await updateDoc(spotRef, {
                        holdRequestStatus: 'accepted',
                        status: 'claimed',
                        claimedBy: user.id,
                        holdTimerExpiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000)
                    });
                } catch (err) {
                    console.warn("Auto-responder simulation error:", err);
                }
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [selectedItem?.holdRequestStatus, selectedItem?.id, user?.id]);

    // Auto-navigation when hold request is accepted
    useEffect(() => {
        if (!selectedItem || !user) return;
        if (selectedItem.holdRequestedBy === user.id &&
            selectedItem.holdRequestStatus === 'accepted' &&
            trackedItemId !== selectedItem.id) {
            setTrackedItemId(selectedItem.id);
            const startLoc = userLocation || NYC_CENTER;
            const dest: [number, number] = [selectedItem.lng, selectedItem.lat];
            activeRouteDestinationRef.current = dest;
            if (mapRef.current) {
                drawRoute(mapRef.current, startLoc, dest);
            }
        }
    }, [selectedItem?.holdRequestStatus, selectedItem?.id, userLocation]);

    // Hold countdown timer
    useEffect(() => {
        if (!selectedItem || selectedItem.holdRequestStatus !== 'accepted' || !selectedItem.holdTimerExpiresAt) {
            setHoldTimeRemaining(null);
            return;
        }

        const interval = setInterval(() => {
            const expiry = selectedItem.holdTimerExpiresAt.toMillis
                ? selectedItem.holdTimerExpiresAt.toMillis()
                : new Date(selectedItem.holdTimerExpiresAt).getTime();
            const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
            setHoldTimeRemaining(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
                const spotRef = doc(db, "spots", selectedItem.id);
                updateDoc(spotRef, {
                    holdRequestStatus: 'declined',
                    status: 'available',
                    claimedBy: null
                }).catch(e => console.warn("Expiry update failed", e));
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [selectedItem?.holdRequestStatus, selectedItem?.holdTimerExpiresAt, selectedItem?.id]);

    // Finder wallet payout success banner
    useEffect(() => {
        if (!user) return;
        const completedSpot = freeSpots.find(s => s.finderId === user.id && s.holdRequestStatus === 'completed');
        if (completedSpot && completedSpot.id !== lastCompletedHoldId) {
            setLastCompletedHoldId(completedSpot.id);
            setFinderSuccessNotification(`Claimant arrived! $2.00 has been released to your wallet from spot at ${completedSpot.title || 'Street Spot'}.`);
            setTimeout(() => setFinderSuccessNotification(null), 5000);
        }
    }, [freeSpots, user?.id, lastCompletedHoldId]);

    const handleAcceptHold = async (spot: MapItem) => {
        if (!db) return;
        try {
            const spotRef = doc(db, "spots", spot.id);
            await updateDoc(spotRef, {
                holdRequestStatus: 'accepted',
                status: 'claimed',
                claimedBy: spot.holdRequestedBy,
                holdTimerExpiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000)
            });
        } catch (e) {
            console.error("Error accepting hold request:", e);
        }
    };

    const handleDeclineHold = async (spot: MapItem) => {
        if (!db) return;
        try {
            const spotRef = doc(db, "spots", spot.id);
            await updateDoc(spotRef, {
                holdRequestStatus: 'declined',
                status: 'available',
                claimedBy: null
            });
        } catch (e) {
            console.error("Error declining hold request:", e);
        }
    };

    const handleSendHoldRequest = async () => {
        const spot = selectedItem || (freeSpots.length > 0 ? freeSpots[0] : null);
        if (!spot || !user || !db) return;
        setIsHoldModalOpen(false);
        try {
            const spotRef = doc(db, "spots", spot.id);
            await updateDoc(spotRef, {
                holdRequestedBy: user.id,
                holdRequestedByName: user.fullName || 'Anonymous',
                holdRequestStatus: 'pending',
                holdRequestExpiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000)
            });
            setSelectedItem((prev: any) => ({
                ...prev,
                holdRequestedBy: user.id,
                holdRequestedByName: user.fullName || 'Anonymous',
                holdRequestStatus: 'pending'
            }));
        } catch (e) {
            console.error("Error sending hold request:", e);
        }
    };

    const handleArrivalRelease = async () => {
        const spot = selectedItem || (freeSpots.length > 0 ? freeSpots[0] : null);
        if (!spot || !user || !db) return;
        try {
            const spotRef = doc(db, "spots", spot.id);
            await updateDoc(spotRef, {
                holdRequestStatus: 'completed',
                status: 'occupied'
            });
            setSelectedItem((prev: any) => ({
                ...prev,
                holdRequestStatus: 'completed',
                status: 'occupied'
            }));
            alert(`Escrow released successfully! $2.00 has been transferred to ${spot.finderName}.`);
        } catch (e) {
            console.error("Error releasing hold escrow:", e);
        }
    };

    const handleTrackLocation = () => {
        const spotToTrack = selectedItem || (freeSpots.length > 0 ? freeSpots[0] : null);
        if (!spotToTrack) return;
        if (trackedItemId === spotToTrack.id) {
            setTrackedItemId(null);
            activeRouteDestinationRef.current = null;
            if (mapRef.current) clearRoute(mapRef.current);
            return;
        }
        const startLoc = userLocation || NYC_CENTER;
        const dest: [number, number] = [spotToTrack.lng, spotToTrack.lat];
        activeRouteDestinationRef.current = dest;
        setTrackedItemId(spotToTrack.id);
        if (mapRef.current) {
            drawRoute(mapRef.current, startLoc, dest);
        }
    };

    return {
        trackedItemId,
        isHoldModalOpen,
        setIsHoldModalOpen,
        holdTimeRemaining,
        finderSuccessNotification,
        handleAcceptHold,
        handleDeclineHold,
        handleSendHoldRequest,
        handleArrivalRelease,
        handleTrackLocation,
    };
}
