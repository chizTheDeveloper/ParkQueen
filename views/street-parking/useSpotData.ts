import { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { useLocalParkingData } from '../../hooks/useLocalParkingData';
import { MapItem } from './types';
import { getDistance, NYC_CENTER } from './utils';

interface UseSpotDataOptions {
    userId: string | undefined;
    blockedUsers?: string[];
    searchCenter: [number, number];
    searchRadius: number;
    showFree: boolean;
    showPaid: boolean;
    showPublic: boolean;
    filterRadiusMiles?: number;
}

export function useSpotData({ userId, blockedUsers, searchCenter, searchRadius, showFree, showPaid, showPublic, filterRadiusMiles }: UseSpotDataOptions) {
    const [freeSpots, setFreeSpots] = useState<MapItem[]>([]);
    const [paidListings, setPaidListings] = useState<MapItem[]>([]);
    const [publicGarages, setPublicGarages] = useState<MapItem[]>([]);
    const [activeSpots, setActiveSpots] = useState<any[]>([]);
    const [pendingUpdatesCount, setPendingUpdatesCount] = useState(() => {
        const stored = localStorage.getItem('pendingUpdatesCount');
        return stored ? parseInt(stored, 10) : 3;
    });

    const { parkingData } = useLocalParkingData(
        (showPaid || showPublic) ? { lat: searchCenter[1], lng: searchCenter[0] } : null,
        searchRadius
    );

    // Firestore free spots listener
    useEffect(() => {
        if (!db || !userId) return;

        const nowTimestamp = Timestamp.now();
        const q = query(
            collection(db, "spots"),
            where("expiresAt", ">", nowTimestamp)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const now = Date.now();
            const spots = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as any))
                .filter(s => s.expiresAt?.toMillis() > now && s.status !== 'occupied' && (s.status !== 'interested' || s.finderId === userId || s.interestedUserId === userId))
                .filter(s => !(blockedUsers || []).includes(s.finderId));
            setActiveSpots(spots);

            const mappedFree: MapItem[] = spots.map(s => ({
                id: s.id,
                lat: s.lat,
                lng: s.lng,
                type: 'free' as const,
                status: s.status || 'available',
                title: s.address || '',
                reportedAt: s.reportedAt,
                expiresAt: s.expiresAt,
                finderId: s.finderId,
                finderName: s.finderName,
                finderVehicleColor: s.finderVehicleColor || null,
                finderVehicleType: s.finderVehicleType || null,
                finderVehicleBrand: s.finderVehicleBrand || null,
                finderTitle: s.finderTitle || null,
                interestedUserId: s.interestedUserId,
                interestedUserName: s.interestedUserName,
                interestedUserVehicleColor: s.interestedUserVehicleColor || null,
                interestedUserVehicleType: s.interestedUserVehicleType || null,
                interestedUserVehicleBrand: s.interestedUserVehicleBrand || null,
                interestedUserTitle: s.interestedUserTitle || null,
                etaMinutes: s.etaMinutes,
                interestExpiresAt: s.interestExpiresAt,
                address: s.address || '',
                geohash: s.geohash || '',
                originSpotId: s.originSpotId || null,
                pingMode: s.pingMode || null,
                rawSpot: s
            }));
            setFreeSpots(mappedFree);

            const lastViewedStr = localStorage.getItem('lastViewedNotifications');
            const lastViewedTime = lastViewedStr ? parseInt(lastViewedStr, 10) : 0;

            let newSpotsCount = 0;
            spots.forEach(s => {
                const reportedTime = s.reportedAt?.toMillis() || 0;
                if (reportedTime > lastViewedTime && s.finderId !== userId) {
                    newSpotsCount++;
                }
            });

            if (newSpotsCount > 0) {
                setPendingUpdatesCount(newSpotsCount);
                localStorage.setItem('pendingUpdatesCount', newSpotsCount.toString());
            } else {
                const saved = localStorage.getItem('pendingUpdatesCount');
                if (saved !== null) {
                    setPendingUpdatesCount(parseInt(saved, 10));
                }
            }
        }, (err) => {
            console.warn("Spots snapshot listener error:", err);
        });

        return () => unsubscribe();
    }, [userId]);

    // Firestore paid listings listener
    useEffect(() => {
        if (!showPaid) return;
        if (!db || !userId) return;
        const q = query(collection(db, "listings"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let list = snapshot.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    lat: data.lat || NYC_CENTER[1],
                    lng: data.lng || NYC_CENTER[0],
                    type: 'paid' as const,
                    status: 'available' as const,
                    title: data.title || 'Private Spot',
                    pricePerHour: data.pricePerHour || 1.50,
                    description: data.description || 'Secure parking space',
                    rawSpot: { id: d.id, ...data }
                };
            });
            setPaidListings(list);
        }, (err) => {
            console.warn("Listings snapshot listener error:", err);
        });
        return () => unsubscribe();
    }, [db, userId, searchCenter, showPaid]);

    // Google Places public/paid garages
    useEffect(() => {
        if (!parkingData) return;
        const newPublicItems: MapItem[] = parkingData.map(p => ({
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            type: p.isPaid ? 'paid' : 'public',
            status: 'available',
            title: p.title,
            pricePerHour: p.pricePerHour,
            description: p.address,
            rawSpot: null
        }));

        const paidItems = newPublicItems.filter(p => p.type === 'paid');
        const publicItems = newPublicItems.filter(p => p.type === 'public');

        setPublicGarages(publicItems);

        setPaidListings(prev => {
            const firestoreListings = prev.filter(p => !p.id.startsWith('places_'));
            return [...firestoreListings, ...paidItems];
        });
    }, [parkingData]);

    const radiusFilteredItems = useMemo(() => {
        const centerLat = searchCenter[1];
        const centerLng = searchCenter[0];

        const visibleItems: MapItem[] = [];
        if (showFree) visibleItems.push(...freeSpots);
        if (showPaid) visibleItems.push(...paidListings);
        if (showPublic) visibleItems.push(...publicGarages);

        return visibleItems.filter(item => {
            const distanceVal = getDistance(centerLat, centerLng, item.lat, item.lng);
            const distanceInMiles = distanceVal * 0.621371;
            return distanceInMiles <= (filterRadiusMiles ?? 2.0);
        });
    }, [showFree, showPaid, showPublic, freeSpots, paidListings, publicGarages, searchCenter, filterRadiusMiles]);

    return {
        freeSpots,
        paidListings,
        publicGarages,
        activeSpots,
        radiusFilteredItems,
        pendingUpdatesCount,
        setPendingUpdatesCount,
    };
}
