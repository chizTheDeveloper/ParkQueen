import { useState } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc, runTransaction, Timestamp, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { MapItem } from './types';
import { getDistance, drawRoute, clearRoute, NYC_CENTER } from './utils';

interface UseInterestFlowOptions {
    selectedItem: any;
    setSelectedItem: React.Dispatch<React.SetStateAction<any>>;
    user: any;
    freeSpots: MapItem[];
    userLocation: [number, number] | null;
    mapRef: React.RefObject<mapboxgl.Map | null>;
    activeRouteDestinationRef: React.MutableRefObject<[number, number] | null>;
}

const MAX_ETA_MINUTES = 7;
const ARRIVAL_DISTANCE_KM = 0.06; // ~200 feet
const ETA_OPTIONS = [2, 5, 8, 10];
// ponytail: straight-line km to estimated driving minutes at ~25 km/h city speed
const kmToEstMinutes = (km: number) => Math.ceil((km / 25) * 60);

export function useInterestFlow({
    selectedItem, setSelectedItem, user, freeSpots, userLocation, mapRef, activeRouteDestinationRef
}: UseInterestFlowOptions) {
    const [trackedItemId, setTrackedItemId] = useState<string | null>(null);
    const [isEtaPickerOpen, setIsEtaPickerOpen] = useState(false);
    const [interestError, setInterestError] = useState<string | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);

    const getEstDriveMinutes = (spot: MapItem): number | null => {
        if (!userLocation) return null;
        const km = getDistance(userLocation[1], userLocation[0], spot.lat, spot.lng);
        return kmToEstMinutes(km);
    };

    const isWithinArrivalRange = (spot: MapItem): boolean => {
        if (!userLocation) return false;
        return getDistance(userLocation[1], userLocation[0], spot.lat, spot.lng) <= ARRIVAL_DISTANCE_KM;
    };

    const checkAlreadyInterested = async (): Promise<boolean> => {
        if (!user?.id) return false;
        const q = query(collection(db, 'spots'), where('interestedUserId', '==', user.id), where('status', '==', 'interested'));
        const snap = await getDocs(q);
        return !snap.empty;
    };

    const handleExpressInterest = async (etaMinutes: number) => {
        const spot = selectedItem;
        if (!spot || !user || !db) return;
        setInterestError(null);
        setIsEtaPickerOpen(false);

        const estMinutes = getEstDriveMinutes(spot);
        if (estMinutes !== null && estMinutes > MAX_ETA_MINUTES) {
            setInterestError("Too far to reserve this spot right now");
            return;
        }

        const alreadyActive = await checkAlreadyInterested();
        if (alreadyActive) {
            setInterestError("You're already heading to another spot");
            return;
        }

        try {
            const spotRef = doc(db, 'spots', spot.id);
            await runTransaction(db, async (tx) => {
                const fresh = await tx.get(spotRef);
                if (!fresh.exists()) throw new Error("Spot no longer exists");
                const data = fresh.data();
                if (data.status !== 'available') throw new Error("Someone already got this spot");

                tx.update(spotRef, {
                    status: 'interested',
                    interestedUserId: user.id,
                    interestedUserName: user.fullName || 'Someone',
                    etaMinutes,
                    interestExpiresAt: Timestamp.fromMillis(Date.now() + (etaMinutes + 3) * 60000),
                });
            });

            // Start route tracking
            const dest: [number, number] = [spot.lng, spot.lat];
            activeRouteDestinationRef.current = dest;
            setTrackedItemId(spot.id);
            if (mapRef.current) drawRoute(mapRef.current, userLocation || NYC_CENTER, dest);
        } catch (e: any) {
            setInterestError(e.message || "Failed to reserve spot");
        }
    };

    const handleCancelByFinder = async () => {
        if (!selectedItem || !db) return;
        await updateDoc(doc(db, 'spots', selectedItem.id), {
            status: 'available',
            interestedUserId: null,
            interestedUserName: null,
            etaMinutes: null,
            interestExpiresAt: null,
        });
    };

    const handleDelayByFinder = async (extraMinutes = 3) => {
        if (!selectedItem || !db) return;
        const current = selectedItem.interestExpiresAt?.toMillis?.() || Date.now();
        await updateDoc(doc(db, 'spots', selectedItem.id), {
            interestExpiresAt: Timestamp.fromMillis(current + extraMinutes * 60000),
        });
    };

    const handleArrival = async () => {
        if (!selectedItem || !user || !db) return;
        await updateDoc(doc(db, 'spots', selectedItem.id), { status: 'occupied' });
        setTrackedItemId(null);
        activeRouteDestinationRef.current = null;
        if (mapRef.current) clearRoute(mapRef.current);
        setShowFeedback(true);
    };

    const handleFeedback = async (feedback: string) => {
        if (!selectedItem || !user) return;
        await addDoc(collection(db, 'spotFeedback'), {
            spotId: selectedItem.id,
            userId: user.id,
            finderId: selectedItem.finderId,
            feedback,
            createdAt: Timestamp.now(),
        });
        setShowFeedback(false);
        setSelectedItem(null);
    };

    const handleTrackLocation = () => {
        const spot = selectedItem || (freeSpots.length > 0 ? freeSpots[0] : null);
        if (!spot) return;
        if (trackedItemId === spot.id) {
            setTrackedItemId(null);
            activeRouteDestinationRef.current = null;
            if (mapRef.current) clearRoute(mapRef.current);
            return;
        }
        const dest: [number, number] = [spot.lng, spot.lat];
        activeRouteDestinationRef.current = dest;
        setTrackedItemId(spot.id);
        if (mapRef.current) drawRoute(mapRef.current, userLocation || NYC_CENTER, dest);
    };

    return {
        trackedItemId,
        isEtaPickerOpen,
        setIsEtaPickerOpen,
        interestError,
        setInterestError,
        showFeedback,
        handleExpressInterest,
        handleCancelByFinder,
        handleDelayByFinder,
        handleArrival,
        handleFeedback,
        handleTrackLocation,
        getEstDriveMinutes,
        isWithinArrivalRange,
        ETA_OPTIONS,
        MAX_ETA_MINUTES,
    };
}
