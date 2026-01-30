
import React, { useState, useEffect, useRef } from 'react';
import { StreetSpot, AppView } from '../types';
import { MapPin, Clock, Search, MessageCircle, Locate, Loader2, X, Check, Bell, Plus, Calendar, ChevronUp, ChevronDown, Navigation2, List, Camera, Crown } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, limit, Timestamp, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = 'pk.eyJ1IjoicGFycXVlZW4iLCJhIjoiY21rbGE4eWp3MDJ4ZzNmb3NkcHc1enpxYSJ9.RUGhWSWJR7mS0nSyk2U17w';
const NYC_CENTER: [number, number] = [-73.9712, 40.7831];

const MOCK_PINGS: StreetSpot[] = [
  { id: 'demo1', lat: 40.7842, lng: -73.9725, type: 'free', status: 'available', finderName: 'James', finderId: 'other', reportedAt: new Date() },
  { id: 'demo2', lat: 40.7815, lng: -73.9701, type: 'free', status: 'available', finderName: 'Sarah', finderId: 'other', reportedAt: new Date() },
  { id: 'demo3', lat: 40.7850, lng: -73.9680, type: 'free', status: 'available', finderName: 'Marcus', finderId: 'other', reportedAt: new Date() }
];

interface MapViewProps {
  onMessageUser: (userId: string, context: string) => void;
  setView: (view: AppView) => void;
}

export const MapView: React.FC<MapViewProps> = ({ onMessageUser, setView }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [spots, setSpots] = useState<StreetSpot[]>([]);
  const [selectedItem, setSelectedItem] = useState<StreetSpot | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(!db);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const deviceId = useRef(localStorage.getItem('parqueen_device_id') || `user_${Date.now()}`).current;

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
    
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapContainerRef.current);

    return () => {
        resizeObserver.disconnect();
        map.remove();
        mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!db) {
      setIsDemoMode(true);
      setSpots(MOCK_PINGS);
      return;
    }
    const q = query(collection(db, "pings"), orderBy("reportedAt", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSpots: StreetSpot[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StreetSpot));
      setSpots(fetchedSpots);
    }, () => setSpots(MOCK_PINGS));
    return unsubscribe;
  }, []);

  useEffect(() => {
    spots.forEach(spot => {
      const isMine = spot.finderId === deviceId;
      if(isMine) return;

      const el = document.createElement('div');
      el.className = `w-8 h-8 rounded-full border-2 border-white shadow-lg bg-gray-600`;
      new mapboxgl.Marker(el)
        .setLngLat([spot.lng, spot.lat])
        .addTo(mapRef.current!)
        .getElement().addEventListener('click', () => {
          setSelectedItem(spot);
          mapRef.current?.flyTo({ center: [spot.lng, spot.lat], zoom: 16 });
        });
    });
  }, [spots, deviceId]);

  useEffect(() => {
    if (userMarkerRef.current) {
        userMarkerRef.current.remove();
    }
    if (mapRef.current && userLocation) {
        const el = document.createElement('div');
        el.className = 'user-marker';
        el.innerHTML = `
            <div class="relative flex items-center justify-center">
                <div class="absolute w-11 h-11 bg-blue-500/20 rounded-full animate-pulse"></div>
                <div class="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-crown"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>
                </div>
            </div>
        `;
        userMarkerRef.current = new mapboxgl.Marker(el)
            .setLngLat(userLocation)
            .addTo(mapRef.current);
    }
  }, [userLocation]);

  const handleLocateMe = () => navigator.geolocation.getCurrentPosition(p => {
      const newLocation: [number, number] = [p.coords.longitude, p.coords.latitude];
      setUserLocation(newLocation);
      mapRef.current?.flyTo({ center: newLocation, zoom: 16 });
  });

  return (
    <div className="sp-page relative bg-black overflow-hidden h-full w-full">
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />
      <div className="sp-overlay absolute inset-0 z-10 flex flex-col justify-between p-3">
        
        <header style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="bg-black/60 backdrop-blur-md rounded-full flex items-center h-14 px-4 shadow-lg border border-white/10">
            <img src="https://i.pravatar.cc/150?u=me" className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1 mx-3 pointer-events-auto">
              <input type="text" placeholder="Search..." className="bg-transparent outline-none text-white w-full" />
            </div>
            <div className="flex items-center gap-4 text-gray-400">
              <List size={22} /><Camera size={22} /><MessageCircle size={22} /><Bell size={22} />
            </div>
          </div>
        </header>

        {!selectedItem && (
          <footer className="w-full flex justify-center" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="relative w-full max-w-md">
                <button className="bg-blue-500 text-white rounded-full flex items-center gap-3 px-8 py-4 font-bold text-base shadow-lg shadow-blue-500/50 absolute bottom-0 left-1/2 -translate-x-1/2">
                  <MapPin size={20} />
                  <span>PING SPOT</span>
                </button>
                <button onClick={handleLocateMe} className="absolute bottom-0 right-0 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-xl">
                  <Locate size={24} />
                </button>
            </div>
          </footer>
        )}

      </div>
    </div>
  );
};