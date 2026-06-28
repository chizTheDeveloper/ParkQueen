import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppView } from '../types';
import { MapPin, Check, Locate, X, Bell, Clock } from 'lucide-react';
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
import { useInterestFlow } from './street-parking/useInterestFlow';
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

    const itemsRef = useRef<MapItem[]>([]);
    itemsRef.current = spotData.radiusFilteredItems;

    const interestFlow = useInterestFlow({
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
                updatedFree.interestedUserId !== selectedItem.interestedUserId) {
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
        // Spot no longer in any data source (occupied/expired/deleted) — clear selection
        if (!interestFlow.showFeedback) {
            setSelectedItem(null);
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
        const isDark = document.documentElement.classList.contains('dark');
        const map = new mapboxgl.Map({ container: mapContainerRef.current, style: `mapbox://styles/mapbox/${isDark ? 'dark' : 'light'}-v11`, center: NYC_CENTER, zoom: 14, attributionControl: false, interactive: true });
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
            const reportedMs = item.reportedAt ? (typeof item.reportedAt.toMillis === 'function' ? item.reportedAt.toMillis() : typeof item.reportedAt.seconds === 'number' ? item.reportedAt.seconds * 1000 : 0) : 0;
            const isScheduled = reportedMs > Date.now() + 60_000;

            if (currentMarkers[item.id]) {
                const existing = currentMarkers[item.id].getElement();
                const wasScheduled = existing.dataset.scheduled === 'true';
                if (wasScheduled !== isScheduled) {
                    currentMarkers[item.id].remove();
                    delete currentMarkers[item.id];
                } else {
                    const cur = currentMarkers[item.id].getLngLat();
                    if (cur.lng !== item.lng || cur.lat !== item.lat) {
                        currentMarkers[item.id].setLngLat(lngLat);
                    }
                    return;
                }
            }

            const el = createMarkerElement(isScheduled);
            const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
                .setLngLat(lngLat)
                .addTo(map);

            marker.getElement().addEventListener('click', (e) => {
                e.stopPropagation();
                const fresh = itemsRef.current.find(i => i.id === item.id) || item;
                setSelectedItem(fresh);
                map.flyTo({ center: lngLat, zoom: 16 });
            });

            currentMarkers[item.id] = marker;
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
            el.innerHTML = `<div class="relative flex items-center justify-center"><div class="absolute w-10 h-10 bg-blue-500/20 rounded-full animate-ping"></div><div class="absolute w-6 h-6 bg-blue-500/15 rounded-full animate-pulse"></div><div class="w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white shadow-md"></div></div>`;
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

        if (!selectedItem) {
            const activeQ = query(collection(db, 'spots'), where('finderId', '==', user.id), where('status', 'in', ['available', 'interested']));
            const activeSnap = await getDocs(activeQ);
            if (!activeSnap.empty) {
                alert('You already have an active ping. Cancel or wait for it to be taken before creating a new one.');
                return;
            }
        }

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
                    pingMode: departureTime ? 'later' : 'now',
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
                    pingMode: departureTime ? 'later' : 'now',
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
                            pingMode: departureTime ? 'later' : 'now',
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

            {/* ETA picker modal */}
            {interestFlow.isEtaPickerOpen && (
                <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[var(--color-glass)] backdrop-blur-xl rounded-3xl p-6 w-full max-w-sm text-[var(--color-text)] border border-[var(--color-border)] shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-sm">How soon can you get there?</h3>
                            <button onClick={() => interestFlow.setIsEtaPickerOpen(false)}>
                                <X size={18} className="text-[var(--color-text-secondary)]" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {interestFlow.ETA_OPTIONS.map(min => (
                                <button key={min} onClick={() => interestFlow.handleExpressInterest(min)}
                                    className="py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 text-white"
                                    style={{ background: 'linear-gradient(90deg, #378ADD, #1D9E75)' }}>
                                    {min} min
                                </button>
                            ))}
                        </div>
                        {interestFlow.interestError && (
                            <p className="text-red-400 text-xs mt-3 text-center">{interestFlow.interestError}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Post-arrival feedback */}
            {interestFlow.showFeedback && (
                <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[var(--color-glass)] backdrop-blur-xl rounded-3xl p-6 w-full max-w-sm text-[var(--color-text)] border border-[var(--color-border)] shadow-2xl text-center">
                        <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
                            <Check size={24} className="text-green-400" />
                        </div>
                        <h3 className="font-bold text-lg mb-1">You've arrived!</h3>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-4">How was the experience?</p>
                        <div className="space-y-2">
                            {['Thank the driver', 'Spot wasn\'t available', 'Other'].map(opt => (
                                <button key={opt} onClick={() => interestFlow.handleFeedback(opt)}
                                    className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-[var(--color-border)] hover:bg-white/10 transition-all">
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Finder notification: someone is heading to their spot */}
            {(() => {
                const interestedSpot = spotData.freeSpots.find(s => s.finderId === user?.id && s.status === 'interested');
                if (!interestedSpot || selectedItem?.id === interestedSpot.id) return null;
                return (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] z-50 bg-[var(--color-glass)] border border-[var(--color-border)] backdrop-blur-xl rounded-2xl p-4 shadow-2xl text-[var(--color-text)] pointer-events-auto flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-blue-400">
                            <Bell size={16} className="animate-bounce" />
                            <span className="text-xs font-bold uppercase tracking-wider">Someone is heading there!</span>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                            <strong>{interestedSpot.interestedUserName || 'Someone'}</strong> is heading to your spot at <strong>{interestedSpot.title}</strong>, ETA ~{interestedSpot.etaMinutes} min.
                        </p>
                        <button onClick={() => setSelectedItem(interestedSpot)}
                            className="w-full bg-[#1e75ff] hover:bg-blue-600 font-bold py-1.5 rounded-xl text-xs transition-colors text-white">
                            View
                        </button>
                    </div>
                );
            })()}

            <div ref={mapContainerRef} className="sp-map" onClick={() => setSelectedItem(null)} />

            <div className="map-blue-tint-color" />
            <div className="map-blue-tint-overlay" />
            <div className="map-blue-tint-soft" />

            {showPingConfirmation && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-[var(--color-glass)] backdrop-blur-xl border border-emerald-500/30 text-[var(--color-text)] font-semibold py-3 px-5 rounded-2xl flex items-center gap-2.5 shadow-2xl">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"><Check size={14} className="text-emerald-400" /></div>
                    <span className="text-sm">Spot pinged! Nearby drivers will be notified</span>
                </div>
            )}

            {interestFlow.finderToast && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-[var(--color-glass)] backdrop-blur-xl border border-blue-500/30 text-[var(--color-text)] font-semibold py-3 px-5 rounded-2xl flex items-center gap-2.5 shadow-2xl">
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0"><Check size={14} className="text-blue-400" /></div>
                    <span className="text-sm">{interestFlow.finderToast}</span>
                </div>
            )}

            {interestFlow.driverNotification && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-[var(--color-glass)] backdrop-blur-xl border border-amber-500/30 text-[var(--color-text)] font-semibold py-3 px-5 rounded-2xl flex items-center gap-2.5 shadow-2xl">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0"><Bell size={14} className="text-amber-400" /></div>
                    <span className="text-sm">{interestFlow.driverNotification}</span>
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
                        <div className="inline-flex items-center gap-1.5 bg-[var(--color-card)] backdrop-blur-xl border border-emerald-500/20 rounded-full px-2.5 py-1 text-[10px] font-semibold text-emerald-400 shadow-md">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {spotCount} free spot{spotCount !== 1 ? 's' : ''} nearby
                        </div>
                    </div>
                )}

                {spotCount === 0 && !emptyCardDismissed && (
                    <div className="absolute top-28 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-[280px]">
                        <div className="bg-[var(--color-glass)] backdrop-blur-xl border border-[var(--color-border)] rounded-3xl p-5 shadow-2xl text-center relative">
                            <button onClick={() => setEmptyCardDismissed(true)} className="absolute top-3 right-3 text-[var(--color-text-secondary)] hover:text-white/70 transition-colors">
                                <X size={14} />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-[#1e75ff]/15 flex items-center justify-center mx-auto mb-3">
                                <MapPin size={18} className="text-[#1e75ff]" />
                            </div>
                            <h3 className="text-sm font-bold text-[var(--color-text)]">No spots reported yet</h3>
                            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">Be the first to help your neighbors find parking here</p>
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
                        onHeadingThere={() => interestFlow.setIsEtaPickerOpen(true)}
                        onEditSpot={(spot) => { setSelectedItem(spot); setSpotModalOpen(true); }}
                        onDeletePing={handleDeletePing}
                        onArrival={interestFlow.handleArrival}
                        onCancelByFinder={interestFlow.handleCancelByFinder}
                        onCancelByClaimer={interestFlow.handleCancelByClaimer}
                        onMessageUser={onMessageUser}
                        interestError={interestFlow.interestError}
                        estDriveMinutes={selectedItem ? interestFlow.getEstDriveMinutes(selectedItem) : null}
                        isWithinArrivalRange={selectedItem ? interestFlow.isWithinArrivalRange(selectedItem) : false}
                        maxEtaMinutes={interestFlow.MAX_ETA_MINUTES}
                    />

                    {nearestSpot && !selectedItem && (
                        <button
                            onClick={() => setSelectedItem(nearestSpot.spot)}
                            className="w-full max-w-[380px] mx-auto bg-[var(--color-glass)] backdrop-blur-xl border border-[var(--color-border)] rounded-2xl px-3.5 py-2.5 flex items-center gap-3 shadow-lg"
                        >
                            <div className="w-8 h-8 rounded-xl bg-[#1e75ff]/15 flex items-center justify-center shrink-0">
                                <MapPin size={14} className="text-[#1e75ff]" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <div className="text-[11px] font-bold text-[var(--color-text)] truncate">Nearest spot · {nearestSpot.distText}</div>
                                {nearestSpot.timeAgo && (
                                    <div className="text-[10px] text-[var(--color-text-secondary)] flex items-center gap-1 mt-0.5">
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
