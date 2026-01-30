
import React, { useState, useEffect, useRef } from 'react';
import { StreetSpot, AppView } from '../types';
import { MapPin, Check, Locate, Loader2, List, Camera, MessageCircle, Bell, Crown } from 'lucide-react';
import { db } from '../firebase';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = 'pk.eyJ1IjoicGFycXVlZW4iLCJhIjoiY21rbGE4eWp3MDJ4ZzNmb3NkcHc1enpxYSJ9.RUGhWSWJR7mS0nSyk2U17w';
const NYC_CENTER: [number, number] = [-73.9712, 40.7831];

const MOCK_PINGS: StreetSpot[] = [
  { id: 'demo1', lat: 40.7842, lng: -73.9725, type: 'free', status: 'available', finderName: 'James', finderId: 'other', reportedAt: new Date() },
];

const createMarkerElement = (isMine: boolean) => {
  const el = document.createElement('div');
  const color = isMine ? '#3B82F6' : '#9CA3AF'; // Blue-500 and Gray-400
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

interface MapViewProps {
  onMessageUser: (userId: string, context: string) => void;
  setView: (view: AppView) => void;
}

export const MapView: React.FC<MapViewProps> = ({ onMessageUser, setView }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [spots, setSpots] = useState<StreetSpot[]>([]);
  const spotMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [selectedItem, setSelectedItem] = useState<StreetSpot | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(!db);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [showPingConfirmation, setShowPingConfirmation] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, setCurrentUser);
  }, []);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: NYC_CENTER,
      zoom: 14,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on('load', handleLocateMe);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!db) {
      setIsDemoMode(true);
      setSpots(MOCK_PINGS);
      return;
    }
    const q = query(collection(db, "spots"), orderBy("reportedAt", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSpots: StreetSpot[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, reportedAt: (data.reportedAt as Timestamp)?.toDate() } as StreetSpot;
      });
      setSpots(fetchedSpots);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const oneMinuteAgo = Date.now() - 60 * 1000;
      setSpots(currentSpots => 
        currentSpots.filter(spot => spot.reportedAt && spot.reportedAt.getTime() > oneMinuteAgo)
      );
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !currentUser) return;

    const newMarkers = new Map<string, mapboxgl.Marker>();
    const currentMarkerIds = spots.map(s => s.id);

    // Add or update markers
    spots.forEach(spot => {
      if (spotMarkersRef.current.has(spot.id)) {
        newMarkers.set(spot.id, spotMarkersRef.current.get(spot.id)!);
        spotMarkersRef.current.delete(spot.id);
      } else {
        const el = createMarkerElement(spot.finderId === currentUser.uid);
        const marker = new mapboxgl.Marker(el)
          .setLngLat([spot.lng, spot.lat])
          .addTo(mapRef.current!)

        marker.getElement().addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedItem(spot);
          mapRef.current?.flyTo({ center: [spot.lng, spot.lat], zoom: 16 });
        });
        newMarkers.set(spot.id, marker);
      }
    });

    // Remove old markers that are no longer in the spots list
    spotMarkersRef.current.forEach((marker, id) => {
        marker.remove();
    });

    spotMarkersRef.current = newMarkers;

  }, [spots, currentUser]);

  useEffect(() => {
    if (userMarkerRef.current) userMarkerRef.current.remove();
    if (mapRef.current && userLocation) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
            <div class="absolute w-11 h-11 bg-blue-500/20 rounded-full animate-pulse"></div>
            <div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
            </div>
        </div>
      `;
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

  const handlePingSpot = () => {
    if (isPinging || !currentUser) return;
    setIsPinging(true);
    navigator.geolocation.getCurrentPosition(async (p) => {
      const newLocation: [number, number] = [p.coords.longitude, p.coords.latitude];
      setUserLocation(newLocation);
      mapRef.current?.flyTo({ center: newLocation, zoom: 16 });
      if (db) {
        await addDoc(collection(db, "spots"), {
          lat: newLocation[1], lng: newLocation[0],
          type: 'free', status: 'available', finderId: currentUser.uid,
          finderName: 'Anonymous', reportedAt: serverTimestamp(),
        });
        setShowPingConfirmation(true);
        setTimeout(() => setShowPingConfirmation(false), 4000);
      }
      setIsPinging(false);
    }, (error) => {
      console.error("Error pinging spot:", error);
      setIsPinging(false);
    });
  };

  return (
    <div className="sp-page relative bg-black overflow-hidden h-full w-full">
      <div ref={mapContainerRef} className="absolute inset-0 z-0" onClick={() => setSelectedItem(null)} />
      {showPingConfirmation && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-green-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-lg">
              <Check size={20} /><span>Spot PINGed successfully!</span>
          </div>
      )}
      <div className="sp-overlay absolute inset-0 z-10 flex flex-col justify-between p-3 pointer-events-none">
        <header style={{ paddingTop: 'env(safe-area-inset-top)' }} className="pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-md rounded-full flex items-center h-14 px-4 shadow-lg border border-white/10">
            <img src={`https://i.pravatar.cc/150?u=${currentUser?.uid || 'guest'}`} className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1 mx-3"><input type="text" placeholder="Search..." className="bg-transparent outline-none text-white w-full" /></div>
            <div className="flex items-center gap-4 text-gray-400"><List size={22} /><Camera size={22} /><MessageCircle size={22} /><Bell size={22} /></div>
          </div>
        </header>
        {!selectedItem && (
          <footer className="w-full flex justify-center pointer-events-auto" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="relative w-full max-w-md">
                <button onClick={handlePingSpot} disabled={isPinging || !currentUser} className="bg-blue-500 text-white rounded-full flex items-center justify-center gap-3 px-8 py-4 font-bold text-base shadow-lg shadow-blue-500/50 absolute bottom-0 left-1/2 -translate-x-1/2 disabled:opacity-50">
                  {isPinging ? <Loader2 size={20} className="animate-spin" /> : <MapPin size={20} />}<span>{isPinging ? 'PINGING...' : 'PING SPOT'}</span>
                </button>
                <button onClick={handleLocateMe} className="absolute bottom-0 right-0 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-xl"><Locate size={24} /></button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};