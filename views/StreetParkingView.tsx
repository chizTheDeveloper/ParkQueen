
import React, { useState, useEffect, useRef } from 'react';
import { StreetSpot, AppView } from '../types';
import { MapPin, Check, Locate, ChevronUp, ChevronDown, List, Camera, MessageSquare, Bell, Clock, Calendar, X, Search } from 'lucide-react';
import { db } from '../firebase';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const NYC_CENTER: [number, number] = [-73.9712, 40.7831];

const createMarkerElement = (isMine: boolean) => {
    const el = document.createElement('div');
    const color = isMine ? '#3B82F6' : '#6B7280'; // Blue-500 and Gray-500
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
    const [departureTime, setDepartureTime] = useState(new Date(Date.now() + 5 * 60_000)); // Default to 5 mins from now
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
    onMessageUser: (userId: string, context: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({ setView, onMessageUser }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const spotMarkersRef = useRef<Record<string, { marker: mapboxgl.Marker; timerId: number | undefined }>>({});
    const [selectedItem, setSelectedItem] = useState<StreetSpot | null>(null);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isPinging, setIsPinging] = useState(false);
    const [showPingConfirmation, setShowPingConfirmation] = useState(false);
    const [isPingModalOpen, setPingModalOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const resizeMap = () => mapRef.current?.resize();

    useEffect(() => {
        const auth = getAuth();
        onAuthStateChanged(auth, setCurrentUser);
    }, []);

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
            handleLocateMe();
            resizeMap();
        });

        return () => {
            map.remove();
            mapRef.current = null;
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
        if (!db || !mapRef.current || !currentUser) return;

        const q = query(collection(db, "spots"), orderBy("reportedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const now = Date.now();
            const activeSpots = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as any))
                .filter(s => s.expiresAt?.toMillis() > now);

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
                    const el = createMarkerElement(s.finderId === currentUser.uid);
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

                    markers[s.id] = { marker, timerId };
                } else {
                    const cur = markers[s.id].marker.getLngLat();
                    if (cur.lng !== s.lng || cur.lat !== s.lat) markers[s.id].marker.setLngLat(lngLat);
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
    }, [currentUser]);

    useEffect(() => {
        if (userMarkerRef.current) userMarkerRef.current.remove();
        if (mapRef.current && userLocation) {
            const el = document.createElement('div');
            el.innerHTML = `<div class="relative flex items-center justify-center"><div class="absolute w-11 h-11 bg-blue-500/20 rounded-full animate-pulse"></div><div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg></div></div>`;
            userMarkerRef.current = new mapboxgl.Marker(el).setLngLat(userLocation).addTo(mapRef.current);
        }
    }, [userLocation]);

    const handleLocateMe = () => {
        navigator.geolocation.getCurrentPosition(p => {
            const newLocation: [number, number] = [p.coords.longitude, p.coords.latitude];
            setUserLocation(newLocation);
            mapRef.current?.flyTo({ center: newLocation, zoom: 16 });
        }, null, { enableHighAccuracy: true });
    };

    const handlePingSpot = (departureTime: Date | null) => {
        if (isPinging || !currentUser) return;
        setIsPinging(true);
        setPingModalOpen(false);
        navigator.geolocation.getCurrentPosition(async (p) => {
            const newLocation: [number, number] = [p.coords.longitude, p.coords.latitude];
            setUserLocation(newLocation);

            const now = Date.now();
            const reportedAt = departureTime ? Timestamp.fromDate(departureTime) : Timestamp.fromMillis(now);
            const expiresAt = Timestamp.fromMillis(reportedAt.toMillis() + 60_000);
            
            const pingData = {
                lat: newLocation[1],
                lng: newLocation[0],
                type: 'free',
                status: 'available',
                finderId: currentUser.uid,
                finderName: 'Anonymous',
                reportedAt,
                expiresAt,
            };

            if (db) {
                await addDoc(collection(db, "spots"), pingData);
                setShowPingConfirmation(true);
                setTimeout(() => setShowPingConfirmation(false), 4000);
            }
            setIsPinging(false);
        }, (error) => {
            console.error("Error pinging spot:", error);
            setIsPinging(false);
        });
    };

    const handleCancelSearch = () => {
        setSearchQuery("");
        setResults([]);
        setSearchOpen(false);
        inputRef.current?.blur();
    };

    return (
        <div className="sp-page">
            <PingModal isOpen={isPingModalOpen} onClose={() => setPingModalOpen(false)} onPing={handlePingSpot} />
            <div ref={mapContainerRef} className="sp-map" onClick={() => setSelectedItem(null)} />
            {showPingConfirmation && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-green-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg"><Check size={20} /><span>spot pinged successfully!</span></div>
            )}
            <div className="sp-overlay flex flex-col justify-between p-3 pointer-events-none">
                <header style={{ paddingTop: 'env(safe-area-inset-top)' }} className="w-full flex items-start gap-2 pointer-events-auto">
                    <div className={`relative flex-1 bg-black/70 backdrop-blur-xl rounded-full flex items-center h-14 px-4 shadow-lg border border-white/10 transition-all duration-300 ease-out ${searchOpen ? 'ring-2 ring-blue-500/90' : 'max-w-md'}`}>
                        {!searchOpen && <img src={`https://i.pravatar.cc/150?u=${currentUser?.uid || 'guest'}`} className="w-9 h-9 rounded-full shrink-0 transition-all duration-300" />} 
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
                        {!searchOpen && <div className="flex items-center gap-4 text-gray-400">
                          <button type="button" aria-label="Listings" onClick={() => setView(AppView.GARAGE_LIST)} className="p-2 text-white/90 hover:text-white"><List size={22} /></button>
                          <button type="button" aria-label="Scanner" onClick={() => setView(AppView.AI_ASSISTANT)} className="p-2 text-white/90 hover:text-white"><Camera size={22} /></button>
                          <button type="button" aria-label="Chat" onClick={() => setView(AppView.MESSAGES)} className="p-2 text-white/90 hover:text-white"><MessageSquare size={22} /></button>
                          <button type="button" aria-label="Notifications" onClick={() => setView(AppView.NOTIFICATIONS)} className="p-2 text-white/90 hover:text-white"><Bell size={22} /></button>
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
                                    center: r.center, // [lng, lat]
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
                {!selectedItem && (
                    <footer className="w-full flex justify-center pointer-events-auto" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
                        <div className="relative w-full max-w-md">
                            <button onClick={() => setPingModalOpen(true)} disabled={!currentUser} className="bg-blue-500 text-white rounded-full flex items-center justify-center gap-3 px-8 py-4 font-bold text-base shadow-lg shadow-blue-500/50 absolute bottom-0 left-1/2 -translate-x-1/2 disabled:opacity-50"><MapPin size={20} /><span>PING SPOT</span></button>
                            <button onClick={handleLocateMe} className="absolute bottom-0 right-0 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-xl"><Locate size={24} /></button>
                        </div>
                    </footer>
                )}
            </div>
        </div>
    );
};
