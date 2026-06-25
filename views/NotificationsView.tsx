import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface NotificationsViewProps {
  user: any;
  onBack: () => void;
}

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

export const NotificationsView: React.FC<NotificationsViewProps> = ({ user, onBack }) => {
  const [spots, setSpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [addresses, setAddresses] = useState<Record<string, string>>({});

  // 1. Get user's current geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.warn("Could not get location for distance calculation", error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // 2. Query active spots from Firestore
  useEffect(() => {
    if (!db) return;
    const now = Timestamp.now();
    const q = query(
      collection(db, "spots"),
      where("expiresAt", ">", now)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeSpots = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as any[];

      // Sort descending by reportedAt time
      activeSpots.sort((a, b) => {
        const timeA = a.reportedAt?.toMillis() || 0;
        const timeB = b.reportedAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setSpots(activeSpots);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to spots:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 3. Geocode spots to get real street addresses using Mapbox API
  useEffect(() => {
    if (spots.length === 0 || !MAPBOX_TOKEN) return;

    spots.forEach(async (spot) => {
      const cacheKey = `${spot.lat},${spot.lng}`;
      if (addresses[cacheKey]) return; // already geocoded

      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${spot.lng},${spot.lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const address = data.features[0].place_name;
          setAddresses((prev) => ({ ...prev, [cacheKey]: address }));
        } else {
          setAddresses((prev) => ({ ...prev, [cacheKey]: `${spot.lat.toFixed(4)}, ${spot.lng.toFixed(4)}` }));
        }
      } catch (err) {
        console.warn("Mapbox geocoding error:", err);
      }
    });
  }, [spots, addresses]);

  return (
    <div className="h-full bg-[var(--color-bg)] flex flex-col pt-4">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-[var(--color-border)]">
        <button 
          onClick={onBack} 
          className="p-2 -ml-2 text-[var(--color-text)] hover:bg-white/5 rounded-full transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-[var(--color-text)]">Notifications</h1>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {loading ? (
          <div className="flex justify-center p-10">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : spots.length === 0 ? (
          <div className="text-center p-10 text-gray-500">
            <p>No active parking alerts near you.</p>
          </div>
        ) : (
          spots.map((spot, index) => {
            const cacheKey = `${spot.lat},${spot.lng}`;
            const address = addresses[cacheKey] || "Resolving address...";
            
            let distanceStr = "";
            let isNear = false;
            
            if (userLocation) {
              const distanceKm = getDistance(userLocation[0], userLocation[1], spot.lat, spot.lng);
              isNear = distanceKm <= 2.0; // Mark as near if within 2km
              if (distanceKm < 1.0) {
                distanceStr = `${Math.round(distanceKm * 1000)} m`;
              } else {
                distanceStr = `${distanceKm.toFixed(1)} km`;
              }
            }

            return (
              <div 
                key={spot.id} 
                className={`flex items-start gap-4 p-4 border-b border-[var(--color-border)] hover:bg-white/5/50 transition-colors cursor-pointer ${
                  index % 2 === 0 ? 'bg-[var(--color-bg)]' : 'bg-[var(--color-surface)]'
                }`}
              >
                {/* Map Pin Icon Container */}
                <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-[var(--color-border)] shadow-sm bg-blue-900/20 flex items-center justify-center text-blue-400">
                  <MapPin size={24} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-1 mb-1">
                    <span className="font-bold text-[var(--color-text)] text-sm leading-tight">
                      {spot.finderName || "Someone"}
                    </span>
                    <span className="text-[var(--color-text-secondary)] text-sm leading-tight">
                      pinged a {spot.type} spot
                    </span>
                  </div>
                  
                  <div className="text-queen-400 text-xs font-bold mb-1 tracking-wide">
                    {isNear ? "Near you" : "Parking Alert"}
                  </div>
                  
                  <div className="text-gray-500 text-xs truncate">
                    {address}
                  </div>
                </div>

                {/* Distance */}
                {distanceStr && (
                  <div className="text-[var(--color-text-secondary)] text-xs font-medium whitespace-nowrap self-end mb-1">
                    {distanceStr}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
