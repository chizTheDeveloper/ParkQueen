
import React, { useState, useEffect, useRef } from 'react';
import { StreetSpot, AppView } from '../types';
import { MapPin, Check, Locate, ChevronUp, ChevronDown, List, Camera, MessageCircle, Bell, Clock, Calendar, X, Search, AlertTriangle, Loader } from 'lucide-react';
import { db } from '../firebase';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const NYC_CENTER: [number, number] = [-73.9712, 40.7831];

const createUserMarkerEl = () => {
    const el = document.createElement("div");
    el.style.width = "24px";
    el.style.height = "24px";
    el.style.borderRadius = "9999px";
    el.style.background = "#3b82f6"; // blue
    el.style.border = "2px solid white";
    el.style.boxShadow = "0 6px 16px rgba(0,0,0,0.35)";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    
    el.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" />
      </svg>
    `;
    return el;
  };

  const createPingMarkerEl = () => {
    const el = document.createElement("div");
    el.style.width = "22px";
    el.style.height = "22px";
    el.style.borderRadius = "9999px";
    el.style.background = "#60a5fa";
    el.style.border = "2px solid white";
    el.style.boxShadow = "0 6px 16px rgba(0,0,0,0.35)";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.cursor = "pointer";
    el.innerHTML = `<span style="color:white;font-weight:700;font-size:12px;">P</span>`;
    return el;
  };

const TimePicker: React.FC<{ initialTime: Date; onTimeChange: (time: Date) => void; }> = ({ initialTime, onTimeChange }) => {
    const [hour, setHour] = useState(initialTime.getHours() % 12 || 12);
    const [minute, setMinute] = useState(initialTime.getMinutes());
    const [amPm, setAmPm] = useState(initialTime.getHours() >= 12 ? 'PM' : 'AM');

    const updateTime = (h: number, m: number, ap: 'AM' | 'PM') => {
        const newDate = new Date();
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

const PingModal: React.FC<{ isOpen: boolean; onClose: () => void; onPing: (departure: Date | null) => void; }> = ({ isOpen, onClose, onPing }) => {
    const [view, setView] = useState<'main' | 'timePicker'>('main');
    const [departureTime, setDepartureTime] = useState(new Date(Date.now() + 5 * 60_000));
    const [pingType, setPingType] = useState<'now' | 'later'>('now');

    const handleSetTime = () => {
        onPing(pingType === 'now' ? null : departureTime);
    };
    
    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#1c1c1e] rounded-3xl p-6 w-full max-w-sm text-white border border-white/10">
                <div className="flex justify-end"><button onClick={onClose}><X size={20} className="text-gray-400" /></button></div>
                {view === 'main' ? (
                    <>
                        <div className="text-center">
                            <img src="/assets/Parqueen_Logo.png" alt="ParkQueen Logo" className="w-16 h-16 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold">Ping spot</h2>
                            <p className="text-sm text-blue-400">BROADCASTING LIVE</p>
                        </div>
                        <div className="my-8 space-y-4">
                            <div onClick={() => setPingType('now')} className={`rounded-lg p-4 flex items-center gap-4 cursor-pointer ${pingType === 'now' ? 'bg-blue-500/30 border border-blue-400' : 'bg-gray-700/50 border border-gray-600'}`}>
                                <Clock size={24} />
                                <div><h3 className="font-bold">Leaving Now</h3><p className="text-xs text-gray-300">IMMEDIATE SPOT</p></div>
                            </div>
                            <div onClick={() => setView('timePicker')} className={`rounded-lg p-4 flex items-center gap-4 cursor-pointer ${pingType === 'later' ? 'bg-blue-500/30 border border-blue-400' : 'bg-gray-700/50 border border-gray-600'}`}>
                                <Calendar size={24} />
                                <div><h3 className="font-bold">Later Today</h3><p className="text-xs text-gray-300">{pingType === 'later' ? departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'SCHEDULED SPOT'}</p></div>
                            </div>
                        </div>
                        <button onClick={handleSetTime} className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"><MapPin size={20} /><span>PING</span></button>
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
  setView: (view: AppView) => void;
  onMessageUser: (userId: string, context?: any) => void;
}

export const MapView: React.FC<MapViewProps> = ({ setView, onMessageUser }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const spotMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
    const [selectedItem, setSelectedItem] = useState<StreetSpot | null>(null);
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isPinging, setIsPinging] = useState(false);
    const [showPingConfirmation, setShowPingConfirmation] = useState(false);
    const [isPingModalOpen, setPingModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [results, setResults] = useState<Array<{id:string; title:string; subtitle:string; center:[number,number]}>>([]);
    const [loading, setLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const tempMarkerRef = useRef<mapboxgl.Marker | null>(null);

    useEffect(() => {
        const auth = getAuth();
        onAuthStateChanged(auth, setCurrentUser);
    }, []);

    useEffect(() => {
        if (!MAPBOX_TOKEN) {
            setError("VITE_MAPBOX_TOKEN is not set.");
            return;
        }
        mapboxgl.accessToken = MAPBOX_TOKEN;
        if (!mapContainerRef.current || mapRef.current) return;
        const map = new mapboxgl.Map({ container: mapContainerRef.current, style: 'mapbox://styles/mapbox/dark-v11', center: NYC_CENTER, zoom: 14, attributionControl: false });
        mapRef.current = map;
        map.on('load', () => setMapLoaded(true));
        return () => { map.remove(); mapRef.current = null; };
    }, []);

    useEffect(() => {
        if (!db || !mapLoaded) return;

        const q = query(collection(db, "spots"), orderBy("reportedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const map = mapRef.current;
            if (!map) return;

            const activeSpots: Record<string, StreetSpot> = {};

            snapshot.forEach(doc => {
                const spot = { id: doc.id, ...doc.data() } as StreetSpot;
                const expiresAtMs = spot.expiresAt?.toMillis?.() ?? 0;
                if (expiresAtMs > Date.now()) {
                    activeSpots[spot.id] = spot;
                }
            });

            // Reconciliation
            const currentMarkerIds = Object.keys(spotMarkersRef.current);

            // Remove old markers
            currentMarkerIds.forEach(id => {
                if (!activeSpots[id]) {
                    spotMarkersRef.current[id].remove();
                    delete spotMarkersRef.current[id];
                }
            });

            // Add or update markers
            Object.values(activeSpots).forEach(spot => {
                const { id, lat, lng } = spot;
                if (spotMarkersRef.current[id]) {
                    spotMarkersRef.current[id].setLngLat([lng, lat]);
                } else {
                    const el = createPingMarkerEl();
                    const marker = new mapboxgl.Marker(el)
                        .setLngLat([lng, lat])
                        .addTo(map);
                    spotMarkersRef.current[id] = marker;
                }
            });
        });

        return () => unsubscribe();
    }, [mapLoaded]);

    useEffect(() => {
        if (abortRef.current) abortRef.current.abort();
        if (searchQuery.length < 2) {
            setResults([]);
            setLoading(false);
            setSearchError(null);
            return;
        }
        const controller = new AbortController();
        abortRef.current = controller;
        const timeoutId = setTimeout(() => {
            setLoading(true);
            setSearchError(null);
            const query = encodeURIComponent(searchQuery);
            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?autocomplete=true&limit=5&types=place,locality,address,poi&language=en&access_token=${MAPBOX_TOKEN}`, { signal: controller.signal })
                .then(res => res.json())
                .then(data => {
                    setResults(data.features.map((f: any) => ({ id: f.id, title: f.text, subtitle: f.place_name.replace(`${f.text}, `, ''), center: f.center })));
                })
                .catch(err => { if (err.name !== 'AbortError') setSearchError("Failed to fetch suggestions."); })
                .finally(() => setLoading(false));
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const handleSelect = (r: any) => {
        setSearchQuery(r.title);
        setResults([]);
        setSearchOpen(false);
        inputRef.current?.blur();
        const map = mapRef.current;
        if (!map) return;
        map.easeTo({ center: r.center, zoom: 15, duration: 1200 });
        tempMarkerRef.current?.remove();
        tempMarkerRef.current = new mapboxgl.Marker().setLngLat(r.center).addTo(map);
    };

    const handleCancelSearch = () => {
        setSearchQuery("");
        setResults([]);
        setSearchOpen(false);
        setSearchError(null);
        tempMarkerRef.current?.remove();
        inputRef.current?.blur();
    };
    
    const handlePingSpot = async (departureTime: Date | null) => {
        if (isPinging || !currentUser) return;
        const map = mapRef.current;
        if (!map) {
            setError("Map not ready to ping spot.");
            return;
        }

        setIsPinging(true);
        setPingModalOpen(false);

        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true }));
            const { longitude, latitude } = position.coords;
            
            const pingData = {
                lat: latitude,
                lng: longitude,
                type: 'free',
                status: 'available',
                finderId: currentUser.uid,
                finderName: currentUser.displayName || 'Anonymous',
                reportedAt: departureTime ? Timestamp.fromDate(departureTime) : serverTimestamp(),
                expiresAt: Timestamp.fromMillis((departureTime?.getTime() || Date.now()) + 60_000 * 5),
            };

            if (db) {
                await addDoc(collection(db, "spots"), pingData);
                setShowPingConfirmation(true);
                setTimeout(() => setShowPingConfirmation(false), 4000);
            }
        } catch (e: any) {
            setError(`Could not ping spot: ${e.message}`);
        } finally {
            setIsPinging(false);
        }
    };

    const handleLocateMe = () => {
        const map = mapRef.current;
        if (!map) return;
    
        navigator.geolocation.getCurrentPosition(
            (p) => {
                const userLngLat: [number, number] = [p.coords.longitude, p.coords.latitude];
                map.flyTo({ center: userLngLat, zoom: 16 });
    
                if (userMarkerRef.current) {
                    userMarkerRef.current.setLngLat(userLngLat);
                } else {
                    const el = createUserMarkerEl();
                    userMarkerRef.current = new mapboxgl.Marker(el)
                        .setLngLat(userLngLat)
                        .addTo(map);
                }
            },
            () => setError("Could not get your location."),
            { enableHighAccuracy: true }
        );
    };

    return (
        <div className="sp-page">
            <PingModal isOpen={isPingModalOpen} onClose={() => setPingModalOpen(false)} onPing={handlePingSpot} />
            <div ref={mapContainerRef} className="sp-map" onClick={() => { if(searchOpen) handleCancelSearch(); setSelectedItem(null); }} />
            
            {error && (
                 <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/80 backdrop-blur-md text-white font-bold py-3 px-6 rounded-lg flex items-center gap-4 shadow-lg">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="p-1 -mr-2"><X size={18} /></button>
                </div>
            )}
            {showPingConfirmation && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-green-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg"><Check size={20} /><span>Spot pinged successfully!</span></div>
            )}

            <div className="sp-overlay flex flex-col justify-between p-3 pointer-events-none">
                <header style={{ paddingTop: 'env(safe-area-inset-top)' }} className="w-full flex flex-col items-center gap-2 pointer-events-auto">
                    <div className="w-full flex items-start gap-2 max-w-md">
                        <div className={`relative flex-1 bg-black/70 backdrop-blur-xl rounded-full flex items-center h-14 px-4 shadow-lg border border-white/10 transition-all duration-300 ease-out ${searchOpen ? 'ring-2 ring-blue-500/90' : ''}`}>
                            {!searchOpen && <img src={`https://i.pravatar.cc/150?u=${currentUser?.uid || 'guest'}`} className="w-9 h-9 rounded-full shrink-0 transition-all duration-300" />} 
                            <div className="flex-1 mx-3 flex items-center gap-2">
                               <Search size={22} className={`text-gray-400 transition-all duration-300 ${searchOpen ? 'text-blue-400' : ''}`} />
                               <input 
                                    ref={inputRef}
                                    type="text" 
                                    placeholder="Search for a place or address"
                                    className="bg-transparent outline-none text-white w-full h-full text-base"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setSearchOpen(true)}
                               />
                            </div>
                            {!searchOpen && <div className="flex items-center gap-4 text-gray-400"><List size={22} className="cursor-pointer" onClick={() => setView(AppView.GARAGE_LIST)} /><Camera size={22} className="cursor-pointer" onClick={() => setView(AppView.AI_ASSISTANT)} /><MessageCircle size={22} className="cursor-pointer" onClick={() => setView(AppView.MESSAGES)} /><Bell size={22} className="cursor-pointer" onClick={() => setView(AppView.NOTIFICATIONS)} /></div>}
                        </div>
                        {searchOpen && <button onClick={handleCancelSearch} className="text-white font-semibold px-4 h-14 bg-black/50 backdrop-blur-md rounded-full">Cancel</button>}
                    </div>
                    
                    {searchOpen && (results.length > 0 || loading || searchError) && (
                        <div className="w-full max-w-md mt-2 bg-dark-900/80 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden z-50">
                            <div className="max-h-[280px] overflow-y-auto">
                                {loading && <div className="flex justify-center items-center p-4"><Loader className="animate-spin text-gray-400"/></div>}
                                {searchError && <div className="text-red-400 p-4 text-center">{searchError}</div>}
                                {results.map(r => (
                                    <div key={r.id} onClick={() => handleSelect(r)} className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/10 border-b border-white/5 last:border-b-0">
                                        <MapPin size={24} className="text-gray-500 shrink-0" />
                                        <div>
                                            <h3 className="font-semibold text-white">{r.title}</h3>
                                            <p className="text-sm text-gray-400">{r.subtitle}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </header>
                {!selectedItem && !searchOpen && (
                     <footer className="w-full flex justify-center pointer-events-auto" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                        <div className="relative w-full max-w-md">
                            <button onClick={() => setPingModalOpen(true)} disabled={!currentUser || isPinging} className="bg-blue-500 text-white rounded-full flex items-center justify-center gap-3 px-8 py-4 font-bold text-base shadow-lg shadow-blue-500/50 absolute bottom-0 left-1/2 -translate-x-1/2 disabled:opacity-50">
                                {isPinging ? <Loader className="animate-spin" size={20} /> : <MapPin size={20} />}<span>{isPinging ? 'PINGING...' : 'PING SPOT'}</span>
                            </button>
                            <button onClick={handleLocateMe} className="absolute bottom-0 right-0 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-xl"><Locate size={24} /></button>
                        </div>
                    </footer>
                )}
            </div>
        </div>
    );
};
