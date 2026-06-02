import React, { useState, useEffect, useRef } from 'react';
import { StreetSpot, AppView } from '../types';
import { MapPin, Check, Locate, ChevronUp, ChevronDown, List, Camera, MessageSquare, Bell, Clock, Calendar, X, Search } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp, doc, deleteDoc, writeBatch, updateDoc, getDocs, where } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';
import * as geofire from 'geofire-common';
import parqueenLogo from '../assets/Parqueen_Logo.png';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const NYC_CENTER: [number, number] = [-73.9712, 40.7831];

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

const createMarkerElement = (isMine: boolean, status: string = 'available') => {
    const el = document.createElement('div');
    el.style.zIndex = '10';
    let color = '#3B82F6'; // default blue
    if (status === 'claimed') {
        color = '#F59E0B'; // orange for claimed
    }
    el.innerHTML = `
    <div style="width: 36px; height: 36px; position: relative;">
      <svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.3));">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#FFF" stroke-width="1"/>
        <text x="12" y="11" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="white">P</text>
      </svg>
    </div>
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
            const initialDate = spot ? spot.reportedAt.toDate() : new Date(Date.now() + 2 * 60_000);
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

interface MapViewProps {
    user: any;
    setView: (view: AppView) => void;
    onMessageUser: (userId: string, context: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({ user, setView, onMessageUser }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const spotMarkersRef = useRef<Record<string, { marker: mapboxgl.Marker; timerId: number | undefined }>>({});
    const [selectedItem, setSelectedItem] = useState<StreetSpot | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
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

    const resizeMap = () => mapRef.current?.resize();

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
                
                if (timestampMillis > lastReadTime) {
                    count++;
                }
            });
            setUnreadMessagesCount(count);
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

            const nextIds = new Set(activeSpots.map(s => s.id));
            const markers = spotMarkersRef.current;

            Object.keys(markers).forEach(id => {
                if (!nextIds.has(id)) {
                    markers[id].marker.remove();
                    if (markers[id].timerId) clearTimeout(markers[id].timerId);
                    delete markers[id];
                }
            });

            activeSpots.forEach(s => {
                const lngLat: [number, number] = [s.lng, s.lat];
                if (!markers[s.id]) {
                    const el = createMarkerElement(s.finderId === user.id, s.status);
                    const marker = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat(lngLat).addTo(mapRef.current!);
                    marker.getElement().addEventListener('click', (e) => {
                        e.stopPropagation();
                        setSelectedItem(s);
                        mapRef.current?.flyTo({ center: lngLat, zoom: 16 });
                    });

                    const msLeft = s.expiresAt.toMillis() - Date.now();
                    const timerId = setTimeout(() => {
                        marker.remove();
                        delete markers[s.id];
                    }, msLeft);

                    markers[s.id] = { marker, timerId, status: s.status } as any;
                } else {
                    const cur = markers[s.id].marker.getLngLat();
                    if (cur.lng !== s.lng || cur.lat !== s.lat) markers[s.id].marker.setLngLat(lngLat);
                    if ((markers[s.id] as any).status !== s.status) {
                        const newEl = createMarkerElement(s.finderId === user.id, s.status);
                        markers[s.id].marker.getElement().innerHTML = newEl.innerHTML;
                        (markers[s.id] as any).status = s.status;
                    }
                }
            });
        });

        return () => {
            Object.values(spotMarkersRef.current).forEach(m => {
                m.marker.remove();
                if (m.timerId) clearTimeout(m.timerId);
            });
            spotMarkersRef.current = {};
            unsubscribe();
        };
    }, [user?.id]);

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
                const q = query(collection(db, "spots"), where("finderId", "==", user.id));
                const snap = await getDocs(q);
                const activeRecentPings = snap.docs.filter(d => {
                    const data = d.data();
                    const reportedMillis = data.reportedAt?.toMillis() || 0;
                    return reportedMillis >= oneHourAgo;
                });

                if (activeRecentPings.length >= 5) {
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
                addDoc(collection(db, "spots"), newSpotData)
                    .then(() => {
                        setShowPingConfirmation(true);
                        setTimeout(() => setShowPingConfirmation(false), 4000);
                        onSaveSuccess();
                    })
                    .catch(onSaveError);
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
                        addDoc(collection(db, "spots"), newSpotData)
                            .then(() => {
                                setShowPingConfirmation(true);
                                setTimeout(() => setShowPingConfirmation(false), 4000);
                                onSaveSuccess();
                            })
                            .catch(onSaveError);
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
        if (!user || !selectedItem) return;
        if (user.id !== selectedItem.finderId) return;

        const ok = window.confirm("Delete this ping? This can't be undone.");
        if (!ok) return;

        try {
            await deleteDoc(doc(db, "spots", selectedItem.id));
            setSelectedItem(null);
        } catch (e) {
            console.error("Error deleting ping:", e);
        }
    };

    const handleClaimSpot = async () => {
        if (!user || !selectedItem) return;
        try {
            await updateDoc(doc(db, "spots", selectedItem.id), {
                status: 'claimed',
                claimedBy: user.id
            });
            setSelectedItem({ ...selectedItem, status: 'claimed', claimedBy: user.id });
        } catch (e) {
            console.error("Error claiming spot:", e);
            alert("Failed to claim spot.");
        }
    };

    const handleTrackLocation = () => {
        if (!selectedItem) return;
        if (!userLocation) {
            alert("Waiting for your location to start navigation...");
            return;
        }
        const dest: [number, number] = [selectedItem.lng, selectedItem.lat];
        activeRouteDestinationRef.current = dest;
        drawRoute(userLocation, dest);
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
            <div ref={mapContainerRef} className="sp-map" onClick={() => setSelectedItem(null)} />
            {showPingConfirmation && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-green-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg"><Check size={20} /><span>spot pinged successfully!</span></div>
            )}
            <div className="sp-overlay flex flex-col justify-between p-3 pointer-events-none">
                <header style={{ paddingTop: 'env(safe-area-inset-top)' }} className="w-full flex items-start gap-2 pointer-events-auto">
                    <div className={`relative flex-1 bg-black/70 backdrop-blur-xl rounded-full flex items-center h-14 px-4 shadow-lg border border-white/10 transition-all duration-300 ease-out ${searchOpen ? 'ring-2 ring-blue-500/90' : 'max-w-md'}`}>
                        {!searchOpen && (
                            <button onClick={() => setView(AppView.PROFILE)} className="shrink-0">
                                {user?.avatarUrl ? (
                                    <img src={user.avatarUrl} alt="Profile" className="w-9 h-9 rounded-full transition-all duration-300 object-cover" />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 transition-all duration-300">
                                        <i className="fa-solid fa-user"></i>
                                    </div>
                                )}
                            </button>
                        )}
                        <div className="flex-1 mx-3 flex items-center gap-2">
                           <Search size={22} className={`text-gray-400 transition-all duration-300 ${searchOpen ? 'text-blue-400' : ''}`} />
                           <input 
                                ref={inputRef}
                                type="text" 
                                placeholder="Search..." 
                                className="bg-transparent outline-none text-white w-full h-full"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setSearchOpen(true)}
                           />
                        </div>
                        {!searchOpen && <div className="flex items-center gap-1 text-gray-400">
                          <button type="button" aria-label="Scanner" onClick={() => setView(AppView.AI_ASSISTANT)} className="p-2 text-white/90 hover:text-white"><Camera size={22} /></button>
                          
                          <button type="button" aria-label="Chat" onClick={() => setView(AppView.MESSAGES)} className="p-2 text-white/90 hover:text-white relative">
                            <div className="relative">
                              <MessageSquare size={22} />
                              {unreadMessagesCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-extrabold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center shadow-md animate-pulse">
                                  {unreadMessagesCount}
                                </span>
                              )}
                            </div>
                          </button>
                          
                          <button type="button" aria-label="Notifications" onClick={() => {
                              localStorage.setItem('lastViewedNotifications', Date.now().toString());
                              localStorage.setItem('pendingUpdatesCount', '0');
                              setPendingUpdatesCount(0);
                              setView(AppView.NOTIFICATIONS);
                          }} className="p-2 text-white/90 hover:text-white relative">
                            <div className="relative">
                              <Bell size={22} />
                              {pendingUpdatesCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] font-extrabold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center shadow-md animate-pulse">
                                  {pendingUpdatesCount}
                                </span>
                              )}
                            </div>
                          </button>
                        </div>}
                        {searchOpen && (loading || results.length > 0) && (
                          <div className="absolute left-0 right-0 mt-2 top-full z-[9999] bg-black/85 backdrop-blur-xl rounded-2xl max-h-72 overflow-y-auto border border-white/10">
                            {loading && <div className="px-4 py-3 text-white/60">Searching…</div>}

                            {!loading && results.map((r:any) => (
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
                                className="w-full text-left px-4 py-3 hover:bg-white/10"
                              >
                                <div className="text-white font-medium">{r.text}</div>
                                <div className="text-xs text-white/60">{r.place_name}</div>
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                    {searchOpen && <button onClick={handleCancelSearch} className="text-white font-semibold px-4 h-14">Cancel</button>}
                </header>
                {selectedItem && (() => {
                    const departureDate = selectedItem.reportedAt.toDate();
                    const isScheduled = selectedItem.reportedAt.toMillis() > Date.now() + 60_000;
                    const departureText = isScheduled ? departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Leaving Now';
                    const timeLeftMs = selectedItem.expiresAt.toMillis() - Date.now();

                    return (
                        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-sm p-4 pointer-events-auto">
                            <div className="bg-black/70 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                                <div className="text-white text-center">
                                    <h3 className="font-bold capitalize">{selectedItem.type}</h3>
                                    <p className="text-sm text-gray-400">Departure: {departureText}</p>
                                    <p className="text-sm text-gray-400">Expires in {formatTimeLeft(timeLeftMs)}</p>
                                </div>
                                <div className="mt-4 space-y-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleTrackLocation}
                                            className="flex-1 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-blue-500/20"
                                        >
                                            <Locate size={18} />
                                            <span>Track Spot</span>
                                        </button>
                                        <button
                                            onClick={() => onMessageUser(selectedItem.finderId, `Spot pinged by ${selectedItem.finderName}`)}
                                            className="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-bold p-2.5 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md shadow-blue-500/20"
                                            title="Message User"
                                        >
                                            <MessageSquare size={20} />
                                        </button>
                                    </div>

                                    {/* Owner Actions */}
                                    {user?.id === selectedItem.finderId && (
                                        <div className="pt-1 space-y-2">
                                            <button
                                                onClick={() => setSpotModalOpen(true)}
                                                className="w-full bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-bold py-2 rounded-xl transition-all duration-200 shadow-md shadow-blue-500/20"
                                            >
                                                Edit Ping
                                            </button>
                                            <button
                                                onClick={handleDeletePing}
                                                className="w-full font-bold py-2 rounded-xl border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-all duration-200"
                                            >
                                                Delete Ping
                                            </button>
                                        </div>
                                    )}

                                    {/* Non-owner Unclaimed Action */}
                                    {user?.id !== selectedItem.finderId && selectedItem.status !== 'claimed' && (
                                        <button
                                            onClick={handleClaimSpot}
                                            className="w-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold py-2.5 rounded-xl transition-all duration-200 shadow-md shadow-orange-500/20"
                                        >
                                            Claim Spot
                                        </button>
                                    )}

                                    {/* Claimed by Me Status */}
                                    {selectedItem.status === 'claimed' && selectedItem.claimedBy === user?.id && (
                                        <p className="text-orange-400 font-bold py-1 text-center">You claimed this spot!</p>
                                    )}

                                    {/* Claimed by Someone Else Status */}
                                    {selectedItem.status === 'claimed' && selectedItem.claimedBy !== user?.id && user?.id !== selectedItem.finderId && (
                                        <p className="text-gray-400 font-bold bg-gray-800/50 py-2 rounded-xl text-center">This spot is claimed.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}
                {!selectedItem && (
                    <footer className="w-full flex justify-center pointer-events-auto" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                        <div className="relative w-full max-w-md h-28">
                        <button
                        onClick={() => setSpotModalOpen(true)}
                        disabled={!user}
                        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
                        className="
                            absolute left-1/2 -translate-x-1/2
                            bg-blue-500 text-white rounded-full
                            inline-flex items-center justify-center gap-3
                            px-8 py-4 font-bold text-base
                            shadow-lg shadow-blue-500/50
                            whitespace-nowrap
                            disabled:opacity-50
                        "
                        >
                        <MapPin size={20} className="shrink-0" />
                        <span className="leading-none">PING SPOT</span>
                        </button>

                        <button
                        onClick={handleLocateMe}
                        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
                        className="
                            absolute right-0
                            bg-black/60 backdrop-blur-md
                            border border-white/20
                            text-white rounded-full
                            w-14 h-14
                            flex items-center justify-center
                            shadow-xl
                        ">
                        <Locate size={24} />
                        </button>

                        </div>
                    </footer>
                )}
            </div>
        </div>
    );
};
