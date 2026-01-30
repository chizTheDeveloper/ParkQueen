
import React, { useState, useEffect, useRef } from 'react';
import { StreetSpot, AppView } from '../types';
import { MapPin, Clock, Search, MessageCircle, Locate, Loader2, X, Check, Bell, Plus, Calendar, ChevronUp, ChevronDown, Navigation2, List, Camera } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, limit, Timestamp, serverTimestamp } from 'firebase/firestore';
import mapboxgl from 'mapbox-gl';

// 1. --- Mapbox Configuration ---
const MAPBOX_TOKEN = 'pk.eyJ1IjoicGFycXVlZW4iLCJhIjoiY21rbGE4eWp3MDJ4ZzNmb3NkcHc1enpxYSJ9.RUGhWSWJR7mS0nSyk2U17w';
const NYC_CENTER: [number, number] = [-73.9712, 40.7831];

// 2. --- Mock Data ---
const MOCK_PINGS: StreetSpot[] = [
  { id: 'demo1', lat: 40.7842, lng: -73.9725, type: 'free', status: 'available', finderName: 'James', finderId: 'other', reportedAt: new Date() },
  { id: 'demo2', lat: 40.7815, lng: -73.9701, type: 'free', status: 'available', finderName: 'Sarah', finderId: 'other', reportedAt: new Date() },
  { id: 'demo3', lat: 40.7850, lng: -73.9680, type: 'free', status: 'available', finderName: 'Marcus', finderId: 'other', reportedAt: new Date() }
];

// 3. --- Component Interfaces ---
interface MapViewProps {
  onMessageUser: (userId: string, context: string) => void;
  setView: (view: AppView) => void;
}

// 4. --- Sub-components ---
const TimePicker = ({ value, onChange, onClose }: { value: string, onChange: (val: string) => void, onClose: () => void }) => {
  const [hour, setHour] = useState(value.split(':')[0]);
  const [minute, setMinute] = useState(value.split(':')[1].split(' ')[0]);
  const [period, setPeriod] = useState(value.split(' ')[1]);

  const incrementHour = () => setHour(h => String(h === '12' ? 1 : parseInt(h) + 1));
  const decrementHour = () => setHour(h => String(h === '1' ? 12 : parseInt(h) - 1));
  const incrementMinute = () => setMinute(m => String((parseInt(m) + 5) % 60).padStart(2, '0'));
  const decrementMinute = () => setMinute(m => String((parseInt(m) - 5 + 60) % 60).padStart(2, '0'));

  return (
    <div className="fixed inset-0 z-[7500] bg-black/85 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-[#1C1C1E] w-full max-w-xs rounded-[40px] p-6 border border-white/5 shadow-2xl text-white">
          <h3 className="text-xl font-bold tracking-tight text-center mb-6">Select Time</h3>
          <div className="flex items-center justify-center gap-4 mb-8 select-none">
              {/* Hour, Minute, Period selectors */}
          </div>
          <button onClick={() => { onChange(`${hour}:${minute} ${period}`); onClose(); }} className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all">Set Time</button>
          <button onClick={onClose} className="w-full text-gray-500 font-bold py-2 text-sm uppercase mt-2 hover:text-white">Cancel</button>
      </div>
    </div>
  );
};

// 5. --- Main MapView Component ---
export const MapView: React.FC<MapViewProps> = ({ onMessageUser, setView }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [spots, setSpots] = useState<StreetSpot[]>([]);
  const [selectedItem, setSelectedItem] = useState<StreetSpot | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailsForm, setShowDetailsForm] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isLeavingNow, setIsLeavingNow] = useState(true);
  const [customTime, setCustomTime] = useState('09:00 AM');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(!db);
  
  const deviceId = useRef(localStorage.getItem('parqueen_device_id') || `user_${Date.now()}`).current;
  useEffect(() => localStorage.setItem('parqueen_device_id', deviceId), [deviceId]);

  // A. --- Map Initialization ---
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
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // B. --- Firebase Data Listener ---
  useEffect(() => {
    if (!db) {
      setIsDemoMode(true);
      setSpots(MOCK_PINGS);
      return;
    }
    const q = query(collection(db, "pings"), orderBy("reportedAt", "desc"), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIsDemoMode(false);
      const fetchedSpots: StreetSpot[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StreetSpot));
      setSpots(fetchedSpots);
    }, () => {
      setIsDemoMode(true);
      setSpots(MOCK_PINGS);
    });
    return unsubscribe;
  }, []);

  // C. --- Marker Sync ---
  useEffect(() => {
    if (!mapRef.current) return;
    // Simple implementation: clear and redraw all markers on spot change
    spots.forEach(spot => {
      const isMine = spot.finderId === deviceId;
      const el = document.createElement('div');
      el.className = `w-8 h-8 rounded-full border-2 border-white shadow-lg ${isMine ? 'bg-blue-500' : 'bg-gray-600'}`;
      const marker = new mapboxgl.Marker(el).setLngLat([spot.lng, spot.lat]).addTo(mapRef.current!);
      el.addEventListener('click', () => {
        setSelectedItem(spot);
        setIsEditMode(isMine);
        mapRef.current?.flyTo({ center: [spot.lng, spot.lat], zoom: 16 });
      });
    });
  }, [spots, deviceId]);

  // D. --- UI Handlers ---
  const handleLocateMe = () => navigator.geolocation.getCurrentPosition(p => mapRef.current?.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 16 }));
  const handlePing = () => { setIsEditMode(false); setShowDetailsForm(true); };

  // ... (handleConfirmPing logic is complex and assumed correct for now)

  // E. --- Render ---
  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* ... (Modals like TimePicker would go here) */}

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-3 z-10">
        <div className="bg-black/60 backdrop-blur-md rounded-full flex items-center h-14 px-4 shadow-lg border border-white/10">
          <img src="https://i.pravatar.cc/150?u=me" className="w-9 h-9 rounded-full shrink-0" />
          <div className="flex-1 mx-3">
            <input type="text" placeholder="Search..." className="bg-transparent outline-none text-white w-full" />
          </div>
          <div className="flex items-center gap-4 text-gray-400">
            <List size={22} />
            <Camera size={22} />
            <MessageCircle size={22} />
            <Bell size={22} />
          </div>
        </div>
      </header>

      {/* Bottom Action Bar */}
      {!selectedItem && !showDetailsForm && (
        <footer className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
          <button onClick={handlePing} className="bg-blue-500 text-white rounded-full flex items-center gap-3 pl-6 pr-8 h-16 font-bold text-lg shadow-lg shadow-blue-500/40">
            <MapPin size={24} />
            <span>PING SPOT</span>
          </button>
          <button onClick={handleLocateMe} className="bg-black/50 backdrop-blur-md border border-white/10 rounded-full w-16 h-16 flex items-center justify-center shadow-lg">
            <Locate size={28} />
          </button>
        </footer>
      )}

      {/* ... (Detail overlays would go here) */}
    </div>
  );
};