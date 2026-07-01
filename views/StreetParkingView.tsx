import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppView } from '../types';
import { MapPin, Check, Locate, X, Bell, Clock } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, doc, deleteDoc, writeBatch, updateDoc, getDocs, where, query } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import * as geofire from 'geofire-common';

import { MAPBOX_TOKEN, NYC_CENTER, createMarkerElement, clearRoute, drawRoute, getDistance } from './street-parking/utils';

const reverseGeocode = async (lng: number, lat: number): Promise<string> => {
    try {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address&limit=1&access_token=${MAPBOX_TOKEN}`);
        const json = await res.json();
        return json.features?.[0]?.place_name?.split(',')[0] || '';
    } catch { return ''; }
};
import { MapItem, MapViewProps } from './street-parking/types';
import { SpotModal } from './street-parking/SpotModal';
import { useSearch } from './street-parking/useSearch';
import { useUnreadMessages } from './street-parking/useUnreadMessages';
import { useSpotData } from './street-parking/useSpotData';
import { useInterestFlow } from './street-parking/useInterestFlow';
import { SpotDetailsCard } from './street-parking/SpotDetailsCard';
import { BottomSheet } from './street-parking/BottomSheet';
import { HandoffFlow } from './street-parking/HandoffFlow';
import { ParkingActivitySheet } from './street-parking/ParkingActivitySheet';
import { HeaderBar } from './street-parking/HeaderBar';


export const MapView: React.FC<MapViewProps> = ({ user, setView, onMessageUser }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const allMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const activeRouteDestinationRef = useRef<[number, number] | null>(null);

    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [searchCenter, setSearchCenter] = useState<[number, number] | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [searchRadius] = useState<number>(2000);

    const [showFree, setShowFree] = useState(true);
    const [showPaid, setShowPaid] = useState(false);
    const [showPublic, setShowPublic] = useState(false);


    const [isPinging, setIsPinging] = useState(false);
    const [showPingConfirmation, setShowPingConfirmation] = useState(false);
    const [isSpotModalOpen, setSpotModalOpen] = useState(false);
    const [spotAddress, setSpotAddress] = useState<string>("Loading address...");


    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);

    // --- Custom hooks ---

    const search = useSearch();
    const unreadMessagesCount = useUnreadMessages(user?.id);

    const spotData = useSpotData({
        userId: user?.id,
        blockedUsers: user?.blockedUsers,
        searchCenter: searchCenter || NYC_CENTER,
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

    const otherSpots = spotData.radiusFilteredItems.filter(s => s.finderId !== user?.id);
    const spotCount = otherSpots.length;

    const nearestSpot = useMemo(() => {
        if (!userLocation || spotData.freeSpots.length === 0) return null;
        let closest: any = null;
        let minDist = Infinity;
        spotData.freeSpots.filter(s => s.finderId !== user?.id).forEach(s => {
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
        if (!interestFlow.handoffStep) {
            setSelectedItem(null);
        }
    }, [spotData.freeSpots, spotData.paidListings, selectedItem?.id]);

    // Get initial GPS fix, then create map centered on real location
    useEffect(() => {
        if (!mapContainerRef.current) return;
        if (!MAPBOX_TOKEN) {
            console.error("VITE_MAPBOX_TOKEN is not set");
        } else {
            mapboxgl.accessToken = MAPBOX_TOKEN;
        }

        let cancelled = false;
        let watchId: number | undefined;

        const initMap = (center: [number, number]) => {
            if (cancelled || mapRef.current) return;
            const isDark = document.documentElement.classList.contains('dark');
            const map = new mapboxgl.Map({ container: mapContainerRef.current!, style: `mapbox://styles/mapbox/${isDark ? 'dark' : 'light'}-v11`, center, zoom: 16, attributionControl: false, interactive: true });
            mapRef.current = map;
            setSearchCenter(center);
            setMapReady(true);

            map.on('load', () => { map.resize(); });

            let moveEndTimeout: ReturnType<typeof setTimeout> | undefined;
            map.on('moveend', () => {
                if (moveEndTimeout) clearTimeout(moveEndTimeout);
                moveEndTimeout = setTimeout(() => {
                    const c = map.getCenter();
                    setSearchCenter([c.lng, c.lat]);
                }, 400);
            });
        };

        // Try to get location first, fall back to NYC after 5s
        const fallbackTimer = setTimeout(() => {
            if (!mapRef.current) initMap(NYC_CENTER);
        }, 5000);

        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { longitude, latitude } = position.coords;
                    const newLocation: [number, number] = [longitude, latitude];
                    setUserLocation(newLocation);

                    if (!mapRef.current) {
                        clearTimeout(fallbackTimer);
                        initMap(newLocation);
                    } else {
                        if (activeRouteDestinationRef.current) {
                            drawRoute(mapRef.current, newLocation, activeRouteDestinationRef.current);
                        }
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
                },
                () => {
                    clearTimeout(fallbackTimer);
                    if (!mapRef.current) initMap(NYC_CENTER);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            clearTimeout(fallbackTimer);
            initMap(NYC_CENTER);
        }

        return () => {
            cancelled = true;
            clearTimeout(fallbackTimer);
            if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
            if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
        };
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
                    finderName: user.username || user.fullName || 'Anonymous',
                    pingMode: departureTime ? 'later' : 'now',
                    reportedAt,
                    expiresAt,
                    address: await reverseGeocode(selectedItem.lng, selectedItem.lat),
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
                    finderName: user.username || user.fullName || 'Anonymous',
                    pingMode: departureTime ? 'later' : 'now',
                    reportedAt,
                    expiresAt,
                    geohash: geofire.geohashForLocation([userLocation[1], userLocation[0]]),
                    address: await reverseGeocode(userLocation[0], userLocation[1]),
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
                    async (position) => {
                        const location: [number, number] = [position.coords.longitude, position.coords.latitude];
                        const geohash = geofire.geohashForLocation([location[1], location[0]]);

                        const newSpotData = {
                            lat: location[1],
                            lng: location[0],
                            type: 'free',
                            status: 'available',
                            finderId: user.id,
                            finderName: user.username || user.fullName || 'Anonymous',
                            pingMode: departureTime ? 'later' : 'now',
                            reportedAt,
                            expiresAt,
                            geohash,
                            address: await reverseGeocode(location[0], location[1]),
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

            {/* Spot details bottom sheet */}
            <BottomSheet isOpen={!!selectedItem && !isSpotModalOpen} onClose={() => setSelectedItem(null)}>
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
            </BottomSheet>

            {/* ETA picker */}
            <BottomSheet isOpen={interestFlow.isEtaPickerOpen} onClose={() => interestFlow.setIsEtaPickerOpen(false)}>
                <h3 className="font-bold text-[var(--color-text)] text-center mb-4">How soon can you get there?</h3>
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
            </BottomSheet>

            {/* Post-arrival handoff flow */}
            <BottomSheet isOpen={interestFlow.handoffStep !== null} onClose={interestFlow.handleSkipDeparture}>
                {interestFlow.handoffStep && (
                    <HandoffFlow
                        step={interestFlow.handoffStep}
                        onOutcome={interestFlow.handleHandoffOutcome}
                        onFailureReason={interestFlow.handleFailureReason}
                        onDeparturePing={interestFlow.handleDeparturePing}
                        onSkip={interestFlow.handleSkipDeparture}
                    />
                )}
            </BottomSheet>

            {/* Parking Activity Explorer */}
            {search.selectedDestination && (
                <ParkingActivitySheet
                    destination={search.selectedDestination}
                    onExplore={() => {
                        const dest = search.selectedDestination!;
                        mapRef.current?.easeTo({
                            center: dest.center,
                            zoom: 14,
                            duration: 800,
                        });
                        search.clearDestination();
                    }}
                    onDismiss={search.clearDestination}
                />
            )}

            {/* Finder notification: someone is heading to their spot */}
            {(() => {
                const interestedSpot = spotData.freeSpots.find(s => s.finderId === user?.id && s.status === 'interested');
                if (!interestedSpot || selectedItem?.id === interestedSpot.id) return null;
                return (
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] z-50 backdrop-blur-xl rounded-2xl shadow-2xl pointer-events-auto overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, rgba(30,117,255,0.18), rgba(29,158,117,0.12))', border: '1px solid rgba(30,117,255,0.35)' }}>
                        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #1e75ff, #1D9E75)' }}>
                                <Bell size={18} className="text-white animate-bounce" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-extrabold text-white uppercase tracking-wider">Someone is heading there!</p>
                                <p className="text-[11px] text-white/70 mt-0.5 truncate">
                                    <strong className="text-white/90">{interestedSpot.interestedUserName || 'Someone'}</strong> · ETA ~{interestedSpot.etaMinutes} min
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedItem(interestedSpot)}
                            className="w-full py-2.5 text-xs font-bold text-white/90 hover:text-white border-t transition-colors"
                            style={{ borderColor: 'rgba(30,117,255,0.25)', background: 'rgba(30,117,255,0.15)' }}>
                            View Spot Details →
                        </button>
                    </div>
                );
            })()}

            <div ref={mapContainerRef} className="sp-map" onClick={() => setSelectedItem(null)} />

            {!mapReady && (
                <div className="absolute inset-0 z-20 bg-[var(--color-bg)] flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                </div>
            )}

            <div className="map-blue-tint-color" />
            <div className="map-blue-tint-overlay" />
            <div className="map-blue-tint-soft" />

            {showPingConfirmation && (
                <div className="absolute inset-0 z-50 flex items-start justify-center pt-28 pointer-events-none">
                    <div className="ping-celebration flex flex-col items-center gap-5">
                        <div className="relative flex items-center justify-center">
                            <div className="ping-ring" />
                            <div className="ping-ring ping-ring-2" />
                            <div className="ping-ring ping-ring-3" />
                            <img
                                src="/Parqueen_Logo.png"
                                alt="ParkQueen"
                                className="ping-logo-drop relative z-10 w-20 h-20 object-contain drop-shadow-2xl"
                            />
                        </div>
                        <div className="ping-text-fade text-center">
                            <p className="text-2xl font-extrabold text-white tracking-tight drop-shadow-lg">Spot Pinged!</p>
                            <p className="text-sm text-white/70 mt-1 font-medium">Nearby drivers will be notified</p>
                        </div>
                    </div>
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
                    onSelectResult={search.handleSelectResult}
                />

                {!search.searchOpen && (
                    <div className="w-full max-w-[380px] mx-auto mt-1 pointer-events-auto">
                        {spotCount > 0 ? (
                            <div className="inline-flex items-center gap-1.5 bg-[var(--color-card)] backdrop-blur-xl border border-emerald-500/20 rounded-full px-2.5 py-1 text-[10px] font-semibold text-emerald-400 shadow-md">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {spotCount} free spot{spotCount !== 1 ? 's' : ''} nearby
                            </div>
                        ) : mapReady && spotData.activeSpots.length === 0 && (
                            <div className="bg-[var(--color-card)] backdrop-blur-xl border border-[var(--color-border)] rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-[#1e75ff]/15 border border-[#1e75ff]/25 flex items-center justify-center shrink-0">
                                    <MapPin size={15} className="text-[#38bdf8]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-[var(--color-text)]">No spots pinged nearby</p>
                                    <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">Leaving soon? Be the first to ping one!</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}


                <div className="w-full flex flex-col gap-2 pointer-events-auto mt-auto pb-16 px-4">
                    <div className="flex justify-end max-w-[380px] mx-auto w-full mb-2">
                        <button
                            onClick={handleLocateMe}
                            className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 bg-[var(--color-card)] backdrop-blur-xl border border-[#1e75ff]/40 hover:border-[#1e75ff]/70 hover:bg-[#1e75ff]/10"
                            title="Locate Me"
                        >
                            <Locate size={18} className="text-[#1e75ff]" />
                        </button>
                    </div>

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

                    {(() => {
                        const myPing = spotData.activeSpots[0];
                        const hasActivePing = !!myPing;
                        return (
                            <button
                                onClick={() => {
                                    if (hasActivePing) {
                                        setSelectedItem(myPing);
                                    } else {
                                        setSelectedItem(null);
                                        setSpotModalOpen(true);
                                    }
                                }}
                                disabled={!user}
                                className="relative mx-auto h-[52px] rounded-full px-14 active:scale-95 text-white disabled:opacity-50 transition-transform duration-200 ping-glow"
                                style={{ background: hasActivePing ? 'linear-gradient(90deg, #1e75ff, #0ea5e9)' : 'linear-gradient(90deg, #378ADD, #1D9E75)', minWidth: '250px' }}
                            >
                                <MapPin size={24} className="absolute left-9 top-1/2 -translate-y-1/2" />
                                <span className="text-[19px] font-bold absolute top-1/2 -translate-y-1/2 whitespace-nowrap" style={{ left: 'calc(50% + 12px)', transform: 'translate(-50%, -50%)' }}>
                                    {hasActivePing ? 'My Active Ping' : 'Ping Parking'}
                                </span>
                            </button>
                        );
                    })()}

                </div>
            </div>
        </div>
    );
};
