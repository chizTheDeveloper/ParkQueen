import React, { useState, useEffect, useRef } from 'react';
import { StreetSpot, AppView } from '../types';
import { MapPin, Check, Locate, ChevronUp, ChevronDown, List, Camera, MessageSquare, Bell, Clock, Calendar, X, Search, Menu, Star, Sliders, CloudSun, Navigation, Map, Wallet, User } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp, doc, deleteDoc, writeBatch, updateDoc, getDocs, where } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import * as geofire from 'geofire-common';
import parqueenLogo from '../assets/Parqueen_Logo.png';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const NYC_CENTER: [number, number] = [-73.9712, 40.7831];

const deg2rad = (deg: number) => deg * (Math.PI / 180);

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

const formatTimeLeft = (ms: number): string => {
    if (ms <= 0) {
        return "Expired";
    }
    const totalMinutes = Math.floor(ms / 60000);
    if (totalMinutes < 1) {
        return "< 1 minute";
    }
    if (totalMinutes < 60) {
        return `${totalMinutes} minutes`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) {
        return `${hours} hour${hours === 1 ? "" : "s"}`;
    }
    return `${hours} hour${hours === 1 ? "" : "s"} and ${minutes} minute${minutes === 1 ? "" : "s"}`;
};

const createMarkerElement = (type: 'free' | 'paid' | 'public', price?: string) => {
    const el = document.createElement('div');
    el.className = "flex flex-col items-center select-none";
    el.style.zIndex = '10';
    el.style.cursor = 'pointer';
    
    let color = '#1e75ff'; // Default Blue for Free
    if (type === 'paid') color = '#22c55e'; // Green for Paid
    if (type === 'public') color = '#a855f7'; // Purple for Public
    
    let pillHtml = '';
    if ((type === 'paid' || type === 'public') && price) {
        const textColorClass = type === 'paid' ? 'text-[#22c55e]' : 'text-[#a855f7]';
        const borderColorClass = type === 'paid' ? 'border-[#22c55e]/25' : 'border-[#a855f7]/25';
        pillHtml = `
            <div class="mt-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-[#07162c]/95 border ${borderColorClass} ${textColorClass} rounded-md shadow-lg backdrop-blur-sm whitespace-nowrap leading-none select-none pointer-events-none">
                ${price}
            </div>
        `;
    }
    
    el.innerHTML = `
        <div style="width: 32px; height: 32px; position: relative;" class="pointer-events-none">
          <svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.35));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#FFF" stroke-width="1.5"/>
            <text x="12" y="11" font-size="8.5" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" text-anchor="middle" fill="white">P</text>
          </svg>
        </div>
        ${pillHtml}
    `;
    return el;
};

const TimePicker: React.FC<{ initialTime: Date; onTimeChange: (time: Date) => void; }> = ({ initialTime, onTimeChange }) => {
    const [hour, setHour] = useState(initialTime.getHours() % 12 || 12);
    const [minute, setMinute] = useState(initialTime.getMinutes());
    const [amPm, setAmPm] = useState(initialTime.getHours() >= 12 ? 'PM' : 'AM');

    const updateTime = (h: number, m: number, ap: 'AM' | 'PM') => {
        const newDate = new Date(initialTime);
        let newHour = h;
        if (ap === 'PM' && newHour < 12) newHour += 12;
        if (ap === 'AM' && newHour === 12) newHour = 0;
        newDate.setHours(newHour, m, 0, 0);
        onTimeChange(newDate);
    };

    const incrementHour = () => setHour(h => (h % 12) + 1);
    const decrementHour = () => setHour(h => (h - 1 <= 0 ? 12 : h - 1));
    const incrementMinute = () => setMinute(m => (m + 1) % 60);
    const decrementMinute = () => setMinute(m => (m - 1 < 0 ? 59 : m - 1));

    useEffect(() => {
        updateTime(hour, minute, amPm);
    }, [hour, minute, amPm]);

    return (
        <div className="flex items-center justify-center space-x-2">
            <div className="flex flex-col items-center"><button onClick={incrementHour}><ChevronUp size={24} /></button><span className="text-4xl font-bold w-16 text-center">{hour.toString().padStart(2, '0')}</span><button onClick={decrementHour}><ChevronDown size={24} /></button></div>
            <span className="text-4xl font-bold">:</span>
            <div className="flex flex-col items-center"><button onClick={incrementMinute}><ChevronUp size={24} /></button><span className="text-4xl font-bold w-16 text-center">{minute.toString().padStart(2, '0')}</span><button onClick={decrementMinute}><ChevronDown size={24} /></button></div>
            <div className="flex flex-col space-y-2"><button onClick={() => setAmPm('AM')} className={`px-2 py-1 rounded ${amPm === 'AM' ? 'bg-blue-500' : 'bg-gray-600'}`}>AM</button><button onClick={() => setAmPm('PM')} className={`px-2 py-1 rounded ${amPm === 'PM' ? 'bg-blue-500' : 'bg-gray-600'}`}>PM</button></div>
        </div>
    );
};

const SpotModal: React.FC<{ isOpen: boolean; onClose: () => void; onSave: (departure: Date | null) => void; spot?: StreetSpot | null; }> = ({ isOpen, onClose, onSave, spot }) => {
    const [view, setView] = useState<'main' | 'timePicker'>('main');
    const [departureTime, setDepartureTime] = useState(new Date());
    const [pingType, setPingType] = useState<'now' | 'later'>('now');

    useEffect(() => {
        if (isOpen) {
            const hasToDate = spot && spot.reportedAt && typeof spot.reportedAt.toDate === 'function';
            const initialDate = hasToDate 
                ? spot.reportedAt.toDate() 
                : (spot && spot.reportedAt ? new Date(spot.reportedAt) : new Date(Date.now() + 2 * 60_000));
            setDepartureTime(initialDate);
            setPingType(initialDate.getTime() > Date.now() + 60_000 ? 'later' : 'now');
            setView('main');
        }
    }, [spot, isOpen]);

    const handleSetTime = () => {
        onSave(pingType === 'now' ? null : departureTime);
    };

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#1c1c1e] rounded-3xl p-6 w-full max-w-sm text-white border border-white/10">
                <div className="flex justify-end"><button onClick={onClose}><X size={20} className="text-gray-400" /></button></div>
                {view === 'main' ? (
                    <>
                        <div className="text-center">
                            <img src={parqueenLogo} alt="ParkQueen Logo" className="w-16 h-16 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold">{spot ? 'Edit Spot' : 'Ping spot'}</h2>
                            <p className="text-sm text-blue-400">BROADCASTING LIVE</p>
                        </div>
                        <div className="my-8 space-y-4">
                            <div onClick={() => setPingType('now')} className={`rounded-lg p-4 flex items-center gap-4 cursor-pointer ${pingType === 'now' ? 'bg-blue-500/30 border border-blue-400' : 'bg-gray-700/50 border border-gray-600'}`}>
                                <Clock size={24} />
                                <div><h3 className="font-bold">Leaving Now</h3><p className="text-xs text-gray-300">IMMEDIATE SPOT</p></div>
                            </div>
                            <div onClick={() => { setPingType('later'); setView('timePicker'); }} className={`rounded-lg p-4 flex items-center gap-4 cursor-pointer ${pingType === 'later' ? 'bg-blue-500/30 border border-blue-400' : 'bg-gray-700/50 border border-gray-600'}`}>
                                <Calendar size={24} />
                                <div><h3 className="font-bold">Later Today</h3><p className="text-xs text-gray-300">{pingType === 'later' ? departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'SCHEDULED SPOT'}</p></div>
                            </div>
                        </div>
                        <button onClick={handleSetTime} className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"><MapPin size={20} /><span>{spot ? 'UPDATE' : 'PING'}</span></button>
                    </>
                ) : (
                    <>
                        <div className="text-center"><Clock size={24} className="mx-auto text-blue-400 mb-2" /><h2 className="text-2xl font-bold">Time Picker</h2><p className="text-sm text-gray-400">LATER DEPARTURE</p></div>
                        <div className="my-8"><TimePicker initialTime={departureTime} onTimeChange={setDepartureTime} /></div>
                        <button onClick={() => { setPingType('later'); setView('main'); }} className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg">Set Time</button>
                        <button onClick={() => setView('main')} className="w-full text-center mt-2 text-gray-400 text-sm">CANCEL</button>
                    </>
                )}
            </div>
        </div>
    );
};

interface MapItem {
    id: string;
    lat: number;
    lng: number;
    type: 'free' | 'paid' | 'public';
    status: 'available' | 'claimed' | 'occupied';
    title: string;
    pricePerHour?: number;
    description?: string;
    reportedAt?: any;
    expiresAt?: any;
    finderId?: string;
    finderName?: string;
    claimedBy?: string | null;
    rawSpot?: any;
}

interface MapViewProps {
    user: any;
    setView: (view: AppView) => void;
    onMessageUser: (userId: string, context: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({ user, setView, onMessageUser }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const spotMarkersRef = useRef<Record<string, { marker: mapboxgl.Marker; timerId: number | undefined }>>({});
    const allMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
    
    // Filtering and Category states
    const [freeSpots, setFreeSpots] = useState<MapItem[]>([]);
    const [paidListings, setPaidListings] = useState<MapItem[]>([]);
    const [publicGarages, setPublicGarages] = useState<MapItem[]>([]);
    
    const [showFree, setShowFree] = useState(true);
    const [showPaid, setShowPaid] = useState(true);
    const [showPublic, setShowPublic] = useState(true);
    const [showLegend, setShowLegend] = useState(true);
    const [trackedItemId, setTrackedItemId] = useState<string | null>(null);
    const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
    const [holdTimeRemaining, setHoldTimeRemaining] = useState<number | null>(null);
    const [lastCompletedHoldId, setLastCompletedHoldId] = useState<string | null>(null);
    const [finderSuccessNotification, setFinderSuccessNotification] = useState<string | null>(null);
    const [isPinging, setIsPinging] = useState(false);
    const [showPingConfirmation, setShowPingConfirmation] = useState(false);
    const [isSpotModalOpen, setSpotModalOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const activeRouteDestinationRef = useRef<[number, number] | null>(null);

    const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);

    // Dynamic Google Maps Script Loader
    useEffect(() => {
        const googleObj = (window as any).google;
        if (googleObj && googleObj.maps && googleObj.maps.places) {
            setGoogleMapsLoaded(true);
            return;
        }

        const existingScript = document.getElementById('google-maps-script');
        if (existingScript) {
            const checkLoaded = setInterval(() => {
                const gObj = (window as any).google;
                if (gObj && gObj.maps && gObj.maps.places) {
                    setGoogleMapsLoaded(true);
                    clearInterval(checkLoaded);
                }
            }, 100);
            return;
        }

        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyCKSqWVd6JqpcrNUG6hei8Ug1njaIkAI7Y&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
            setGoogleMapsLoaded(true);
        };
        script.onerror = (e) => {
            console.error("Failed to load Google Maps script", e);
        };
        document.head.appendChild(script);
    }, []);

    const resizeMap = () => mapRef.current?.resize();

    const [activeSpots, setActiveSpots] = useState<any[]>([]);
    const [spotAddress, setSpotAddress] = useState<string>("Loading address...");
    const [activeFilterTab, setActiveFilterTab] = useState<string>("nearest");
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [pendingUpdatesCount, setPendingUpdatesCount] = useState(() => {
        const stored = localStorage.getItem('pendingUpdatesCount');
        return stored ? parseInt(stored, 10) : 3;
    });

    useEffect(() => {
        if (!user || !db) return;
        const q = query(
            collection(db, "chats"),
            where("participants", "array-contains", user.id)
        );
        const unsubscribe = onSnapshot(q, (snap) => {
            let count = 0;
            snap.docs.forEach(docSnap => {
                const data = docSnap.data();
                const chatId = docSnap.id;
                
                let timestampMillis = 0;
                if (data.lastMessageTimestamp) {
                    if (typeof data.lastMessageTimestamp.toMillis === 'function') {
                        timestampMillis = data.lastMessageTimestamp.toMillis();
                    } else if (typeof data.lastMessageTimestamp.toDate === 'function') {
                        timestampMillis = data.lastMessageTimestamp.toDate().getTime();
                    } else {
                        timestampMillis = new Date(data.lastMessageTimestamp).getTime();
                    }
                }
                
                const lastReadStr = localStorage.getItem(`lastReadChat_${chatId}`);
                const lastReadTime = lastReadStr ? parseInt(lastReadStr, 10) : 0;
                
                if (timestampMillis > lastReadTime && data.lastSenderId !== user.id) {
                    count++;
                }
            });
            setUnreadMessagesCount(count);
        }, (err) => {
            console.warn("Chats snapshot listener error:", err);
        });
        return () => unsubscribe();
    }, [user?.id]);

    const clearRoute = () => {
        if (!mapRef.current) return;
        const map = mapRef.current;
        if (map.getLayer('route')) {
            map.removeLayer('route');
        }
        if (map.getSource('route')) {
            map.removeSource('route');
        }
    };

    const drawRoute = async (start: [number, number], end: [number, number]) => {
        if (!mapRef.current || !MAPBOX_TOKEN) return;
        const map = mapRef.current;
        if (!map.isStyleLoaded()) return;

        try {
            const response = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${MAPBOX_TOKEN}`
            );
            const data = await response.json();
            if (!data.routes || data.routes.length === 0) return;

            const route = data.routes[0].geometry;

            if (map.getSource('route')) {
                const source = map.getSource('route') as mapboxgl.GeoJSONSource;
                source.setData({
                    type: 'Feature',
                    properties: {},
                    geometry: route
                });
            } else {
                map.addSource('route', {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: route
                    }
                });

                map.addLayer({
                    id: 'route',
                    type: 'line',
                    source: 'route',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#3B82F6',
                        'line-width': 6,
                        'line-opacity': 0.85
                    }
                });
            }

            const coordinates = route.coordinates;
            if (coordinates.length > 0) {
                const bounds = new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]);
                for (const coord of coordinates) {
                    bounds.extend(coord);
                }
                map.fitBounds(bounds, {
                    padding: { top: 80, bottom: 280, left: 50, right: 50 },
                    duration: 1000
                });
            }
        } catch (error) {
            console.error("Error drawing route:", error);
        }
    };

    useEffect(() => {
        if (!selectedItem) {
            activeRouteDestinationRef.current = null;
            clearRoute();
        }
    }, [selectedItem]);

    // Reactive sync selectedItem from live Firestore updates
    useEffect(() => {
        if (!selectedItem) return;
        const updatedFree = freeSpots.find(s => s.id === selectedItem.id);
        if (updatedFree) {
            if (updatedFree.status !== selectedItem.status || 
                updatedFree.holdRequestStatus !== selectedItem.holdRequestStatus || 
                updatedFree.claimedBy !== selectedItem.claimedBy) {
                setSelectedItem(updatedFree);
            }
            return;
        }
        const updatedPaid = paidListings.find(s => s.id === selectedItem.id);
        if (updatedPaid) {
            if (updatedPaid.status !== selectedItem.status) {
                setSelectedItem(updatedPaid);
            }
            return;
        }
    }, [freeSpots, paidListings, selectedItem?.id]);

    // Simulation Auto-Responder: if claimant is testing alone, auto-accept hold request after 3s
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

    // Claimant automatically triggers navigation when hold request is accepted
    useEffect(() => {
        if (!selectedItem || !user) return;
        if (selectedItem.holdRequestedBy === user.id && 
            selectedItem.holdRequestStatus === 'accepted' && 
            trackedItemId !== selectedItem.id) {
            setTrackedItemId(selectedItem.id);
            const startLoc = userLocation || NYC_CENTER;
            const dest: [number, number] = [selectedItem.lng, selectedItem.lat];
            activeRouteDestinationRef.current = dest;
            drawRoute(startLoc, dest);
        }
    }, [selectedItem?.holdRequestStatus, selectedItem?.id, userLocation]);

    // Claimant hold request countdown timer
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
                // Expire the hold request in Firestore
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

    // Finder wallet payout success banner listener
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
            setSelectedItem(prev => ({
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
            setSelectedItem(prev => ({
                ...prev,
                holdRequestStatus: 'completed',
                status: 'occupied'
            }));
            alert(`Escrow released successfully! $2.00 has been transferred to ${spot.finderName}.`);
        } catch (e) {
            console.error("Error releasing hold escrow:", e);
        }
    };

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;
        if (!MAPBOX_TOKEN) {
            console.error("VITE_MAPBOX_TOKEN is not set");
        } else {
            mapboxgl.accessToken = MAPBOX_TOKEN;
        }
        const map = new mapboxgl.Map({ container: mapContainerRef.current, style: 'mapbox://styles/mapbox/dark-v11', center: NYC_CENTER, zoom: 14, attributionControl: false, interactive: true });
        mapRef.current = map;

        map.on('load', () => {
            resizeMap();
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

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

                // Update active route if exists
                if (activeRouteDestinationRef.current) {
                    drawRoute(newLocation, activeRouteDestinationRef.current);
                }

                // Update user's lastGeohash
                try {
                    const newGeohash = geofire.geohashForLocation([latitude, longitude]);
                    if (user && db) {
                        updateDoc(doc(db, 'users', user.id), { lastGeohash: newGeohash }).catch(e => console.warn('Failed to update lastGeohash', e));
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
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 0,
                distanceFilter: 10
            }
        );

        return () => {
            navigator.geolocation.clearWatch(watchId);
        };
    }, []);

    useEffect(() => {
      if (!searchOpen || searchQuery.trim().length < 2) {
        setResults([]);
        return;
      }

      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      if (!token) return;

      const t = setTimeout(async () => {
        try {
          abortRef.current?.abort();
          const controller = new AbortController();
          abortRef.current = controller;

          setLoading(true);

          const url =
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json` +
            `?autocomplete=true&limit=6&types=place,locality,address,postcode,poi&language=en&access_token=${token}`;

          const res = await fetch(url, { signal: controller.signal });
          const data = await res.json();

          setResults(Array.isArray(data.features) ? data.features : []);
        } catch (e:any) {
          if (e.name !== "AbortError") console.warn("Geocode failed", e);
        } finally {
          setLoading(false);
        }
      }, 300);

      return () => {
        clearTimeout(t);
        abortRef.current?.abort();
      };
    }, [searchQuery, searchOpen]);

    useEffect(() => {
        if (!db || !mapRef.current || !user) return;

        const nowTimestamp = Timestamp.now();
        const q = query(
            collection(db, "spots"),
            where("expiresAt", ">", nowTimestamp)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const now = Date.now();
            const activeSpots = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as any))
                .filter(s => s.expiresAt?.toMillis() > now);
            setActiveSpots(activeSpots);

            // Set free spots locally for filtering
            const mappedFree: MapItem[] = activeSpots.map(s => ({
                id: s.id,
                lat: s.lat,
                lng: s.lng,
                type: 'free' as const,
                status: s.status || 'available',
                title: s.address || 'Street Spot',
                reportedAt: s.reportedAt,
                expiresAt: s.expiresAt,
                finderId: s.finderId,
                finderName: s.finderName,
                claimedBy: s.claimedBy,
                holdRequestedBy: s.holdRequestedBy,
                holdRequestedByName: s.holdRequestedByName,
                holdRequestStatus: s.holdRequestStatus,
                holdTimerExpiresAt: s.holdTimerExpiresAt,
                rawSpot: s
            }));
            setFreeSpots(mappedFree);

            // Compute if there's any new spot added since last viewed
            const lastViewedStr = localStorage.getItem('lastViewedNotifications');
            const lastViewedTime = lastViewedStr ? parseInt(lastViewedStr, 10) : 0;

            let newSpotsCount = 0;
            activeSpots.forEach(s => {
                const reportedTime = s.reportedAt?.toMillis() || 0;
                if (reportedTime > lastViewedTime && s.finderId !== user.id) {
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

        return () => {
            unsubscribe();
        };
    }, [user?.id]);

    // Fetch paid listings from Firestore and dynamically generate mocks around userLocation if empty
    useEffect(() => {
        if (!db || !user) return;
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

            // If empty, fallback to mock listings centered dynamically around userLocation (or NYC_CENTER)
            if (list.length === 0) {
                const centerLat = userLocation ? userLocation[1] : NYC_CENTER[1];
                const centerLng = userLocation ? userLocation[0] : NYC_CENTER[0];
                list = [
                    {
                        id: 'mock_listing_1',
                        lat: centerLat + 0.0035,
                        lng: centerLng - 0.0045,
                        type: 'paid' as const,
                        status: 'available' as const,
                        title: 'Private Driveway - UWS',
                        pricePerHour: 15.00,
                        description: 'Secure driveway behind locked gate. 24/7 access.',
                        rawSpot: null
                    },
                    {
                        id: 'mock_listing_2',
                        lat: centerLat - 0.0055,
                        lng: centerLng + 0.0065,
                        type: 'paid' as const,
                        status: 'available' as const,
                        title: 'SoHo Garage Spot',
                        pricePerHour: 25.00,
                        description: 'Underground heated garage. Very tight turn.',
                        rawSpot: null
                    },
                    {
                        id: 'mock_listing_3',
                        lat: centerLat + 0.0065,
                        lng: centerLng - 0.0015,
                        type: 'paid' as const,
                        status: 'available' as const,
                        title: 'Brooklyn Brownstone Spot',
                        pricePerHour: 10.00,
                        description: 'Easy street access, no alternate side parking worries.',
                        rawSpot: null
                    }
                ];
            }
            setPaidListings(list);
        }, (err) => {
            console.warn("Listings snapshot listener error:", err);
        });
        return () => unsubscribe();
    }, [db, user, userLocation]);

    // Fetch public garages POIs dynamically from Google Places (or Mapbox/mocks fallback) centered around userLocation
    useEffect(() => {
        const centerLat = userLocation ? userLocation[1] : NYC_CENTER[1];
        const centerLng = userLocation ? userLocation[0] : NYC_CENTER[0];
        
        const generateFallbackPublicGarages = () => {
            const items: MapItem[] = [
                {
                    id: 'mock_public_1',
                    lat: centerLat + 0.0045,
                    lng: centerLng + 0.0025,
                    type: 'public' as const,
                    status: 'available' as const,
                    title: 'Central Parking System',
                    pricePerHour: 18.00,
                    description: 'Public parking garage. Open 24/7.',
                    rawSpot: null
                },
                {
                    id: 'mock_public_2',
                    lat: centerLat - 0.0035,
                    lng: centerLng - 0.0055,
                    type: 'public' as const,
                    status: 'available' as const,
                    title: 'Icon Parking Garage',
                    pricePerHour: 22.00,
                    description: 'Secure public parking lot and garage.',
                    rawSpot: null
                },
                {
                    id: 'mock_public_3',
                    lat: centerLat + 0.0018,
                    lng: centerLng + 0.0052,
                    type: 'public' as const,
                    status: 'available' as const,
                    title: 'Quik Park Lot',
                    pricePerHour: 14.50,
                    description: 'Public parking garage with valet.',
                    rawSpot: null
                }
            ];
            setPublicGarages(items);
        };

        const fetchPublicParkingMapbox = async () => {
            if (!MAPBOX_TOKEN) {
                generateFallbackPublicGarages();
                return;
            }
            try {
                const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/parking.json?proximity=${centerLng},${centerLat}&types=poi&limit=15&access_token=${MAPBOX_TOKEN}`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.features && Array.isArray(data.features) && data.features.length > 0) {
                    const items: MapItem[] = data.features.map((f: any, idx: number) => {
                        const [lng, lat] = f.geometry.coordinates;
                        const mockPrices = [12.00, 15.00, 18.00, 22.00, 25.00, 30.00];
                        const price = mockPrices[idx % mockPrices.length];
                        return {
                            id: f.id,
                            lat,
                            lng,
                            type: 'public' as const,
                            status: 'available' as const,
                            title: f.text || 'Public Parking',
                            pricePerHour: price,
                            description: f.place_name || 'Public parking lot or garage.',
                            rawSpot: null
                        };
                    });
                    setPublicGarages(items);
                } else {
                    generateFallbackPublicGarages();
                }
            } catch (e) {
                console.warn("Failed to fetch public parking via Mapbox", e);
                generateFallbackPublicGarages();
            }
        };

        const googleObj = (window as any).google;
        if (googleMapsLoaded && googleObj && googleObj.maps && googleObj.maps.places) {
            try {
                const dummyElement = document.createElement('div');
                const service = new googleObj.maps.places.PlacesService(dummyElement);
                
                const request = {
                    location: new googleObj.maps.LatLng(centerLat, centerLng),
                    radius: 3218.69, // 2 miles in meters
                    type: 'parking'
                };
                
                service.nearbySearch(request, (results: any[], status: string) => {
                    if (status === googleObj.maps.places.PlacesServiceStatus.OK && results) {
                        const items: MapItem[] = results.map((place, idx) => {
                            const lat = place.geometry?.location?.lat() || (centerLat + (idx * 0.001));
                            const lng = place.geometry?.location?.lng() || (centerLng + (idx * 0.001));
                            
                            // Estimate pricing based on rating
                            let basePrice = 12.00;
                            if (place.rating) {
                                basePrice += place.rating * 2.5;
                            }
                            const finalPrice = Math.round(basePrice * 2) / 2;
                            
                            return {
                                id: place.place_id || `google_public_${idx}`,
                                lat,
                                lng,
                                type: 'public' as const,
                                status: 'available' as const,
                                title: place.name || 'Public Parking',
                                pricePerHour: finalPrice,
                                description: place.vicinity || 'Public parking facility.',
                                rawSpot: null
                            };
                        });
                        setPublicGarages(items);
                    } else {
                        console.warn("Google Places nearby search failed or returned no results, status:", status);
                        fetchPublicParkingMapbox();
                    }
                });
            } catch (err) {
                console.error("Error performing Google Places search:", err);
                fetchPublicParkingMapbox();
            }
        } else {
            fetchPublicParkingMapbox();
        }
    }, [userLocation, MAPBOX_TOKEN, googleMapsLoaded]);

    // Unified map marker renderer with 2-mile distance radius filtering
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;
        const centerLat = userLocation ? userLocation[1] : NYC_CENTER[1];
        const centerLng = userLocation ? userLocation[0] : NYC_CENTER[0];

        // 1. Gather all items currently enabled by filters
        const visibleItems: MapItem[] = [];
        if (showFree) visibleItems.push(...freeSpots);
        if (showPaid) visibleItems.push(...paidListings);
        if (showPublic) visibleItems.push(...publicGarages);

        // 2. Filter by 2 mile radius relative to user coordinate (3.2187 km)
        const radiusFilteredItems = visibleItems.filter(item => {
            const distanceVal = getDistance(centerLat, centerLng, item.lat, item.lng);
            const distanceInMiles = distanceVal * 0.621371;
            return distanceInMiles <= 2.0;
        });

        const nextIds = new Set(radiusFilteredItems.map(item => item.id));
        const currentMarkers = allMarkersRef.current;

        // 3. Remove markers that are no longer visible
        Object.keys(currentMarkers).forEach(id => {
            if (!nextIds.has(id)) {
                currentMarkers[id].remove();
                delete currentMarkers[id];
            }
        });

        // 4. Add/Update markers for visible items
        radiusFilteredItems.forEach(item => {
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

    }, [showFree, showPaid, showPublic, freeSpots, paidListings, publicGarages, userLocation]);

    useEffect(() => {
        const spot = selectedItem || (freeSpots.length > 0 ? freeSpots[0] : null);
        if (!spot) {
            setSpotAddress("");
            return;
        }
        if (spot.title) {
            setSpotAddress(spot.title);
            return;
        }
        if (spot.address) {
            setSpotAddress(spot.address);
            return;
        }
        if (!MAPBOX_TOKEN) {
            setSpotAddress("Street Spot");
            return;
        }
        
        setSpotAddress("Resolving address...");
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${spot.lng},${spot.lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`)
            .then(res => res.json())
            .then(data => {
                if (data.features && data.features.length > 0) {
                    setSpotAddress(data.features[0].place_name.split(',')[0]);
                } else {
                    setSpotAddress(`Coordinates: ${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)}`);
                }
            })
            .catch(() => {
                setSpotAddress("Street Spot");
            });
    }, [selectedItem, freeSpots, MAPBOX_TOKEN]);

    useEffect(() => {
        if (userMarkerRef.current) userMarkerRef.current.remove();
        if (mapRef.current && userLocation) {
            const el = document.createElement('div');
            el.style.zIndex = '5'; // Keep user marker below spots
            el.innerHTML = `<div class="relative flex items-center justify-center"><div class="absolute w-11 h-11 bg-blue-500/20 rounded-full animate-pulse"></div><div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg></div></div>`;
            userMarkerRef.current = new mapboxgl.Marker(el).setLngLat(userLocation).addTo(mapRef.current);
        }
    }, [userLocation]);

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
            // Editing requires deleting the old spot and creating a new one, 
            // because the backend rules likely make `reportedAt` immutable.
            // This is done in a batch to ensure atomicity.
            try {
                const batch = writeBatch(db);
                
                // 1. Delete the old document
                const oldSpotRef = doc(db, "spots", selectedItem.id);
                batch.delete(oldSpotRef);
                
                // 2. Create a new document with clean data
                const newSpotRef = doc(collection(db, "spots"));
                const newSpotData = {
                    // Carry over only the essential, immutable data
                    lat: selectedItem.lat,
                    lng: selectedItem.lng,
                    type: 'free',
                    status: 'available',
                    // Re-assert ownership with the current user
                    finderId: user.id,
                    finderName: user.fullName || 'Anonymous',
                    // Apply the new times
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
            // Creating a new spot from scratch
            try {
                const oneHourAgo = now - 60 * 60 * 1000;
                // Query all spots for this finder, then filter by date client-side to avoid needing a Firestore composite index
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
                // Optimistically show confirmation
                setShowPingConfirmation(true);
                setTimeout(() => setShowPingConfirmation(false), 4000);
                onSaveSuccess();
                
                addDoc(collection(db, "spots"), newSpotData)
                    .catch(error => {
                        console.error("Optimistic save failed:", error);
                        // We already called onSaveSuccess which cleared state, 
                        // but we can alert the user.
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
                        // Optimistically show confirmation
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
        const spotToDelete = selectedItem || (activeSpots.length > 0 ? activeSpots[0] : null);
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
        const spotToClaim = selectedItem || (activeSpots.length > 0 ? activeSpots[0] : null);
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
        const spot = selectedItem || (freeSpots.length > 0 ? freeSpots[0] : null);
        if (!spot) return;
        if (spot.type === 'free') {
            setIsHoldModalOpen(true);
        } else {
            handleClaimSpot();
        }
    };

    const handleTrackLocation = () => {
        const spotToTrack = selectedItem || (activeSpots.length > 0 ? activeSpots[0] : null);
        if (!spotToTrack) return;
        if (trackedItemId === spotToTrack.id) {
            setTrackedItemId(null);
            activeRouteDestinationRef.current = null;
            clearRoute();
            return;
        }
        const startLoc = userLocation || NYC_CENTER;
        const dest: [number, number] = [spotToTrack.lng, spotToTrack.lat];
        activeRouteDestinationRef.current = dest;
        setTrackedItemId(spotToTrack.id);
        drawRoute(startLoc, dest);
    };

    const handleCancelSearch = () => {
        setSearchQuery("");
        setResults([]);
        setSearchOpen(false);
        inputRef.current?.blur();
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
            />

            {isHoldModalOpen && (
                <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-[#1c1c1e] rounded-3xl p-6 w-full max-w-sm text-white border border-white/10 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-extrabold text-sm flex items-center gap-1.5 text-amber-500">
                                <Wallet size={16} />
                                <span>Escrow Hold Request</span>
                            </h3>
                            <button onClick={() => setIsHoldModalOpen(false)}>
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
                            onClick={handleSendHoldRequest}
                            className="w-full bg-amber-600 hover:bg-amber-500 font-extrabold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/10 text-white"
                        >
                            Pay & Request Hold ($2.00)
                        </button>
                    </div>
                </div>
            )}

            {(() => {
                const pendingIncomingHold = freeSpots.find(s => s.finderId === user?.id && s.holdRequestStatus === 'pending');
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
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptHold(pendingIncomingHold);
                                }}
                                className="flex-1 bg-green-600 hover:bg-green-500 font-bold py-1.5 rounded-xl text-xs transition-colors text-white"
                            >
                                Accept & Hold ($2)
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeclineHold(pendingIncomingHold);
                                }}
                                className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 font-bold py-1.5 rounded-xl text-xs transition-colors text-white"
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                );
            })()}

            {finderSuccessNotification && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] z-50 bg-green-600 border border-green-500 text-white rounded-2xl p-4 shadow-2xl pointer-events-auto flex items-center gap-3">
                    <Check size={20} className="shrink-0" />
                    <div className="text-xs font-semibold">{finderSuccessNotification}</div>
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
                            setSelectedItem(prev => ({
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
            
            {/* Map Blue Tint Overlays */}
            <div className="map-blue-tint-color" />
            <div className="map-blue-tint-overlay" />
            <div className="map-blue-tint-soft" />

            {showPingConfirmation && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-green-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg"><Check size={20} /><span>spot pinged successfully!</span></div>
            )}
            <div className="sp-overlay flex flex-col justify-between p-3 pointer-events-none">
                {/* Redesigned Header: Search Bar & Icons */}
                <header style={{ paddingTop: 'env(safe-area-inset-top)' }} className="w-full flex flex-col gap-1.5 pointer-events-auto">
                    {/* Top Search Bar */}
                    <div className="w-full max-w-[380px] mx-auto bg-[#07162c]/85 backdrop-blur-xl border border-white/10 rounded-full h-11 px-3 flex items-center justify-between shadow-xl transition-all duration-300">
                        {/* Menu Button / Profile Trigger */}
                        <button 
                            onClick={() => setView(AppView.PROFILE)} 
                            className="text-white/80 hover:text-white p-1.5 hover:bg-white/5 rounded-full transition-colors shrink-0"
                            aria-label="Menu"
                        >
                            <Menu size={18} />
                        </button>

                        {/* Search Input */}
                        <div className="flex-1 mx-2 flex items-center gap-1.5">
                            <Search size={16} className="text-gray-400" />
                            <input 
                                ref={inputRef}
                                type="text" 
                                placeholder="Search location..." 
                                className="bg-transparent border-none outline-none text-white text-xs w-full placeholder-gray-400 font-medium"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setSearchOpen(true)}
                            />
                        </div>

                        {/* Action Icons */}
                        <div className="flex items-center gap-0.5">
                            <button 
                                type="button" 
                                aria-label="Scanner" 
                                onClick={() => setView(AppView.AI_ASSISTANT)} 
                                className="p-1.5 text-white/85 hover:text-white hover:bg-white/5 rounded-full transition-colors shrink-0"
                            >
                                <Camera size={18} />
                            </button>
                            
                            <button 
                                type="button" 
                                aria-label="Chat" 
                                onClick={() => setView(AppView.MESSAGES)} 
                                className="p-1.5 text-white/85 hover:text-white hover:bg-white/5 rounded-full transition-colors relative shrink-0"
                            >
                                <div className="relative">
                                    <MessageSquare size={18} />
                                    {unreadMessagesCount > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 bg-[#1e75ff] w-1.5 h-1.5 rounded-full animate-pulse shadow-md" />
                                    )}
                                </div>
                            </button>
                            
                            <button 
                                type="button" 
                                aria-label="Notifications" 
                                onClick={() => {
                                    localStorage.setItem('lastViewedNotifications', Date.now().toString());
                                    localStorage.setItem('pendingUpdatesCount', '0');
                                    setPendingUpdatesCount(0);
                                    setView(AppView.NOTIFICATIONS);
                                }} 
                                className="p-1.5 text-white/85 hover:text-white hover:bg-white/5 rounded-full transition-colors relative shrink-0"
                            >
                                <div className="relative">
                                    <Bell size={18} />
                                    {pendingUpdatesCount > 0 && (
                                        <span className="absolute -top-0.5 -right-0.5 bg-[#1e75ff] w-1.5 h-1.5 rounded-full animate-pulse shadow-md" />
                                    )}
                                </div>
                            </button>
                        </div>

                        {/* Search Results Dropdown */}
                        {searchOpen && (loading || results.length > 0) && (
                            <div className="absolute left-0 right-0 mt-2 top-full z-[9999] bg-[#07162c]/95 backdrop-blur-xl rounded-2xl max-h-60 overflow-y-auto border border-white/10 shadow-2xl p-2">
                                {loading && <div className="px-4 py-3 text-white/60 text-xs">Searching…</div>}

                                {!loading && results.map((r: any) => (
                                    <button
                                        key={r.id}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            setSearchQuery(r.place_name);
                                            setSearchOpen(false);
                                            setResults([]);

                                            mapRef.current?.easeTo({
                                                center: r.center,
                                                zoom: 14,
                                                duration: 800,
                                            });
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-xl transition-colors"
                                    >
                                        <div className="text-white font-medium text-xs">{r.text}</div>
                                        <div className="text-[10px] text-white/50">{r.place_name}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {searchOpen && (
                        <div className="w-full max-w-[380px] mx-auto flex justify-end">
                            <button onClick={handleCancelSearch} className="text-[#38bdf8] font-bold text-[10px] bg-white/5 border border-white/10 rounded-full py-1 px-3 mt-1">
                                Cancel Search
                            </button>
                        </div>
                    )}

                    {/* Sub-header Filter Tabs */}
                    {!searchOpen && (
                        <div className="w-full max-w-[380px] mx-auto mt-1 bg-[#07162c]/85 backdrop-blur-xl border border-white/10 rounded-2xl p-1 flex items-center justify-around text-[10px] shadow-lg">
                            <button 
                                onClick={() => setActiveFilterTab('nearest')}
                                className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl font-semibold flex-1 transition-all ${
                                    activeFilterTab === 'nearest' 
                                        ? 'bg-[#1e75ff]/20 text-[#38bdf8]' 
                                        : 'text-white/60 hover:text-white'
                                }`}
                            >
                                <div className={`w-5.5 h-5.5 rounded-full flex items-center justify-center transition-all ${
                                    activeFilterTab === 'nearest' ? 'bg-[#1e75ff] text-white' : 'bg-white/5'
                                }`}>
                                    <MapPin size={10} />
                                </div>
                                <span>Nearest</span>
                            </button>
                            <div className="w-[1px] h-5 bg-white/10" />
                            
                            <button 
                                onClick={() => setActiveFilterTab('favorites')}
                                className={`flex flex-col items-center gap-1.5 py-1 px-2 rounded-xl font-medium flex-1 transition-all ${
                                    activeFilterTab === 'favorites' 
                                        ? 'bg-[#1e75ff]/20 text-[#38bdf8]' 
                                        : 'text-white/60 hover:text-white'
                                }`}
                            >
                                <Star size={14} />
                                <span>Favorites</span>
                            </button>
                            <div className="w-[1px] h-5 bg-white/10" />
                            
                            <button 
                                onClick={() => setActiveFilterTab('history')}
                                className={`flex flex-col items-center gap-1.5 py-1 px-2 rounded-xl font-medium flex-1 transition-all ${
                                    activeFilterTab === 'history' 
                                        ? 'bg-[#1e75ff]/20 text-[#38bdf8]' 
                                        : 'text-white/60 hover:text-white'
                                }`}
                            >
                                <Clock size={14} />
                                <span>History</span>
                            </button>
                            <div className="w-[1px] h-5 bg-white/10" />
                            
                            <button 
                                onClick={() => {
                                    setActiveFilterTab('filters');
                                    setShowLegend(!showLegend);
                                }}
                                className={`flex flex-col items-center gap-1.5 py-1 px-2 rounded-xl font-medium flex-1 transition-all ${
                                    activeFilterTab === 'filters' 
                                        ? 'bg-[#1e75ff]/20 text-[#38bdf8]' 
                                        : 'text-white/60 hover:text-white'
                                }`}
                            >
                                <Sliders size={14} />
                                <span>Filters</span>
                            </button>
                        </div>
                    )}

                    {/* Floating Weather Overlay (Left aligned with the centered filters) */}
                    {!searchOpen && (
                        <div className="w-full max-w-[380px] mx-auto flex justify-start pl-1 mt-0.5">
                            <div className="flex items-center gap-1.5 bg-[#07162c]/85 backdrop-blur-xl border border-white/10 rounded-full px-2.5 py-1 w-fit text-[10px] font-semibold text-white/95 shadow-md pointer-events-auto">
                                <CloudSun size={13} className="text-yellow-400" />
                                <span>28°</span>
                            </div>
                        </div>
                    )}
                </header>

                {/* Floating Map Legend (Left) */}
                {!searchOpen && showLegend && (
                    <div className="absolute left-4 top-20 bg-[#07162c]/90 border border-white/10 backdrop-blur-xl rounded-2xl p-4 shadow-2xl w-44 pointer-events-auto flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300 z-25">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-0.5">Map Legend</div>
                        <div className="flex flex-col gap-2.5">
                            {/* Free Parking */}
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

                            {/* Paid Parking */}
                            <label className="flex items-center justify-between cursor-pointer group select-none">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] border border-[#22c55e]/20">
                                        <MapPin size={11} fill="currentColor" fillOpacity={0.2} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[10px] font-bold text-white leading-tight text-xs">Paid Parking</div>
                                        <div className="text-[8px] text-gray-400 leading-tight">Driveways & lots</div>
                                    </div>
                                </div>
                                <input 
                                    type="checkbox" 
                                    checked={showPaid} 
                                    onChange={() => setShowPaid(!showPaid)}
                                    className="w-3.5 h-3.5 rounded border-white/20 text-[#22c55e] focus:ring-0 bg-white/5 cursor-pointer accent-[#22c55e]"
                                />
                            </label>

                            {/* Public Parking */}
                            <label className="flex items-center justify-between cursor-pointer group select-none">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-[#a855f7]/10 flex items-center justify-center text-[#a855f7] border border-[#a855f7]/20">
                                        <MapPin size={11} fill="currentColor" fillOpacity={0.2} />
                                    </div>
                                    <div className="text-left">
                                        <div className="text-[10px] font-bold text-white leading-tight text-xs">Public Parking</div>
                                        <div className="text-[8px] text-gray-400 leading-tight">Garages & lots</div>
                                    </div>
                                </div>
                                <input 
                                    type="checkbox" 
                                    checked={showPublic} 
                                    onChange={() => setShowPublic(!showPublic)}
                                    className="w-3.5 h-3.5 rounded border-white/20 text-[#a855f7] focus:ring-0 bg-white/5 cursor-pointer accent-[#a855f7]"
                                />
                            </label>
                        </div>
                    </div>
                )}

                {/* Floating Map Controls Column (Right) */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2.5 pointer-events-auto z-20">
                    <button 
                        onClick={handleLocateMe} 
                        className="w-10 h-10 rounded-full glass-button flex items-center justify-center shadow-lg transition-transform active:scale-90"
                        title="Locate Me"
                    >
                        <Locate size={18} className="text-[#1e75ff]" />
                    </button>
                    
                    <button 
                        onClick={() => alert("Toggle 2D/3D map view")}
                        className="w-10 h-10 rounded-full glass-button flex items-center justify-center font-extrabold text-[10px] shadow-lg transition-transform active:scale-90"
                        title="Map Mode"
                    >
                        2D
                    </button>
                    
                    <button 
                        onClick={() => alert("Navigation routing enabled")}
                        className="w-10 h-10 rounded-full glass-button flex items-center justify-center shadow-lg transition-transform active:scale-90"
                        title="Compass Directions"
                    >
                        <Navigation size={18} className="rotate-45 text-[#38bdf8]" />
                    </button>
                </div>

                {/* Bottom Card, Action Button, and Navigation Bar */}
                <div className="w-full flex flex-col gap-2 pointer-events-auto mt-auto pb-2">
                    
                    {/* Dynamic Spot Details Card ("Best Match" style) */}
                    {(() => {
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
                                    isMock: false,
                                    rawSpot: selectedItem.type === 'free' ? selectedItem : null,
                                    rate: dynamicRate,
                                    subText: dynamicSubText
                                };
                            } else if (freeSpots.length > 0) {
                                const closest = freeSpots[0];
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
                                    isMock: false,
                                    rawSpot: closest,
                                    rate: dynamicRate,
                                    subText: dynamicSubText
                                };
                            } else {
                                return {
                                    id: 'mock',
                                    title: 'Maple Street Parking',
                                    typeLabel: 'Paid',
                                    statusLabel: 'available',
                                    distance: '120 yd',
                                    isMock: true,
                                    rawSpot: null,
                                    rate: '$1.50/hr',
                                    subText: '120 yd • 12 available'
                                };
                            }
                        };

                        const spotToDisplay = getSpotToDisplay();
                        
                        let badgeBgColor = 'bg-[#1e75ff]';
                        if (spotToDisplay.typeLabel === 'Paid') badgeBgColor = 'bg-[#22c55e]';
                        if (spotToDisplay.typeLabel === 'Public') badgeBgColor = 'bg-[#a855f7]';

                        return (
                            <div className="w-full max-w-[380px] mx-auto bg-[#07162c]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-3.5 shadow-2xl transition-all">
                                <div className="flex items-center gap-3">
                                    {/* Badge */}
                                    <div className={`w-14 h-14 rounded-2xl ${badgeBgColor} flex flex-col items-center justify-center text-white shadow-lg shrink-0`}>
                                        <span className="font-extrabold text-lg">P</span>
                                        <span className="text-[9px] font-medium">{spotToDisplay.distance}</span>
                                    </div>
                                    {/* Details */}
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[9px] font-bold text-[#38bdf8] uppercase tracking-wider">| {spotToDisplay.typeLabel} Parking</span>
                                        <h3 className="text-sm font-bold text-white truncate mt-0.5">{spotToDisplay.title}</h3>
                                        <p className="text-[11px] text-white/50 mt-0.5 truncate">
                                            {spotToDisplay.subText}
                                        </p>
                                    </div>
                                    {/* Rate & Arrow */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-lg">
                                            {spotToDisplay.rate}
                                        </span>
                                    </div>
                                </div>

                                {/* Spot Interactive Controls */}
                                {!spotToDisplay.isMock && (
                                    <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-white/5">
                                        <button 
                                            onClick={handleTrackLocation} 
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
                                                        onClick={handleClaimSpotClick} 
                                                        className="flex-1 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold py-1.5 rounded-xl transition-all text-[11px] shadow-md shadow-amber-600/20"
                                                    >
                                                        Claim Spot
                                                    </button>
                                                )}

                                                {user?.id === spotToDisplay.rawSpot.finderId && (
                                                    <div className="flex flex-1 gap-1.5">
                                                        <button 
                                                            onClick={() => {
                                                                setSelectedItem(spotToDisplay.rawSpot);
                                                                setSpotModalOpen(true);
                                                            }} 
                                                            className="flex-1 bg-blue-600/50 hover:bg-blue-600 text-white font-bold py-1.5 rounded-xl transition-all text-[11px]"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button 
                                                            onClick={handleDeletePing} 
                                                            className="flex-1 border border-red-500/50 hover:bg-red-500/10 text-red-400 font-bold py-1.5 rounded-xl transition-all text-[11px]"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}

                                                {spotToDisplay.rawSpot.status === 'claimed' && spotToDisplay.rawSpot.claimedBy === user?.id && spotToDisplay.rawSpot.holdRequestStatus === 'accepted' && (
                                                    <button 
                                                        onClick={handleArrivalRelease} 
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
                                )}
                            </div>
                        );
                    })()}

                    {/* Find Parking Button */}
                    <button 
                        onClick={() => {
                            setSelectedItem(null);
                            setSpotModalOpen(true);
                        }} 
                        disabled={!user}
                        className="w-full max-w-[380px] mx-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 active:scale-95 text-white font-bold py-2.5 px-5 rounded-full flex items-center justify-center gap-2.5 transition-all duration-200 shadow-lg shadow-blue-500/30 border border-blue-400/20 disabled:opacity-50"
                    >
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <MapPin size={13} />
                        </div>
                        <div className="text-left leading-tight">
                            <div className="font-extrabold text-xs uppercase tracking-wide">PING PARKING</div>
                            <div className="text-[9px] text-white/80 font-normal">Ping a nearby parking spot</div>
                        </div>
                    </button>

                    {/* Persistent Navigation Bar */}
                    <div className="w-full max-w-[380px] mx-auto bg-[#07162c]/95 backdrop-blur-xl border border-white/10 rounded-3xl py-2 px-5 flex items-center justify-between shadow-2xl">
                        <button 
                            onClick={() => setView(AppView.MAP)} 
                            className="flex flex-col items-center gap-0.5 text-[#1e75ff] flex-1"
                        >
                            <Map size={18} />
                            <span className="text-[9px] font-bold">Map</span>
                        </button>
                        
                        <button 
                            onClick={() => setView(AppView.PARKING_SPACE)} 
                            className="flex flex-col items-center gap-0.5 text-white/50 hover:text-white flex-1 transition-colors"
                        >
                            <Calendar size={18} />
                            <span className="text-[9px] font-medium">Bookings</span>
                        </button>
                        
                        <button 
                            onClick={() => alert("Wallet features coming soon!")} 
                            className="flex flex-col items-center gap-0.5 text-white/50 hover:text-white flex-1 transition-colors"
                        >
                            <Wallet size={18} />
                            <span className="text-[9px] font-medium">Wallet</span>
                        </button>
                        
                        <button 
                            onClick={() => setView(AppView.PROFILE)} 
                            className="flex flex-col items-center gap-0.5 text-white/50 hover:text-white flex-1 transition-colors"
                        >
                            <User size={18} />
                            <span className="text-[9px] font-medium">Profile</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
