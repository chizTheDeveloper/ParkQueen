import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppView } from '../types';
import { MapPin, Check, Locate, X, Bell, Wallet, Clock } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, doc, deleteDoc, writeBatch, updateDoc, getDocs, where, query } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import * as geofire from 'geofire-common';

import { MAPBOX_TOKEN, NYC_CENTER, createMarkerElement, clearRoute, drawRoute, getDistance } from './street-parking/utils';
import { MapItem, MapViewProps } from './street-parking/types';
import { SpotModal } from './street-parking/SpotModal';
import { useSearch } from './street-parking/useSearch';
import { useUnreadMessages } from './street-parking/useUnreadMessages';
import { useSpotData } from './street-parking/useSpotData';
import { useHoldFlow } from './street-parking/useHoldFlow';
import { SpotDetailsCard } from './street-parking/SpotDetailsCard';
import { HeaderBar } from './street-parking/HeaderBar';


export const MapView: React.FC<MapViewProps> = ({ user, setView, onMessageUser }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const allMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const activeRouteDestinationRef = useRef<[number, number] | null>(null);

    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [searchCenter, setSearchCenter] = useState<[number, number]>(NYC_CENTER);
    const [searchRadius] = useState<number>(2000);

    const [showFree, setShowFree] = useState(true);
    const [showPaid, setShowPaid] = useState(false);
    const [showPublic, setShowPublic] = useState(false);


    const [isPinging, setIsPinging] = useState(false);
    const [showPingConfirmation, setShowPingConfirmation] = useState(false);
    const [isSpotModalOpen, setSpotModalOpen] = useState(false);
    const [spotAddress, setSpotAddress] = useState<string>("Loading address...");
    const [emptyCardDismissed, setEmptyCardDismissed] = useState(false);

    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);

    // --- Custom hooks ---

    const search = useSearch();
    const unreadMessagesCount = useUnreadMessages(user?.id);

    const spotData = useSpotData({
        userId: user?.id,
        searchCenter,
        searchRadius,
        showFree,
        showPaid,
        showPublic,
    });

    const holdFlow = useHoldFlow({
        selectedItem,
        setSelectedItem,
        user,
        freeSpots: spotData.freeSpots,
        userLocation,
        mapRef,
        activeRouteDestinationRef,
    });

    const spotCount = spotData.radiusFilteredItems.length;

    const nearestSpot = useMemo(() => {
        if (!userLocation || spotData.freeSpots.length === 0) return null;
        let closest: any = null;
        let minDist = Infinity;
        spotData.freeSpots.forEach(s => {
            const d = getDistance(userLocation[1], userLocation[0], s.lat, s.lng);
            if (d < minDist) { minDist = d; closest = s; }
        });
        if (!closest) return null;
        const mi = minDist * 0.621371;
        const distText = mi < 0.1 ? `${Math.round(minDist * 1000 * 1.09361)} yd` : `${mi.toFixed(1)} mi`;
        const reportedAt = closest.reportedAt?.toDate?.();
        let timeAgo: string | null = null;
        if (reportedAt) {
            const mins = Math.floor((Date.now() - reportedAt.getTime()) / 60000);
            timeAgo = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)}h ago`;
        }
        return { spot: closest, distText, timeAgo };
    }, [userLocation, spotData.freeSpots]);

    // --- Remaining effects ---

    // Clear route when deselecting
    useEffect(() => {
        if (!selectedItem) {
            activeRouteDestinationRef.current = null;
            if (mapRef.current) clearRoute(mapRef.current);
        }
    }, [selectedItem]);

    // Sync selectedItem from live Firestore updates
    useEffect(() => {
        if (!selectedItem) return;
        const updatedFree = spotData.freeSpots.find(s => s.id === selectedItem.id);
        if (updatedFree) {
            if (updatedFree.status !== selectedItem.status ||
                updatedFree.holdRequestStatus !== selectedItem.holdRequestStatus ||
                updatedFree.claimedBy !== selectedItem.claimedBy) {
                setSelectedItem(updatedFree);
            }
            return;
        }
        const updatedPaid = spotData.paidListings.find(s => s.id === selectedItem.id);
        if (updatedPaid) {
            if (updatedPaid.status !== selectedItem.status) {
                setSelectedItem(updatedPaid);
            }
            return;
        }
    }, [spotData.freeSpots, spotData.paidListings, selectedItem?.id]);

    // Map initialization
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;
        if (!MAPBOX_TOKEN) {
            console.error("VITE_MAPBOX_TOKEN is not set");
        } else {
            mapboxgl.accessToken = MAPBOX_TOKEN;
        }
        const map = new mapboxgl.Map({ container: mapContainerRef.current, style: 'mapbox://styles/mapbox/dark-v11', center: NYC_CENTER, zoom: 14, attributionControl: false, interactive: true });
        mapRef.current = map;

        map.on('load', () => { map.resize(); });

        let moveEndTimeout: ReturnType<typeof setTimeout> | undefined;
        map.on('moveend', () => {
            if (moveEndTimeout) clearTimeout(moveEndTimeout);
            moveEndTimeout = setTimeout(() => {
                const center = map.getCenter();
                setSearchCenter([center.lng, center.lat]);
            }, 400);
        });

        return () => {
            if (moveEndTimeout) clearTimeout(moveEndTimeout);
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Geolocation watch
    useEffect(() => {
        if (!navigator.geolocation) {
            console.warn("Geolocation is not supported by your browser.");
            return;
        }

        let isInitialLocation = true;

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { longitude, latitude } = position.coords;
                const newLocation: [number, number] = [longitude, latitude];
                setUserLocation(newLocation);

                if (activeRouteDestinationRef.current && mapRef.current) {
                    drawRoute(mapRef.current, newLocation, activeRouteDestinationRef.current);
                }

                try {
                    const newGeohash = geofire.geohashForLocation([latitude, longitude]);
                    const newPrefix = newGeohash.substring(0, 5);
                    const currentPrefix = userRef.current?.lastGeohash?.substring(0, 5);
                    if (userRef.current && db && newPrefix !== currentPrefix) {
                        updateDoc(doc(db, 'users', userRef.current.id), { lastGeohash: newGeohash }).catch(e => console.warn('Failed to update lastGeohash', e));
                    }
                } catch (err) {
                    console.error("Geohash generation error:", err);
                }

                if (isInitialLocation && mapRef.current) {
                    mapRef.current.flyTo({ center: newLocation, zoom: 16 });
                    isInitialLocation = false;
                }
            },
            (error) => console.error("Error watching position:", error),
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 0, distanceFilter: 10 }
        );

        return () => { navigator.geolocation.clearWatch(watchId); };
    }, []);

    // Marker rendering
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        const nextIds = new Set(spotData.radiusFilteredItems.map(item => item.id));
        const currentMarkers = allMarkersRef.current;

        Object.keys(currentMarkers).forEach(id => {
            if (!nextIds.has(id)) {
                currentMarkers[id].remove();
                delete currentMarkers[id];
            }
        });

        spotData.radiusFilteredItems.forEach(item => {
            const lngLat: [number, number] = [item.lng, item.lat];
            if (!currentMarkers[item.id]) {
                let priceStr = undefined;
                if (item.type === 'paid' || item.type === 'public') {
                    priceStr = `$${(item.pricePerHour || 1.50).toFixed(2)}/hr`;
                }
                const el = createMarkerElement(item.type, priceStr);
                const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
                    .setLngLat(lngLat)
                    .addTo(map);

                marker.getElement().addEventListener('click', (e) => {
                    e.stopPropagation();
                    setSelectedItem(item);
                    map.flyTo({ center: lngLat, zoom: 16 });
                });

                currentMarkers[item.id] = marker;
            } else {
                const cur = currentMarkers[item.id].getLngLat();
                if (cur.lng !== item.lng || cur.lat !== item.lat) {
                    currentMarkers[item.id].setLngLat(lngLat);
                }
            }
        });
    }, [spotData.radiusFilteredItems]);

    // Spot address resolution
    useEffect(() => {
        const spot = selectedItem || (spotData.freeSpots.length > 0 ? spotData.freeSpots[0] : null);
        const coords = spot
            ? { lng: spot.lng, lat: spot.lat, title: spot.title, address: spot.address }
            : userLocation ? { lng: userLocation[0], lat: userLocation[1], title: null, address: null } : null;
        if (!coords) { setSpotAddress(""); return; }
        if (coords.title) { setSpotAddress(coords.title); return; }
        if (coords.address) { setSpotAddress(coords.address); return; }
        if (!MAPBOX_TOKEN) { setSpotAddress("Street Spot"); return; }

        setSpotAddress("Resolving address...");
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?types=address&access_token=${MAPBOX_TOKEN}&limit=1`)
            .then(res => res.json())
            .then(data => {
                if (data.features && data.features.length > 0) {
                    setSpotAddress(data.features[0].place_name.split(',')[0]);
                } else {
                    setSpotAddress(`Coordinates: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
                }
            })
            .catch(() => { setSpotAddress("Street Spot"); });
    }, [selectedItem, spotData.freeSpots, userLocation, MAPBOX_TOKEN]);

    // User location marker
    useEffect(() => {
        if (userMarkerRef.current) userMarkerRef.current.remove();
        if (mapRef.current && userLocation) {
            const el = document.createElement('div');
            el.style.zIndex = '5';
            el.innerHTML = `<div class="relative flex items-center justify-center"><div class="absolute w-11 h-11 bg-blue-500/20 rounded-full animate-pulse"></div><div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg></div></div>`;
            userMarkerRef.current = new mapboxgl.Marker(el).setLngLat(userLocation).addTo(mapRef.current);
        }
    }, [userLocation]);

    // --- Handlers ---

    const handleLocateMe = () => {
        if (userLocation && mapRef.current) {
            mapRef.current.flyTo({ center: userLocation, zoom: 16 });
        }
    };

    const handleSaveSpot = async (departureTime: Date | null) => {
        if (isPinging || !user) return;
        setIsPinging(true);
        setSpotModalOpen(false);

        const now = Date.now();
        const reportedAt = departureTime ? Timestamp.fromDate(departureTime) : Timestamp.fromMillis(now);
        const expiresAt = Timestamp.fromMillis(reportedAt.toMillis() + 60 * 60 * 1000);

        const onSaveSuccess = () => {
            setIsPinging(false);
            setSelectedItem(null);
        };

        const onSaveError = (error: any) => {
            console.error("Error saving spot:", error);
            alert("There was an error saving your ping. Please try again.");
            setIsPinging(false);
        };

        if (selectedItem) {
            try {
                const batch = writeBatch(db);
                const oldSpotRef = doc(db, "spots", selectedItem.id);
                batch.delete(oldSpotRef);
                const newSpotRef = doc(collection(db, "spots"));
                const newSpotData = {
                    lat: selectedItem.lat,
                    lng: selectedItem.lng,
                    type: 'free',
                    status: 'available',
                    finderId: user.id,
                    finderName: user.fullName || 'Anonymous',
                    reportedAt,
                    expiresAt,
                };
                batch.set(newSpotRef, newSpotData);
                await batch.commit();
                onSaveSuccess();
            } catch (error) {
                onSaveError(error);
            }
        } else {
            try {
                const oneHourAgo = now - 60 * 60 * 1000;
                const q = query(
                    collection(db, "spots"),
                    where("finderId", "==", user.id)
                );
                const snap = await getDocs(q);
                const recentSpots = snap.docs.filter(d => {
                    const data = d.data();
                    const reportedTime = data.reportedAt?.toMillis
                        ? data.reportedAt.toMillis()
                        : new Date(data.reportedAt).getTime();
                    return reportedTime >= oneHourAgo;
                });

                if (recentSpots.length >= 5) {
                    alert("You have reached your limit of 5 pings per hour. Please wait before pinging again!");
                    setIsPinging(false);
                    return;
                }
            } catch (error) {
                console.error("Error checking rate limit:", error);
            }

            if (userLocation) {
                const newSpotData = {
                    lat: userLocation[1],
                    lng: userLocation[0],
                    type: 'free',
                    status: 'available',
                    finderId: user.id,
                    finderName: user.fullName || 'Anonymous',
                    reportedAt,
                    expiresAt,
                    geohash: geofire.geohashForLocation([userLocation[1], userLocation[0]])
                };
                setShowPingConfirmation(true);
                setTimeout(() => setShowPingConfirmation(false), 4000);
                onSaveSuccess();

                addDoc(collection(db, "spots"), newSpotData)
                    .catch(error => {
                        console.error("Optimistic save failed:", error);
                        alert("There was an error syncing your ping to the server.");
                    });
            } else {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const location: [number, number] = [position.coords.longitude, position.coords.latitude];
                        const geohash = geofire.geohashForLocation([location[1], location[0]]);

                        const newSpotData = {
                            lat: location[1],
                            lng: location[0],
                            type: 'free',
                            status: 'available',
                            finderId: user.id,
                            finderName: user.fullName || 'Anonymous',
                            reportedAt,
                            expiresAt,
                            geohash
                        };
                        setShowPingConfirmation(true);
                        setTimeout(() => setShowPingConfirmation(false), 4000);
                        onSaveSuccess();

                        addDoc(collection(db, "spots"), newSpotData)
                            .catch(error => {
                                console.error("Optimistic save failed:", error);
                                alert("There was an error syncing your ping to the server.");
                            });
                    },
                    (error) => {
                        console.error("Error getting position for ping:", error);
                        alert("Could not get your location. Please ensure location services are enabled.");
                        setIsPinging(false);
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
                );
            }
        }
    };

    const handleDeletePing = async () => {
        const spotToDelete = selectedItem || (spotData.activeSpots.length > 0 ? spotData.activeSpots[0] : null);
        if (!user || !spotToDelete) return;
        if (user.id !== spotToDelete.finderId) return;

        const ok = window.confirm("Delete this ping? This can't be undone.");
        if (!ok) return;

        try {
            await deleteDoc(doc(db, "spots", spotToDelete.id));
            setSelectedItem(null);
        } catch (e) {
            console.error("Error deleting ping:", e);
        }
    };

    const handleClaimSpot = async () => {
        const spotToClaim = selectedItem || (spotData.activeSpots.length > 0 ? spotData.activeSpots[0] : null);
        if (!user || !spotToClaim) return;
        try {
            await updateDoc(doc(db, "spots", spotToClaim.id), {
                status: 'claimed',
                claimedBy: user.id
            });
            if (selectedItem) {
                setSelectedItem({ ...selectedItem, status: 'claimed', claimedBy: user.id });
            }
        } catch (e) {
            console.error("Error claiming spot:", e);
            alert("Failed to claim spot.");
        }
    };

    const handleClaimSpotClick = () => {
        const spot = selectedItem || (spotData.freeSpots.length > 0 ? spotData.freeSpots[0] : null);
        if (!spot) return;
        if (spot.type === 'free') {
            holdFlow.setIsHoldModalOpen(true);
        } else {
            handleClaimSpot();
        }
    };

    return (
        <div className="sp-page">
            <SpotModal
                isOpen={isSpotModalOpen}
                onClose={() => {
                    setSpotModalOpen(false);
                    setSelectedItem(null);
                }}
                onSave={handleSaveSpot}
                spot={selectedItem}
                spotAddress={spotAddress}
            />

            {holdFlow.isHoldModalOpen && (
                <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#1c1c1e] rounded-3xl p-6 w-full max-w-sm text-white border border-white/10 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-extrabold text-sm flex items-center gap-1.5 text-amber-500">
                                <Wallet size={16} />
                                <span>Escrow Hold Request</span>
                            </h3>
                            <button onClick={() => holdFlow.setIsHoldModalOpen(false)}>
                                <X size={18} className="text-gray-400 hover:text-white" />
                            </button>
                        </div>
                        <p className="text-xs text-white/85 leading-relaxed">
                            To reserve this spot, a <strong>$2.00 escrow hold</strong> will be placed. The owner will be asked to hold the spot for you.
                        </p>
                        <ul className="text-[10px] text-gray-400 space-y-1">
                            <li>• If accepted, navigation starts with a 5-minute arrival timer.</li>
                            <li>• If declined or expired, your $2.00 is fully refunded.</li>
                            <li>• Upon arrival, payment is released to the finder.</li>
                        </ul>
                        <button
                            onClick={holdFlow.handleSendHoldRequest}
                            className="w-full bg-amber-600 hover:bg-amber-500 font-extrabold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/10 text-white"
                        >
                            Pay & Request Hold ($2.00)
                        </button>
                    </div>
                </div>
            )}

            {(() => {
                const pendingIncomingHold = spotData.freeSpots.find(s => s.finderId === user?.id && s.holdRequestStatus === 'pending');
                if (!pendingIncomingHold) return null;
                return (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] z-50 bg-[#07162c]/95 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl text-white pointer-events-auto flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-blue-400">
                            <Bell size={16} className="animate-bounce" />
                            <span className="text-xs font-bold uppercase tracking-wider">Someone wants this spot!</span>
                        </div>
                        <p className="text-[11px] text-white/85 leading-relaxed">
                            <strong>{pendingIncomingHold.holdRequestedByName || 'Someone'}</strong> wants to reserve your spot at <strong>{pendingIncomingHold.title}</strong> for a <strong>$2.00 escrow hold</strong>.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); holdFlow.handleAcceptHold(pendingIncomingHold); }}
                                className="flex-1 bg-green-600 hover:bg-green-500 font-bold py-1.5 rounded-xl text-xs transition-colors text-white"
                            >
                                Accept & Hold ($2)
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); holdFlow.handleDeclineHold(pendingIncomingHold); }}
                                className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 font-bold py-1.5 rounded-xl text-xs transition-colors text-white"
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                );
            })()}

            {holdFlow.finderSuccessNotification && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] z-50 bg-green-600 border border-green-500 text-white rounded-2xl p-4 shadow-2xl pointer-events-auto flex items-center gap-3">
                    <Check size={20} className="shrink-0" />
                    <div className="text-xs font-semibold">{holdFlow.finderSuccessNotification}</div>
                </div>
            )}

            {selectedItem?.holdRequestedBy === user?.id && selectedItem?.holdRequestStatus === 'declined' && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] z-50 bg-red-600 border border-red-500 text-white rounded-2xl p-4 shadow-2xl pointer-events-auto flex justify-between items-center gap-3">
                    <div className="flex items-center gap-2">
                        <X size={18} />
                        <span className="text-xs font-semibold">Hold request declined. Escrow of $2.00 was refunded.</span>
                    </div>
                    <button onClick={async (e) => {
                        e.stopPropagation();
                        if (!db) return;
                        try {
                            const spotRef = doc(db, "spots", selectedItem.id);
                            await updateDoc(spotRef, {
                                holdRequestStatus: null,
                                holdRequestedBy: null,
                                holdRequestedByName: null,
                                status: 'available',
                                claimedBy: null
                            });
                            setSelectedItem((prev: any) => ({
                                ...prev,
                                holdRequestStatus: null,
                                holdRequestedBy: null,
                                holdRequestedByName: null,
                                status: 'available',
                                claimedBy: null
                            }));
                        } catch (e) {
                            console.warn(e);
                        }
                    }} className="text-white hover:text-white/80">
                        <X size={16} />
                    </button>
                </div>
            )}

            <div ref={mapContainerRef} className="sp-map" onClick={() => setSelectedItem(null)} />

            <div className="map-blue-tint-color" />
            <div className="map-blue-tint-overlay" />
            <div className="map-blue-tint-soft" />

            {showPingConfirmation && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-[#07162c]/95 backdrop-blur-xl border border-emerald-500/30 text-white font-semibold py-3 px-5 rounded-2xl flex items-center gap-2.5 shadow-2xl">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"><Check size={14} className="text-emerald-400" /></div>
                    <span className="text-sm">Spot pinged! Nearby drivers will be notified</span>
                </div>
            )}

            <div className="sp-overlay flex flex-col justify-between p-3 pointer-events-none">
                <HeaderBar
                    user={user}
                    setView={setView}
                    inputRef={search.inputRef}
                    searchQuery={search.searchQuery}
                    setSearchQuery={search.setSearchQuery}
                    searchOpen={search.searchOpen}
                    setSearchOpen={search.setSearchOpen}
                    results={search.results}
                    setResults={search.setResults}
                    loading={search.loading}
                    handleCancelSearch={search.handleCancelSearch}
                    unreadMessagesCount={unreadMessagesCount}
                    pendingUpdatesCount={spotData.pendingUpdatesCount}
                    setPendingUpdatesCount={spotData.setPendingUpdatesCount}
                    mapRef={mapRef}
                />

                {spotCount > 0 && (
                    <div className="w-full max-w-[380px] mx-auto mt-1 pointer-events-auto">
                        <div className="inline-flex items-center gap-1.5 bg-[#07162c]/85 backdrop-blur-xl border border-emerald-500/20 rounded-full px-2.5 py-1 text-[10px] font-semibold text-emerald-400 shadow-md">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {spotCount} free spot{spotCount !== 1 ? 's' : ''} nearby
                        </div>
                    </div>
                )}

                {spotCount === 0 && !emptyCardDismissed && (
                    <div className="absolute top-28 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[280px]">
                        <div className="bg-[#07162c]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl text-center relative">
                            <button onClick={() => setEmptyCardDismissed(true)} className="absolute top-3 right-3 text-white/40 hover:text-white/70 transition-colors">
                                <X size={14} />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-[#1e75ff]/15 flex items-center justify-center mx-auto mb-3">
                                <MapPin size={18} className="text-[#1e75ff]" />
                            </div>
                            <h3 className="text-sm font-bold text-white">No spots reported yet</h3>
                            <p className="text-[11px] text-white/50 mt-1">Be the first to help your neighbors find parking here</p>
                        </div>
                    </div>
                )}

                <div className="w-full flex flex-col gap-2 pointer-events-auto mt-auto pb-16 px-4">
                    <div className="flex justify-end max-w-[380px] mx-auto w-full mb-2">
                        <button
                            onClick={handleLocateMe}
                            className="w-10 h-10 rounded-full glass-button flex items-center justify-center shadow-lg transition-transform active:scale-90"
                            title="Locate Me"
                        >
                            <Locate size={18} className="text-[#1e75ff]" />
                        </button>
                    </div>
                    <SpotDetailsCard
                        selectedItem={selectedItem}
                        freeSpots={spotData.freeSpots}
                        user={user}
                        userLocation={userLocation}
                        spotAddress={spotAddress}
                        trackedItemId={holdFlow.trackedItemId}
                        holdTimeRemaining={holdFlow.holdTimeRemaining}
                        onTrackLocation={holdFlow.handleTrackLocation}
                        onClaimSpotClick={handleClaimSpotClick}
                        onEditSpot={(spot) => {
                            setSelectedItem(spot);
                            setSpotModalOpen(true);
                        }}
                        onDeletePing={handleDeletePing}
                        onArrivalRelease={holdFlow.handleArrivalRelease}
                        onMessageUser={onMessageUser}
                    />

                    {nearestSpot && !selectedItem && (
                        <button
                            onClick={() => setSelectedItem(nearestSpot.spot)}
                            className="w-full max-w-[380px] mx-auto bg-[#07162c]/90 backdrop-blur-xl border border-white/10 rounded-2xl px-3.5 py-2.5 flex items-center gap-3 shadow-lg"
                        >
                            <div className="w-8 h-8 rounded-xl bg-[#1e75ff]/15 flex items-center justify-center shrink-0">
                                <MapPin size={14} className="text-[#1e75ff]" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <div className="text-[11px] font-bold text-white truncate">Nearest spot · {nearestSpot.distText}</div>
                                {nearestSpot.timeAgo && (
                                    <div className="text-[10px] text-white/40 flex items-center gap-1 mt-0.5">
                                        <Clock size={9} />
                                        Reported {nearestSpot.timeAgo}
                                    </div>
                                )}
                            </div>
                        </button>
                    )}

                    <button
                        onClick={() => {
                            setSelectedItem(null);
                            setSpotModalOpen(true);
                        }}
                        disabled={!user}
                        className="relative mx-auto h-[52px] rounded-full px-14 active:scale-95 text-white disabled:opacity-50 transition-transform duration-200 ping-glow"
                        style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)', minWidth: '250px' }}
                    >
                        <MapPin size={24} className="absolute left-9 top-1/2 -translate-y-1/2" />
                        <span className="text-[19px] font-bold absolute top-1/2 -translate-y-1/2 whitespace-nowrap" style={{ left: 'calc(50% + 12px)', transform: 'translate(-50%, -50%)' }}>Ping Parking</span>
                    </button>

                </div>
            </div>
        </div>
    );
};
