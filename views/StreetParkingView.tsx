import React, { useState, useEffect, useRef } from 'react';
import { StreetSpot, AppView } from '../types';
import { MapPin, Clock, Search, MessageCircle, Locate, Loader2, X, Check, Bell, Plus, Calendar, ChevronUp, ChevronDown, Navigation2, List, Wifi, WifiOff } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, limit, Timestamp, serverTimestamp } from 'firebase/firestore';

declare var L: any;

const NYC_CENTER = [40.7831, -73.9712];

const MOCK_PINGS: StreetSpot[] = [
  { id: 'demo1', lat: 40.7842, lng: -73.9725, type: 'free', status: 'available', finderName: 'James', finderId: 'other', reportedAt: new Date(), leavingAt: new Date(Date.now() + 10 * 60000) },
  { id: 'demo2', lat: 40.7815, lng: -73.9701, type: 'free', status: 'available', finderName: 'Sarah', finderId: 'other', reportedAt: new Date(), leavingAt: new Date(Date.now() + 5 * 60000) },
  { id: 'demo3', lat: 40.7850, lng: -73.9680, type: 'free', status: 'available', finderName: 'Marcus', finderId: 'other', reportedAt: new Date() }
];

interface MapViewProps {
  onMessageUser: (userId: string, context: string) => void;
  setView: (view: AppView) => void;
}

const ParQueenLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pq_grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#22d3ee" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
         <feGaussianBlur stdDeviation="3" result="blur" />
         <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <g filter="url(#glow)">
        <path d="M25 35 L35 50 L50 30 L65 50 L75 35 L80 25 L50 0 L20 25 Z" fill="url(#pq_grad)" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M50 120 C50 120 15 85 15 55 C15 30 35 15 50 15 C65 15 85 30 85 55 C85 85 50 120 50 120 Z" fill="url(#pq_grad)" stroke="white" strokeWidth="1.5" />
    </g>
    <path d="M45 40 V 80" stroke="white" strokeWidth="8" strokeLinecap="round" />
    <path d="M45 40 H 55 C 70 40 70 65 55 65 H 45" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TimePicker = ({ value, onChange, onClose }: { value: string, onChange: (val: string) => void, onClose: () => void }) => {
  const [hour, setHour] = useState(value.split(':')[0]);
  const [minute, setMinute] = useState(value.split(':')[1].split(' ')[0]);
  const [period, setPeriod] = useState(value.split(' ')[1]);

  const incrementHour = () => { let h = parseInt(hour); h = h === 12 ? 1 : h + 1; setHour(h.toString()); };
  const decrementHour = () => { let h = parseInt(hour); h = h === 1 ? 12 : h - 1; setHour(h.toString()); };
  const incrementMinute = () => { let m = parseInt(minute); m = (m + 5) % 60; setMinute(m.toString().padStart(2, '0')); };
  const decrementMinute = () => { let m = parseInt(minute); m = (m - 5 + 60) % 60; setMinute(m.toString().padStart(2, '0')); };

  return (
    <div className="fixed inset-0 z-[7500] bg-black/85 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-[#1C1C1E] w-full max-w-xs rounded-[40px] p-6 border border-white/5 shadow-2xl text-white">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-queen-500/10 rounded-full flex items-center justify-center text-queen-400 mb-3 ring-8 ring-queen-500/5"><Clock size={24} /></div>
          <h3 className="text-xl font-black tracking-tight">Time Picker</h3>
        </div>
        <div className="flex items-center justify-center gap-4 mb-8 select-none">
          <div className="flex flex-col items-center gap-1">
             <button onClick={incrementHour} className="p-2 text-gray-600 hover:text-queen-400"><ChevronUp size={20} /></button>
             <div className="w-16 h-20 bg-white/5 rounded-[20px] border border-white/5 flex items-center justify-center"><span className="text-3xl font-black font-mono">{hour}</span></div>
             <button onClick={decrementHour} className="p-2 text-gray-600 hover:text-queen-400"><ChevronDown size={20} /></button>
          </div>
          <div className="text-3xl font-black text-gray-800 pb-2">:</div>
          <div className="flex flex-col items-center gap-1">
             <button onClick={incrementMinute} className="p-2 text-gray-600 hover:text-queen-400"><ChevronUp size={20} /></button>
             <div className="w-16 h-20 bg-white/5 rounded-[20px] border border-white/5 flex items-center justify-center"><span className="text-3xl font-black font-mono">{minute}</span></div>
             <button onClick={decrementMinute} className="p-2 text-gray-600 hover:text-queen-400"><ChevronDown size={20} /></button>
          </div>
          <div className="flex flex-col gap-2 py-2">
             <button onClick={() => setPeriod('AM')} className={`w-12 h-9 rounded-xl font-black text-[10px] border ${period === 'AM' ? 'bg-queen-500 text-white' : 'bg-white/5 text-gray-600'}`}>AM</button>
             <button onClick={() => setPeriod('PM')} className={`w-12 h-9 rounded-xl font-black text-[10px] border ${period === 'PM' ? 'bg-queen-500 text-white' : 'bg-white/5 text-gray-600'}`}>PM</button>
          </div>
        </div>
        <button onClick={() => { onChange(`${hour}:${minute} ${period}`); onClose(); }} className="w-full bg-queen-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-queen-500/20 active:scale-95 transition-all">Set Time</button>
        <button onClick={onClose} className="w-full text-gray-500 font-black py-2 text-[10px] uppercase tracking-widest mt-2 hover:text-white">Cancel</button>
      </div>
    </div>
  );
};

export const MapView: React.FC<MapViewProps> = ({ onMessageUser, setView }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const spotsLayerRef = useRef<any>(null);
  const [spots, setSpots] = useState<StreetSpot[]>(MOCK_PINGS);
  const [selectedItem, setSelectedItem] = useState<{ type: 'street', data: StreetSpot } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailsForm, setShowDetailsForm] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isLeavingNow, setIsLeavingNow] = useState(true);
  const [customTime, setCustomTime] = useState('09:00 AM');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  
  const deviceIdRef = useRef(localStorage.getItem('parqueen_device_id') || `user_${Math.random().toString(36).substr(2, 9)}`);
  useEffect(() => { localStorage.setItem('parqueen_device_id', deviceIdRef.current); }, []);

  // Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapInstance) return;
    const map = L.map(mapContainerRef.current, {
      center: NYC_CENTER,
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
    spotsLayerRef.current = L.layerGroup().addTo(map);
    setMapInstance(map);
    return () => { if (map) { map.remove(); } };
  }, []);

  // Firebase Real-time Listener (Universal)
  useEffect(() => {
    // Detect if database is missing or misconfigured
    if (!db) {
      console.warn("Firestore instance is null. Running in offline/Demo Mode.");
      setIsDemoMode(true);
      setSpots(MOCK_PINGS);
      return;
    }
    
    const q = query(
      collection(db, "pings"),
      orderBy("reportedAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIsDemoMode(false);
      const communitySpots: StreetSpot[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const isMine = data.finderId === deviceIdRef.current;
        return {
          id: doc.id,
          lat: data.lat,
          lng: data.lng,
          type: 'free',
          status: 'available',
          finderName: isMine ? 'You' : (data.finderName || 'Neighbor'),
          finderId: isMine ? 'me' : data.finderId,
          reportedAt: data.reportedAt?.toDate() || new Date(),
          leavingAt: data.leavingAt ? data.leavingAt.toDate() : undefined
        };
      });

      const recentSpots = communitySpots.length > 0 ? communitySpots : MOCK_PINGS;
      setSpots(recentSpots);
    }, (error) => {
      console.warn("Firestore listener restricted (database not found or permission denied). Using Demo Mode.", error);
      setIsDemoMode(true);
      setSpots(MOCK_PINGS);
    });

    return () => unsubscribe();
  }, []);

  // Marker Creator
  const createCustomMarker = (isMine?: boolean) => {
    const color = isMine ? '#3b82f6' : '#475569';
    const crown = isMine ? `
      <div style="position: absolute; top: -18px; z-index: 20; animation: bounce 1s infinite alternate ease-in-out;">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="#fbbf24" stroke="#d97706" stroke-width="1.5">
          <path d="M2 20h20l-3-9-4 5-3-9-3 9-4-5-3 9z"/>
        </svg>
      </div>` : '';

    const htmlString = `
      <div style="position: relative; width: 48px; height: 60px; display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 0 8px ${isMine ? 'rgba(59, 130, 246, 0.4)' : 'rgba(0,0,0,0.4)'});">
        ${crown}
        <div style="width: 36px; height: 36px; background-color: ${color}; border: 3px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 10;">
          <div style="transform: rotate(45deg); color: white; font-weight: 900; font-family: sans-serif; font-size: 14px;">P</div>
        </div>
        <div style="width: 14px; height: 4px; background: rgba(0,0,0,0.4); border-radius: 50%; margin-top: 2px; filter: blur(1.5px);"></div>
      </div>
    `.trim();
    
    return L.divIcon({ className: 'custom-marker', html: htmlString, iconSize: [48, 60], iconAnchor: [24, 52] });
  };

  // Sync Markers to Leaflet
  useEffect(() => {
    if (!mapInstance || !spotsLayerRef.current) return;
    spotsLayerRef.current.clearLayers();
    spots.forEach(spot => {
      const isMine = spot.finderId === 'me' || spot.finderId === deviceIdRef.current;
      const marker = L.marker([spot.lat, spot.lng], { icon: createCustomMarker(isMine) });
      marker.on('click', () => {
        setSelectedItem({ type: 'street', data: spot });
        setIsEditMode(isMine);
        mapInstance.flyTo([spot.lat, spot.lng], 17, { duration: 0.5 });
      });
      marker.addTo(spotsLayerRef.current);
    });
  }, [spots, mapInstance]);

  const handleLocateMe = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      mapInstance?.flyTo([pos.coords.latitude, pos.coords.longitude], 17);
    });
  };

  const handleConfirmPing = async () => {
    setIsBroadcasting(true);
    
    const onLocationSuccess = async (pos: GeolocationPosition) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      let leavingTime = null;
      if (!isLeavingNow) {
        const [time, ampm] = customTime.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        leavingTime = new Date();
        leavingTime.setHours(hours, minutes, 0, 0);
      }

      const newSpot: StreetSpot = {
        id: `temp_${Date.now()}`,
        lat,
        lng,
        type: 'free',
        status: 'available',
        finderName: 'You',
        finderId: 'me',
        reportedAt: new Date(),
        leavingAt: leavingTime || undefined
      };

      try {
        if (!isDemoMode && db) {
          await addDoc(collection(db, "pings"), {
            lat,
            lng,
            reportedAt: serverTimestamp(),
            leavingAt: leavingTime ? Timestamp.fromDate(leavingTime) : null,
            finderId: deviceIdRef.current,
            finderName: 'ParQueen User'
          });
        } else {
          // If in Demo mode or db missing, add to local state only
          setSpots(prev => [newSpot, ...prev]);
        }
      } catch (err) {
        console.error("Broadcast failed, falling back to local storage:", err);
        setSpots(prev => [newSpot, ...prev]);
      }

      setIsBroadcasting(false);
      setShowDetailsForm(false);
      setSelectedItem(null);
      mapInstance?.flyTo([lat, lng], 17, { animate: true });
    };

    navigator.geolocation.getCurrentPosition(onLocationSuccess, (err) => {
      setIsBroadcasting(false);
      alert("Location access is required to ping a spot.");
    }, { enableHighAccuracy: true });
  };

  return (
    <div className="relative h-full w-full bg-[#121212] overflow-hidden">
      {showTimePicker && <TimePicker value={customTime} onChange={setCustomTime} onClose={() => setShowTimePicker(false)} />}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-dark-900" />

      {/* Header UI */}
      <div className="absolute top-0 left-0 right-0 p-4 z-[400] flex flex-col gap-2 bg-gradient-to-b from-dark-900 via-dark-900/40 to-transparent pb-10">
        <div className="flex items-center gap-3">
            <button onClick={() => setView(AppView.PROFILE)} className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden shrink-0 shadow-xl active:scale-95 transition-transform"><img src="https://i.pravatar.cc/150?u=me" alt="User" className="w-full h-full object-cover" /></button>
            <div className="flex-1 relative">
                <div className="bg-dark-800 border border-white/10 rounded-2xl flex items-center h-12 px-3 shadow-lg">
                    <Search className="text-gray-400 shrink-0" size={18} />
                    <input type="text" placeholder="Search NYC..." className="bg-transparent border-none outline-none text-white ml-2 flex-1 text-sm w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    {isDemoMode ? <WifiOff size={14} className="text-yellow-500/50 ml-2" /> : <Wifi size={14} className="text-green-500/50 ml-2" />}
                </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setView(AppView.GARAGE_LIST)} className="w-10 h-10 bg-dark-800/90 rounded-xl flex items-center justify-center text-gray-400 hover:text-white shadow-lg"><List size={18} /></button>
              <button onClick={() => setView(AppView.NOTIFICATIONS)} className="w-10 h-10 bg-queen-500/90 rounded-xl flex items-center justify-center text-white shadow-lg"><Bell size={18} /></button>
            </div>
        </div>
      </div>

      <button onClick={handleLocateMe} className="absolute bottom-6 right-4 w-12 h-12 bg-dark-800/80 backdrop-blur-md border border-white/10 text-white rounded-full flex items-center justify-center z-[400] shadow-xl active:scale-90"><Locate size={22} /></button>

      {/* Main Ping Action */}
      {!selectedItem && !showDetailsForm && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-[400]">
            <button onClick={() => { setIsEditMode(false); setShowDetailsForm(true); }} className="group flex items-center gap-4 bg-gradient-to-b from-queen-400 to-queen-600 text-white pl-4 pr-10 py-3.5 rounded-full shadow-2xl active:scale-95 transition-all">
                <div className="bg-white rounded-full p-2.5 shadow-inner"><MapPin size={24} className="text-queen-500" strokeWidth={3} /></div>
                <span className="font-black tracking-widest text-lg uppercase leading-none mt-0.5">Ping Spot</span>
            </button>
        </div>
      )}

      {/* Detail Form Overlay */}
      {showDetailsForm && (
          <div className="absolute inset-0 z-[5000] bg-dark-900/95 backdrop-blur-md flex flex-col items-center justify-center px-8 animate-in fade-in duration-300">
              <div className="w-full max-w-sm bg-[#18181B] border border-white/5 rounded-[40px] p-8 shadow-2xl relative text-white animate-in zoom-in-95 duration-300">
                  <button onClick={() => setShowDetailsForm(false)} className="absolute top-6 right-6 p-2 bg-white/5 rounded-full text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
                  <div className="flex flex-col items-center text-center mb-8">
                      <div className="mb-6 flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-queen-500/20 blur-2xl rounded-full"></div>
                        {logoError ? <ParQueenLogo className="w-32 h-32" /> : <img src="https://images.squarespace-cdn.com/content/v1/6521f2f9d74b6e6f6d2a2a1f/3556dc1a-8fd2-4920-9014-c27984784ba1/Perqueen+app+Icon.png" alt="ParQueen Logo" className="w-32 h-32 object-contain drop-shadow-2xl" onError={() => setLogoError(true)} />}
                      </div>
                      <h2 className="text-3xl font-black leading-tight mb-1">{isEditMode ? 'Update Pin' : 'Ping Spot'}</h2>
                      <p className="text-queen-400 text-xs font-black uppercase tracking-[0.2em] opacity-80">
                        {isDemoMode ? 'Demo Mode Active' : 'Broadcast Live to NYC'}
                      </p>
                  </div>

                  <div className="space-y-3 mb-8">
                      <button onClick={() => setIsLeavingNow(true)} className={`w-full p-4 rounded-3xl flex items-center gap-4 border-2 transition-all ${isLeavingNow ? 'bg-queen-500/10 border-queen-500 shadow-lg' : 'bg-white/5 border-transparent opacity-60'}`}>
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isLeavingNow ? 'bg-queen-500 text-white shadow-lg shadow-queen-500/30' : 'bg-white/5 text-gray-400'}`}><Clock size={20} strokeWidth={3} /></div>
                          <div className="text-left"><div className="text-base font-black leading-none mb-1">Leaving Now</div><div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Immediate</div></div>
                      </button>
                      <button onClick={() => { setIsLeavingNow(false); setShowTimePicker(true); }} className={`w-full p-4 rounded-3xl flex items-center gap-4 border-2 transition-all ${!isLeavingNow ? 'bg-queen-500/10 border-queen-500 shadow-lg' : 'bg-white/5 border-transparent opacity-60'}`}>
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${!isLeavingNow ? 'bg-queen-500 text-white shadow-lg shadow-queen-500/30' : 'bg-white/5 text-gray-400'}`}><Calendar size={20} strokeWidth={3} /></div>
                          <div className="text-left flex-1"><div className="text-base font-black leading-none mb-1">Later Today</div><div className="text-lg font-mono text-queen-400 font-black">{customTime}</div></div>
                      </button>
                  </div>

                  <button onClick={handleConfirmPing} disabled={isBroadcasting} className="w-full bg-queen-500 text-white font-black py-5 rounded-3xl shadow-xl flex items-center justify-center gap-3 text-sm tracking-widest uppercase hover:bg-queen-600 transition-all active:scale-95 disabled:opacity-70 disabled:grayscale">
                      {isBroadcasting ? <Loader2 className="animate-spin" /> : <><Plus size={20} strokeWidth={4} /> {isEditMode ? 'UPDATE' : 'BROADCAST'}</>}
                  </button>
              </div>
          </div>
      )}

      {/* Selected Item Detail */}
      {selectedItem && (
        <div className="absolute bottom-6 left-4 right-4 bg-dark-800 border border-dark-700 rounded-[40px] p-6 shadow-2xl z-[400] animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="font-black text-2xl text-white mb-1">{selectedItem.data.finderId === 'me' ? 'My Street Spot' : 'Free Street Spot'}</h3>
                    <div className="flex items-center gap-2 text-queen-400 text-xs font-black uppercase tracking-widest opacity-80"><Check size={14} strokeWidth={4} />Verified Spot</div>
                </div>
                <button onClick={() => setSelectedItem(null)} className="p-2 bg-dark-700 rounded-full text-gray-400 hover:text-white transition-colors">&times;</button>
            </div>
            <div className="flex gap-3">
                <button onClick={() => onMessageUser('finder', 'Spot inquiry')} className="flex-1 bg-dark-700 hover:bg-dark-600 text-white font-black py-5 rounded-[24px] flex items-center justify-center gap-2 transition-all active:scale-95"><MessageCircle size={20} /> MESSAGE</button>
                <button className="flex-[2] bg-queen-500 hover:bg-queen-600 text-white font-black py-5 rounded-[24px] shadow-lg shadow-queen-500/20 flex items-center justify-center gap-3 text-lg transition-all active:scale-95"><Navigation2 size={24} className="rotate-45" fill="white" /> NAVIGATE</button>
            </div>
        </div>
      )}
    </div>
  );
};