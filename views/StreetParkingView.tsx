import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppView } from '../types';
import { MapPin, Check, Locate, X, Bell, Clock, ChevronRight, ChevronLeft, Users, Car, Navigation, CheckCircle2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, doc, deleteDoc, writeBatch, updateDoc, getDocs, getDoc, setDoc, where, query, orderBy, startAt, endAt } from 'firebase/firestore';
import { auth } from '../firebaseConfig';
import { detectParkingSide } from '../utils/streetIntelligence';
import { detectCardinalSide } from '../utils/sweepnyc';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import mapboxgl from 'mapbox-gl';
import * as geofire from 'geofire-common';

import { MAPBOX_TOKEN, NYC_CENTER, createMarkerElement, clearRoute, drawRoute, getDistance } from './street-parking/utils';
import { VehicleIcon } from '../utils/vehicleIcon';
import { getTitleForCrowns } from '../utils/crowns';

const reverseGeocode = async (lng: number, lat: number): Promise<string> => {
    try {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address&limit=1&access_token=${MAPBOX_TOKEN}`);
        const json = await res.json();
        return json.features?.[0]?.place_name?.split(',')[0] || '';
    } catch { return ''; }
};
import { MapItem, MapViewProps } from './street-parking/types';
import { SpotModal } from './street-parking/SpotModal';
import { TimePicker } from './street-parking/TimePicker';
import { useSearch } from './street-parking/useSearch';
import { useUnreadMessages } from './street-parking/useUnreadMessages';
import { useSpotData } from './street-parking/useSpotData';
import { useInterestFlow } from './street-parking/useInterestFlow';
import { SpotDetailsCard } from './street-parking/SpotDetailsCard';
import { BottomSheet } from './street-parking/BottomSheet';
import { HandoffFlow } from './street-parking/HandoffFlow';
import { ParkingActivitySheet } from './street-parking/ParkingActivitySheet';
import { HeaderBar } from './street-parking/HeaderBar';
import { StreetIntelligenceCard } from './street-parking/StreetIntelligenceCard';
import { useParkingTimer } from './street-parking/useParkingTimer';


export const MapView: React.FC<MapViewProps> = ({ user, setView, onMessageUser }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const allMarkersRef = useRef<Record<string, mapboxgl.Marker>>({});
    const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const lastParkedMarkerRef = useRef<mapboxgl.Marker | null>(null);
    const activeRouteDestinationRef = useRef<[number, number] | null>(null);

    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [selectedItemManageMode, setSelectedItemManageMode] = useState(false);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [searchCenter, setSearchCenter] = useState<[number, number] | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [searchRadius] = useState<number>(2000);

    const [showFree, setShowFree] = useState(true);
    const [showPaid, setShowPaid] = useState(false);
    const [showPublic, setShowPublic] = useState(false);


    const [isPinging, setIsPinging] = useState(false);
    const [showPingConfirmation, setShowPingConfirmation] = useState(false);
    const [pingError, setPingError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

    const parkingTimer = useParkingTimer();

    const SAVED_SPOT_KEY = 'pq_saved_spot';
    type SavedSpot = {
        lat: number;
        lng: number;
        address: string;
        savedAt: number;
        sessionId: string;        // stable ID for deterministic ping creation
        linkedPingId: string | null; // set after first successful ping — prevents duplicates
        // Street Intelligence — null if no segment matched
        segmentId: string | null;
        parkingSide: string | null;
        restrictionVersionId: string | null;
        segmentStreetName: string | null;
    };

    const [savedSpot, setSavedSpot] = useState<SavedSpot | null>(() => {
        try {
            const s: SavedSpot | null = JSON.parse(localStorage.getItem(SAVED_SPOT_KEY) || 'null');
            if (!s) return null;
            // Auto-expire after 24 hours if no timer was set
            if (Date.now() - s.savedAt > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(SAVED_SPOT_KEY);
                return null;
            }
            // Migrate sessions that predate sessionId/linkedPingId fields
            let changed = false;
            if (!s.sessionId) { s.sessionId = Date.now().toString(36); changed = true; }
            if (s.linkedPingId === undefined) { (s as any).linkedPingId = null; changed = true; }
            if (changed) localStorage.setItem(SAVED_SPOT_KEY, JSON.stringify(s));
            return s;
        } catch { return null; }
    });
    const [reminderEnabled, setReminderEnabled] = useState<boolean>(
        () => localStorage.getItem('streetCleaningReminder') !== 'false'
    );
    const [showSessionSheet, setShowSessionSheet] = useState(false);
    const [showDepartureSheet, setShowDepartureSheet] = useState(false);
    const [parkedDuration, setParkedDuration] = useState('');
    const [showCustomReminder, setShowCustomReminder] = useState(false);
    const [reminderAmPm, setReminderAmPm] = useState<'AM' | 'PM'>(new Date().getHours() < 12 ? 'AM' : 'PM');
    const [reminderHour, setReminderHour] = useState('');
    const [reminderMinute, setReminderMinute] = useState('');
    const reminderMinuteRef = useRef<HTMLInputElement>(null);
    const reminderSlots = useMemo(() => {
        const now = new Date();
        const start = new Date(now);
        const rem = start.getMinutes() % 30;
        start.setMinutes(start.getMinutes() + (rem === 0 ? 30 : 30 - rem), 0, 0);
        return Array.from({ length: 10 }, (_, i) => new Date(start.getTime() + i * 30 * 60000));
    }, [showCustomReminder]); // recalculate each time picker opens
    const parkedSheetSetterRef = useRef<(() => void) | null>(null);
    parkedSheetSetterRef.current = () => setShowSessionSheet(true);
    // Tracks whether SpotModal was opened from the departure flow —
    // session only ends on successful ping, not on dismiss.
    const isDepartureFlowRef = useRef(false);

    // My Car inline departure flow (bypasses SpotModal entirely)
    const [myCarDepartureView, setMyCarDepartureView] = useState<'prompt' | 'timePicker'>('prompt');
    const [myCarDepartureTime, setMyCarDepartureTime] = useState(() => new Date(Date.now() + 2 * 60_000));
    const [myCarDepartureLoading, setMyCarDepartureLoading] = useState(false);
    const [myCarDepartureError, setMyCarDepartureError] = useState<string | null>(null);
    const [myCarPingSuccess, setMyCarPingSuccess] = useState<'leaving_now' | 'leaving_later' | 'already_shared' | null>(null);

    // Live duration counter for active session
    useEffect(() => {
        if (!savedSpot) { setParkedDuration(''); return; }
        const update = () => {
            const mins = Math.floor((Date.now() - savedSpot.savedAt) / 60000);
            if (mins < 1) setParkedDuration('Just parked');
            else if (mins < 60) setParkedDuration(`${mins} ${mins === 1 ? 'minute' : 'minutes'}`);
            else {
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                setParkedDuration(m === 0 ? `${h}h` : `${h}h ${m}m`);
            }
        };
        update();
        const id = setInterval(update, 60000);
        return () => clearInterval(id);
    }, [savedSpot?.savedAt]);

    const matchNearestSegment = async (userLat: number, userLng: number) => {
        try {
            const radiusM = 80;
            const center: [number, number] = [userLat, userLng];
            const bounds = geofire.geohashQueryBounds(center, radiusM);

            const snaps = await Promise.all(
                bounds.map(([start, end]) =>
                    getDocs(
                        query(
                            collection(db, 'streetSegments'),
                            orderBy('geohash'),
                            startAt(start),
                            endAt(end),
                        ),
                    ),
                ),
            );

            const candidates = snaps.flatMap(s =>
                s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
            );

            if (!candidates.length) {
                // No Firestore segment — lazy-populate via CF (server-controlled write)
                try {
                    const fn = httpsCallable(getFunctions(getApp(), 'us-central1'), 'createSegmentFromSweepNYC');
                    const result = await fn({ lat: userLat, lng: userLng });
                    const data = result.data as { success: boolean; segmentId?: string; parkingSide?: string; streetName?: string };
                    if (!data.success || !data.segmentId) return null;
                    return {
                        segmentId: data.segmentId,
                        parkingSide: data.parkingSide ?? 'North',
                        restrictionVersionId: null,
                        segmentStreetName: data.streetName ?? '',
                    };
                } catch {
                    return null;
                }
            }

            const withDist = candidates.map((seg: any) => ({
                ...seg,
                dist: geofire.distanceBetween([userLat, userLng], [seg.centerLat, seg.centerLng]),
            }));
            withDist.sort((a: any, b: any) => a.dist - b.dist);
            const nearest = withDist[0];

            const parkingSide = nearest.source === 'sweepnyc'
                ? detectCardinalSide(userLat, userLng, nearest.fromLat, nearest.fromLng, nearest.toLat, nearest.toLng, nearest.bearing ?? 90)
                : detectParkingSide(userLat, userLng, nearest.fromLat, nearest.fromLng, nearest.toLat, nearest.toLng, nearest.evenSideIsPositiveCross ?? true);

            const rulesSnap = await getDocs(
                query(
                    collection(db, 'streetSegments', nearest.id, 'streetRules'),
                    where('supersededAt', '==', null),
                ),
            );
            const restrictionVersionId = rulesSnap.docs[0]?.id || null;

            return {
                segmentId: nearest.id as string,
                parkingSide,
                restrictionVersionId,
                segmentStreetName: nearest.streetName as string,
            };
        } catch (e) {
            console.warn('Segment match failed:', e);
            return null;
        }
    };

    const saveMySpot = async () => {
        if (!userLocation) return;
        const [lng, lat] = userLocation;
        const [address, segmentMatch] = await Promise.all([
            reverseGeocode(lng, lat),
            matchNearestSegment(lat, lng),
        ]);
        const spot: SavedSpot = {
            lat,
            lng,
            address,
            savedAt: Date.now(),
            sessionId: crypto.randomUUID(),
            linkedPingId: null,
            segmentId: segmentMatch?.segmentId ?? null,
            parkingSide: segmentMatch?.parkingSide ?? null,
            restrictionVersionId: segmentMatch?.restrictionVersionId ?? null,
            segmentStreetName: segmentMatch?.segmentStreetName ?? null,
        };
        localStorage.setItem(SAVED_SPOT_KEY, JSON.stringify(spot));
        setSavedSpot(spot);
        setShowSessionSheet(true);
    };

    const writeCleaningReminder = async (safeUntil: Date | null, enabled: boolean, streetName: string | null) => {
        if (!safeUntil || !enabled || !auth.currentUser || !streetName) return;
        const uid = auth.currentUser.uid;
        try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            const fcmToken = userSnap.data()?.fcmToken;
            if (!fcmToken) return;
            const reminderMinutesBefore = 60;
            const reminderAt = new Date(safeUntil.getTime() - reminderMinutesBefore * 60 * 1000);
            await setDoc(doc(db, 'parkingSessions', uid), {
                userId: uid,
                fcmToken,
                streetName,
                nextCleaningAt: Timestamp.fromDate(safeUntil),
                reminderAt: Timestamp.fromDate(reminderAt),
                reminderMinutesBefore,
                reminderEnabled: true,
                reminderSent: false,
                active: true,
                savedAt: Timestamp.now(),
            });
        } catch (e) {
            console.warn('Could not write cleaning reminder:', e);
        }
    };

    const endSession = () => {
        localStorage.removeItem(SAVED_SPOT_KEY);
        if (auth.currentUser) {
            setDoc(doc(db, 'parkingSessions', auth.currentUser.uid), { active: false }, { merge: true }).catch(() => {});
        }
        setSavedSpot(null);
        parkingTimer.clearTimer();
        setShowSessionSheet(false);
        setShowDepartureSheet(false);
        setShowCustomReminder(false);
        setReminderHour('');
        setReminderMinute('');
        setReminderAmPm(new Date().getHours() < 12 ? 'AM' : 'PM');
        if (lastParkedMarkerRef.current) {
            lastParkedMarkerRef.current.remove();
            lastParkedMarkerRef.current = null;
        }
    };

    // Proximity check — are we back at the car?
    const isNearSavedSpot = savedSpot && userLocation
        ? getDistance(userLocation[1], userLocation[0], savedSpot.lat, savedSpot.lng) < 0.05
        : false;

    const myCarDistanceLabel = useMemo(() => {
        if (!savedSpot || !userLocation) return null;
        const km = getDistance(userLocation[1], userLocation[0], savedSpot.lat, savedSpot.lng);
        if (km < 0.02) return "You're here";
        if (km < 0.5) return `${Math.round(km * 3280.84)} ft away`;
        return `${(km * 0.621371).toFixed(1)} mi away`;
    }, [userLocation, savedSpot]);

    const otherSpots = spotData.radiusFilteredItems.filter(s => s.finderId !== user?.id);
    const spotCount = otherSpots.length;

    // Count active claim sessions nearby — proxy for demand, shown to finders
    const nearbyInterestCount = spotData.freeSpots.filter(
        s => s.status === 'interested' && s.interestedUserId !== user?.id
    ).length;

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

    // Marker rendering with clustering for nearby spots
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        // Clear all markers and rebuild — clustering changes which IDs map to which markers
        Object.values(allMarkersRef.current).forEach(m => m.remove());
        allMarkersRef.current = {};

        const items = spotData.radiusFilteredItems;
        const assigned = new Set<string>();

        for (const item of items) {
            if (assigned.has(item.id)) continue;

            // Find all spots within 30m
            const group = [item];
            assigned.add(item.id);
            for (const other of items) {
                if (assigned.has(other.id)) continue;
                if (getDistance(item.lat, item.lng, other.lat, other.lng) < 0.03) {
                    group.push(other);
                    assigned.add(other.id);
                }
            }

            const lngLat: [number, number] = [item.lng, item.lat];

            if (group.length === 1) {
                const reportedMs = item.reportedAt
                    ? (typeof item.reportedAt.toMillis === 'function' ? item.reportedAt.toMillis()
                        : typeof item.reportedAt.seconds === 'number' ? item.reportedAt.seconds * 1000 : 0)
                    : 0;
                const isScheduled = reportedMs > Date.now() + 60_000;
                const el = createMarkerElement(isScheduled, reportedMs);
                const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
                    .setLngLat(lngLat).addTo(map);
                marker.getElement().addEventListener('click', (e) => {
                    e.stopPropagation();
                    const fresh = itemsRef.current.find(i => i.id === item.id) || item;
                    setSelectedItem(fresh);
                    map.flyTo({ center: lngLat, zoom: 16 });
                });
                allMarkersRef.current[item.id] = marker;
            } else {
                // Cluster badge — tap to zoom in and see individual pins
                const clusterEl = document.createElement('div');
                clusterEl.style.cssText = [
                    'width:38px', 'height:38px', 'border-radius:50%',
                    'background:#1e75ff', 'border:2.5px solid white',
                    'box-shadow:0 2px 10px rgba(30,117,255,0.45)',
                    'display:flex', 'align-items:center', 'justify-content:center',
                    'color:white', 'font-weight:800', 'font-size:13px', 'cursor:pointer',
                ].join(';');
                clusterEl.textContent = String(group.length);
                const marker = new mapboxgl.Marker({ element: clusterEl, anchor: 'center' })
                    .setLngLat(lngLat).addTo(map);
                marker.getElement().addEventListener('click', (e) => {
                    e.stopPropagation();
                    map.flyTo({ center: lngLat, zoom: 19, duration: 600 });
                });
                allMarkersRef.current[item.id] = marker;
            }
        }
    }, [spotData.radiusFilteredItems]);

    // Last parked location marker
    useEffect(() => {
        if (!mapRef.current || !mapReady) return;
        if (lastParkedMarkerRef.current) {
            lastParkedMarkerRef.current.remove();
            lastParkedMarkerRef.current = null;
        }
        const loc = savedSpot;
        if (!loc?.lat || !loc?.lng) return;

        const el = document.createElement('div');
        el.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;overflow:visible';
        el.innerHTML = `
            <div style="width:46px;height:46px;flex-shrink:0;pointer-events:none;">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;filter:drop-shadow(0px 4px 10px rgba(30,117,255,0.5));">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#1e75ff"/>
                <g transform="translate(12,10) scale(0.38) translate(-12,-12)">
                  <path d="m2 4 3 12h14l3-12-6 5-4-5-4 5-6-5z" fill="none" stroke="#facc15" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                  <line x1="5" y1="16" x2="19" y2="16" stroke="#facc15" stroke-width="2.2" stroke-linecap="round"/>
                </g>
              </svg>
            </div>
        `;
        el.title = loc.address || 'Last parked here';

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([loc.lng, loc.lat])
            .addTo(mapRef.current);

        // Ensure wrapper sits above user location dot (z-index 5) — defer so DOM is ready
        setTimeout(() => {
            const wrapper = marker.getElement().parentElement;
            if (wrapper) wrapper.style.zIndex = '10';
        }, 0);

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 16 });
            parkedSheetSetterRef.current?.();
        });

        lastParkedMarkerRef.current = marker;
    }, [savedSpot?.savedAt, mapReady]);

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
            el.innerHTML = `<div class="relative flex items-center justify-center"><div class="absolute w-6 h-6 bg-blue-500/20 rounded-full"></div><div class="w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white shadow-md"></div></div>`;
            userMarkerRef.current = new mapboxgl.Marker(el).setLngLat(userLocation).addTo(mapRef.current);
        }
    }, [userLocation]);

    useEffect(() => {
        if (!pingError) return;
        const t = setTimeout(() => setPingError(null), 4000);
        return () => clearTimeout(t);
    }, [pingError]);

    // Reset My Car departure sub-state each time the sheet opens.
    // If the session already has a linked ping, show "already shared" immediately.
    useEffect(() => {
        if (showDepartureSheet) {
            setMyCarDepartureView('prompt');
            setMyCarDepartureTime(new Date(Date.now() + 2 * 60_000));
            setMyCarDepartureError(null);
            setMyCarPingSuccess(savedSpot?.linkedPingId ? 'already_shared' : null);
        }
    }, [showDepartureSheet]);

    // --- Handlers ---

    const handleLocateMe = () => {
        if (userLocation && mapRef.current) {
            mapRef.current.flyTo({ center: userLocation, zoom: 16 });
        }
    };

    // Directly creates a ping from the saved My Car location — no SpotModal.
    // Uses a deterministic spot ID (mycar_uid_sessionId) so retries are idempotent.
    const handleMyCarPing = async (departureTime: Date | null) => {
        if (!savedSpot || !user) return;

        // Gate 1: session already has a confirmed linked ping
        if (savedSpot.linkedPingId) {
            setMyCarPingSuccess('already_shared');
            return;
        }

        setMyCarDepartureLoading(true);
        setMyCarDepartureError(null);

        const now = Date.now();
        const reportedAt = departureTime ? Timestamp.fromDate(departureTime) : Timestamp.fromMillis(now);
        const expiresAt = Timestamp.fromMillis(reportedAt.toMillis() + 60 * 60 * 1000);
        const spotId = `mycar_${user.id}_${savedSpot.sessionId}`;
        const spotRef = doc(db, 'spots', spotId);

        // Rate-limit check — exclude this session's own spot from the count
        try {
            const oneHourAgo = now - 60 * 60 * 1000;
            const snap = await getDocs(query(collection(db, 'spots'), where('finderId', '==', user.id)));
            const recentSpots = snap.docs.filter(d => {
                if (d.id === spotId) return false;
                const t = d.data().reportedAt?.toMillis?.() ?? new Date(d.data().reportedAt).getTime();
                return t >= oneHourAgo;
            });
            if (recentSpots.length >= 5) {
                const oldestMs = Math.min(...recentSpots.map(d => {
                    const t = d.data().reportedAt?.toMillis?.() ?? new Date(d.data().reportedAt).getTime();
                    return t;
                }));
                const minutesLeft = Math.ceil((oldestMs + 60 * 60 * 1000 - now) / 60000);
                setMyCarDepartureError(`Ping limit reached — try again in ${minutesLeft} min.`);
                setMyCarDepartureLoading(false);
                return;
            }
        } catch { /* non-fatal */ }

        // Gate 2: pre-flight check — spot may already exist if a previous attempt
        // succeeded but the session update (linkedPingId) failed
        try {
            const existing = await getDoc(spotRef);
            if (existing.exists()) {
                const updated = { ...savedSpot, linkedPingId: spotId };
                localStorage.setItem(SAVED_SPOT_KEY, JSON.stringify(updated));
                setSavedSpot(updated);
                setMyCarPingSuccess('already_shared');
                setMyCarDepartureLoading(false);
                return;
            }
        } catch { /* non-fatal, proceed to create */ }

        // Create the ping with the deterministic ID
        try {
            await setDoc(spotRef, {
                lat: savedSpot.lat,
                lng: savedSpot.lng,
                type: 'free',
                status: 'available',
                finderId: user.id,
                finderName: user.username || user.fullName || 'Anonymous',
                finderTitle: getTitleForCrowns(user.crowns || 0),
                finderVehicleColor: user.vehicleColor || null,
                finderVehicleType: user.vehicleType || null,
                finderVehicleBrand: user.vehicleBrand || null,
                pingMode: departureTime ? 'later' : 'now',
                reportedAt,
                expiresAt,
                geohash: geofire.geohashForLocation([savedSpot.lat, savedSpot.lng]),
                address: savedSpot.address,
            });

            // Lock the session: no further pings from this session
            const updated = { ...savedSpot, linkedPingId: spotId };
            localStorage.setItem(SAVED_SPOT_KEY, JSON.stringify(updated));
            setSavedSpot(updated);

            const mode = departureTime ? 'leaving_later' : 'leaving_now';
            setMyCarPingSuccess(mode);
            setMyCarDepartureLoading(false);

            setTimeout(() => {
                setShowDepartureSheet(false);
                if (mode === 'leaving_now') endSession();
            }, 1500);
        } catch (e) {
            console.error('My Car ping failed:', e);
            setMyCarDepartureError("Couldn't share this spot. Please try again.");
            setMyCarDepartureLoading(false);
        }
    };

    const handleSaveSpot = async (departureTime: Date | null) => {
        if (isPinging || !user) return;

        if (!selectedItem) {
            const activeQ = query(collection(db, 'spots'), where('finderId', '==', user.id), where('status', 'in', ['available', 'interested']));
            const activeSnap = await getDocs(activeQ);
            if (!activeSnap.empty) {
                setPingError('You already have an active ping — cancel it first.');
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
            if (isDepartureFlowRef.current) {
                isDepartureFlowRef.current = false;
                endSession();
            }
        };

        const onSaveError = (error: any) => {
            console.error("Error saving spot:", error);
            setPingError("Couldn't save your ping — please try again.");
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
                    finderTitle: getTitleForCrowns(user.crowns || 0),
                    finderVehicleColor: user.vehicleColor || null,
                    finderVehicleType: user.vehicleType || null,
                    finderVehicleBrand: user.vehicleBrand || null,
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
                    const oldestMs = Math.min(...recentSpots.map(d => {
                        const t = d.data().reportedAt?.toMillis ? d.data().reportedAt.toMillis() : new Date(d.data().reportedAt).getTime();
                        return t;
                    }));
                    const minutesLeft = Math.ceil((oldestMs + 60 * 60 * 1000 - now) / 60000);
                    setPingError(`Ping limit reached — try again in ${minutesLeft} min.`);
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
                    finderTitle: getTitleForCrowns(user.crowns || 0),
                    finderVehicleColor: user.vehicleColor || null,
                    finderVehicleType: user.vehicleType || null,
                    finderVehicleBrand: user.vehicleBrand || null,
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
                        setPingError("Couldn't sync your ping — please try again.");
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
                            finderVehicleColor: user.vehicleColor || null,
                            finderVehicleType: user.vehicleType || null,
                            finderVehicleBrand: user.vehicleBrand || null,
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
                                setPingError("Couldn't sync your ping — please try again.");
                            });
                    },
                    (error) => {
                        console.error("Error getting position for ping:", error);
                        setPingError("Location unavailable — please enable location services.");
                        setIsPinging(false);
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
                );
            }
        }
    };

    const handleDeletePing = () => {
        const spotToDelete = selectedItem || (spotData.activeSpots.length > 0 ? spotData.activeSpots[0] : null);
        if (!user || !spotToDelete) return;
        if (user.id !== spotToDelete.finderId) return;
        setShowDeleteConfirm(true);
    };

    const doDeletePing = async () => {
        const spotToDelete = selectedItem || (spotData.activeSpots.length > 0 ? spotData.activeSpots[0] : null);
        if (!spotToDelete) return;
        setShowDeleteConfirm(false);
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
                    isDepartureFlowRef.current = false; // session stays alive if they back out
                }}
                onSave={handleSaveSpot}
                spot={selectedItem}
                spotAddress={spotAddress}
                user={user}
            />

            {/* Spot details bottom sheet */}
            <BottomSheet isOpen={!!selectedItem && !isSpotModalOpen} onClose={() => { setSelectedItem(null); setSelectedItemManageMode(false); }}>
                <SpotDetailsCard
                    selectedItem={selectedItem}
                    freeSpots={spotData.freeSpots}
                    user={user}
                    userLocation={userLocation}
                    spotAddress={spotAddress}
                    onHeadingThere={() => {
                        const eta = selectedItem ? interestFlow.getEstDriveMinutes(selectedItem) : null;
                        interestFlow.handleExpressInterest(eta ?? 5);
                    }}
                    onEditSpot={(spot) => { setSelectedItem(spot); setSpotModalOpen(true); }}
                    onDeletePing={handleDeletePing}
                    onArrival={interestFlow.handleArrival}
                    onCancelByFinder={interestFlow.handleCancelByFinder}
                    onCancelByClaimer={interestFlow.handleCancelByClaimer}
                    onDriverArrived={interestFlow.handleFinderConfirmsArrival}
                    onMessageUser={onMessageUser}
                    nearbyInterestCount={nearbyInterestCount}
                    interestError={interestFlow.interestError}
                    estDriveMinutes={selectedItem ? interestFlow.getEstDriveMinutes(selectedItem) : null}
                    isWithinArrivalRange={selectedItem ? interestFlow.isWithinArrivalRange(selectedItem) : false}
                    maxEtaMinutes={interestFlow.MAX_ETA_MINUTES}
                    manageMode={selectedItemManageMode}
                />
            </BottomSheet>


            {/* My Car — Parking Session sheet (personal only) */}
            <BottomSheet isOpen={showSessionSheet} onClose={() => { setShowSessionSheet(false); setShowCustomReminder(false); }}>
                {savedSpot && (
                    <div>
                        {/* Header: left = icon + My Car + duration, right = Address label + value */}
                        <div className="flex items-start gap-4 mb-5">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                                style={{ background: 'linear-gradient(90deg,#1e75ff,#0ea5e9)' }}>
                                <VehicleIcon type={user?.vehicleType} color={user?.vehicleColor} size={26} />
                            </div>
                            <div className="flex-1 min-w-0 flex justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-0.5">My Car</p>
                                    <p className="text-xl font-extrabold text-[var(--color-text)] leading-tight">{parkedDuration || 'Just parked'}</p>
                                </div>
                                {savedSpot.address && (
                                    <div className="text-right shrink-0 max-w-[48%]">
                                        <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-0.5">Address</p>
                                        <p className="text-sm font-bold text-white leading-tight">{savedSpot.address}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Street Intelligence */}
                        {savedSpot.segmentId && savedSpot.parkingSide && savedSpot.segmentStreetName ? (
                            <>
                                <StreetIntelligenceCard
                                    segmentId={savedSpot.segmentId}
                                    parkingSide={savedSpot.parkingSide}
                                    streetName={savedSpot.segmentStreetName}
                                    onResult={r => {
                                        if (r?.safeUntil) {
                                            writeCleaningReminder(r.safeUntil, reminderEnabled, savedSpot.segmentStreetName);
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        const next = !reminderEnabled;
                                        setReminderEnabled(next);
                                        localStorage.setItem('streetCleaningReminder', String(next));
                                        if (auth.currentUser) {
                                            setDoc(doc(db, 'parkingSessions', auth.currentUser.uid), { reminderEnabled: next }, { merge: true }).catch(() => {});
                                        }
                                    }}
                                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] mb-4"
                                >
                                    <div className="flex items-center gap-2">
                                        <Bell size={15} className={reminderEnabled ? 'text-blue-400' : 'text-[var(--color-text-secondary)]'} />
                                        <span className="text-sm text-[var(--color-text)]">Remind me 1 hr before cleaning</span>
                                    </div>
                                    <div className={`w-10 h-6 rounded-full transition-colors relative ${reminderEnabled ? 'bg-blue-600' : 'bg-white/20'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${reminderEnabled ? 'left-5' : 'left-1'}`} />
                                    </div>
                                </button>
                            </>
                        ) : (
                            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-4 mb-4">
                                <p className="text-sm text-[var(--color-text-secondary)]">Street cleaning data isn't available for this block yet. Please check posted signs.</p>
                            </div>
                        )}

                        {/* Navigate in-app */}
                        <button
                            onClick={() => {
                                if (!mapRef.current || !userLocation) return;
                                const dest: [number, number] = [savedSpot.lng, savedSpot.lat];
                                activeRouteDestinationRef.current = dest;
                                drawRoute(mapRef.current, userLocation, dest);
                                mapRef.current.flyTo({ center: dest, zoom: 16 });
                                setShowSessionSheet(false);
                            }}
                            className="w-full mb-4 py-3 rounded-2xl text-sm font-bold border border-[#1e75ff]/30 bg-[#1e75ff]/10 hover:bg-[#1e75ff]/15 transition-all active:scale-95 text-[#38bdf8] flex items-center justify-center gap-2">
                            <Navigation size={15} />
                            Navigate to my car
                        </button>

                        {/* Reminder */}
                        <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">Reminder</p>
                        {parkingTimer.timer ? (
                            <div className="flex items-center gap-2.5 px-3 py-3 rounded-2xl bg-[#1e75ff]/10 border border-[#1e75ff]/20 mb-4">
                                <Clock size={14} className="text-[#38bdf8] shrink-0" />
                                <p className="text-xs font-semibold text-[#38bdf8] flex-1">{parkingTimer.minutesRemaining} min remaining</p>
                                <button onClick={parkingTimer.clearTimer} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                                    <X size={13} />
                                </button>
                            </div>
                        ) : showCustomReminder ? (
                            <div className="mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden">
                                <div className="grid grid-cols-2 divide-x divide-[var(--color-border)]">
                                    <div className="px-4 py-3">
                                        <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-1">Date</p>
                                        <input
                                            type="date"
                                            id="pq-reminder-date"
                                            defaultValue={new Date().toISOString().split('T')[0]}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none"
                                            style={{ colorScheme: 'dark' }}
                                        />
                                    </div>
                                    <div className="px-4 py-3">
                                        <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-1">Time</p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-0.5 flex-1 min-w-0">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="12"
                                                    value={reminderHour}
                                                    maxLength={2}
                                                    autoFocus
                                                    className="w-7 bg-transparent text-sm font-semibold text-white text-center focus:outline-none"
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/\D/g, '');
                                                        if (!raw) { setReminderHour(''); return; }
                                                        const n = parseInt(raw);
                                                        if (n > 12) { setReminderHour('12'); reminderMinuteRef.current?.focus(); return; }
                                                        if (n === 0) { setReminderHour('1'); return; }
                                                        setReminderHour(raw);
                                                        // auto-advance: first digit 2-9 can't grow to a valid 2-digit hour
                                                        if (raw.length === 2 || (raw.length === 1 && n >= 2)) {
                                                            reminderMinuteRef.current?.focus();
                                                        }
                                                    }}
                                                />
                                                <span className="text-sm font-bold text-[var(--color-text-secondary)] select-none">:</span>
                                                <input
                                                    ref={reminderMinuteRef}
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="00"
                                                    value={reminderMinute}
                                                    maxLength={2}
                                                    className="w-7 bg-transparent text-sm font-semibold text-white text-center focus:outline-none"
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => {
                                                        const raw = e.target.value.replace(/\D/g, '');
                                                        if (!raw) { setReminderMinute(''); return; }
                                                        const n = parseInt(raw);
                                                        if (n > 59) { setReminderMinute('59'); return; }
                                                        setReminderMinute(raw);
                                                    }}
                                                />
                                            </div>
                                            <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)] shrink-0">
                                                {(['AM', 'PM'] as const).map(period => (
                                                    <button key={period} type="button"
                                                        onClick={() => setReminderAmPm(period)}
                                                        className={`px-2.5 py-1 text-xs font-bold transition-colors ${
                                                            reminderAmPm === period
                                                                ? 'bg-[#1e75ff] text-white'
                                                                : 'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                                                        }`}>
                                                        {period}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px bg-[var(--color-border)]" />
                                <div className="flex divide-x divide-[var(--color-border)]">
                                    <button onClick={() => setShowCustomReminder(false)}
                                        className="flex-1 py-3 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            const dateEl = document.getElementById('pq-reminder-date') as HTMLInputElement;
                                            const hRaw = parseInt(reminderHour) || 12;
                                            const m = parseInt(reminderMinute) || 0;
                                            let h = hRaw % 12;
                                            if (reminderAmPm === 'PM') h += 12;
                                            const dateStr = dateEl.value || new Date().toISOString().split('T')[0];
                                            const target = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                                            const minutes = Math.round((target.getTime() - Date.now()) / 60000);
                                            if (minutes > 0) {
                                                parkingTimer.startTimer(minutes, savedSpot!.address || '', () => setShowDepartureSheet(true));
                                                setShowCustomReminder(false);
                                            }
                                        }}
                                        className="flex-1 py-3 text-xs font-bold text-[#38bdf8] hover:text-[#1e75ff] transition-colors">
                                        Set Reminder
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-2 mb-4">
                                {[{ label: '15 min', minutes: 15 }, { label: '30 min', minutes: 30 }, { label: '1 hr', minutes: 60 }, { label: 'Custom…', minutes: -1 }].map(opt => (
                                    <button key={opt.minutes}
                                        onClick={() => {
                                            if (opt.minutes === -1) { setReminderHour(''); setReminderMinute(''); setShowCustomReminder(true); return; }
                                            parkingTimer.startTimer(opt.minutes, savedSpot.address || '', () => setShowDepartureSheet(true));
                                        }}
                                        className="py-3 rounded-2xl text-xs font-bold border border-[var(--color-border)] bg-white/5 hover:bg-white/10 text-[var(--color-text)] transition-all active:scale-95">
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Clear saved location */}
                        <button onClick={endSession}
                            className="w-full py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-red-400 transition-colors">
                            Clear saved location
                        </button>
                    </div>
                )}
            </BottomSheet>

            {/* Departure prompt — inline, no SpotModal required */}
            <BottomSheet isOpen={showDepartureSheet} onClose={() => setShowDepartureSheet(false)}>
                {savedSpot && (
                    <div>
                        {/* Success / already-shared state */}
                        {myCarPingSuccess && (
                            <div className="flex flex-col items-center py-6">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                                    style={{ background: 'linear-gradient(90deg,#1e75ff,#0ea5e9)' }}>
                                    <CheckCircle2 size={30} className="text-white" />
                                </div>
                                <p className="text-xl font-extrabold text-[var(--color-text)] mb-1">
                                    {myCarPingSuccess === 'leaving_now' ? 'Spot shared.'
                                     : myCarPingSuccess === 'leaving_later' ? 'Spot scheduled.'
                                     : 'This spot has already been shared.'}
                                </p>
                                <p className="text-sm text-[var(--color-text-secondary)] text-center">
                                    {myCarPingSuccess === 'leaving_now'
                                        ? 'Nearby drivers can now see it.'
                                        : myCarPingSuccess === 'leaving_later'
                                        ? "We'll let nearby drivers know when you're leaving."
                                        : 'Nearby drivers can already see your spot.'}
                                </p>
                                {myCarPingSuccess === 'already_shared' && (
                                    <button
                                        onClick={() => setShowDepartureSheet(false)}
                                        className="mt-4 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                                        Got it
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Prompt view */}
                        {!myCarPingSuccess && myCarDepartureView === 'prompt' && (
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                                    style={{ background: 'linear-gradient(90deg,#1e75ff,#0ea5e9)' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 5-4-5-4 5-6-5zm3 16h14"/></svg>
                                </div>
                                <p className="text-xl font-extrabold text-[var(--color-text)] mb-1">Leaving this spot?</p>
                                <p className="text-sm text-[var(--color-text-secondary)] mb-6">Share your saved parking spot with nearby drivers.</p>

                                {myCarDepartureError && (
                                    <p className="text-sm text-red-400 font-semibold text-center mb-4">{myCarDepartureError}</p>
                                )}

                                <button
                                    onClick={() => handleMyCarPing(null)}
                                    disabled={myCarDepartureLoading}
                                    className="w-full py-3.5 rounded-full text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform mb-2 disabled:opacity-50"
                                    style={{ background: 'linear-gradient(90deg,#1e75ff,#0ea5e9)' }}>
                                    <MapPin size={16} />
                                    {myCarDepartureLoading ? 'Sharing…' : 'Leaving now'}
                                </button>
                                <button
                                    onClick={() => {
                                        setMyCarDepartureTime(new Date(Date.now() + 2 * 60_000));
                                        setMyCarDepartureError(null);
                                        setMyCarDepartureView('timePicker');
                                    }}
                                    disabled={myCarDepartureLoading}
                                    className="w-full py-3 rounded-full text-sm font-bold border border-[var(--color-border)] bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-[var(--color-text)] flex items-center justify-center gap-2 mb-3 disabled:opacity-50">
                                    <Clock size={15} />
                                    Leaving later
                                </button>
                                <button
                                    onClick={() => setShowDepartureSheet(false)}
                                    className="w-full py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-all">
                                    Keep my car saved
                                </button>
                            </div>
                        )}

                        {/* Time picker view */}
                        {!myCarPingSuccess && myCarDepartureView === 'timePicker' && (
                            <div>
                                <div className="flex items-center gap-3 mb-5">
                                    <button
                                        onClick={() => { setMyCarDepartureError(null); setMyCarDepartureView('prompt'); }}
                                        className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] shrink-0">
                                        <ChevronLeft size={18} className="text-[var(--color-text-secondary)]" />
                                    </button>
                                    <div>
                                        <p className="text-base font-extrabold text-[var(--color-text)]">Set departure time</p>
                                        <p className="text-xs text-[var(--color-text-secondary)]">When are you planning to leave?</p>
                                    </div>
                                </div>

                                <TimePicker
                                    initialTime={myCarDepartureTime}
                                    onTimeChange={setMyCarDepartureTime}
                                />

                                {myCarDepartureError && (
                                    <p className="mt-3 text-sm text-red-400 font-semibold text-center">{myCarDepartureError}</p>
                                )}

                                <button
                                    onClick={() => {
                                        if (myCarDepartureTime.getTime() <= Date.now()) {
                                            setMyCarDepartureError('Please choose a future time.');
                                            return;
                                        }
                                        handleMyCarPing(myCarDepartureTime);
                                    }}
                                    disabled={myCarDepartureLoading}
                                    className="w-full mt-4 font-bold py-3.5 rounded-full flex items-center justify-center gap-2 text-white active:scale-95 transition-transform disabled:opacity-50"
                                    style={{ background: 'linear-gradient(90deg,#1e75ff,#0ea5e9)' }}>
                                    <MapPin size={18} />
                                    {myCarDepartureLoading ? 'Scheduling…' : 'Schedule spot'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </BottomSheet>

            {/* Post-arrival handoff flow */}
            <BottomSheet isOpen={interestFlow.handoffStep !== null} onClose={interestFlow.handleSkipDeparture}>
                {interestFlow.handoffStep && (
                    <HandoffFlow
                        step={interestFlow.handoffStep}
                        finderName={interestFlow.handoffFinderName}
                        onOutcome={interestFlow.handleHandoffOutcome}
                        onFailureReason={interestFlow.handleFailureReason}
                        onDeparturePing={interestFlow.handleDeparturePing}
                        onSetTimer={(minutes) => parkingTimer.startTimer(minutes, interestFlow.handoffAddress)}
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
                const name = interestedSpot.interestedUserName || 'Someone';
                const initial = name.charAt(0).toUpperCase();
                return (
                    <button
                        onClick={() => { setSelectedItem(interestedSpot); setSelectedItemManageMode(false); }}
                        className="absolute top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-[360px] z-50 backdrop-blur-xl rounded-2xl shadow-2xl pointer-events-auto overflow-hidden active:scale-[0.98] transition-transform text-left"
                        style={{ background: 'rgba(5,13,28,0.82)', border: '1px solid rgba(30,117,255,0.3)' }}
                    >
                        <div className="px-4 py-3.5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
                                style={{ background: 'linear-gradient(135deg, #1e75ff, #0ea5e9)' }}>
                                {initial}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-[#38bdf8] uppercase tracking-wider mb-0.5">On their way to your spot</p>
                                <p className="text-sm font-bold text-white truncate">{name}</p>
                                {interestedSpot.etaMinutes && (
                                    <p className="text-[11px] text-white/55 mt-0.5">ETA ~{interestedSpot.etaMinutes} min · Tap to see details</p>
                                )}
                            </div>
                            <ChevronRight size={16} className="text-white/30 shrink-0" />
                        </div>
                    </button>
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

            {pingError && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-red-500/90 text-white text-sm font-medium rounded-2xl shadow-lg backdrop-blur-sm max-w-[85vw] text-center pointer-events-none">
                    {pingError}
                </div>
            )}

            {showDeleteConfirm && (
                <div className="absolute inset-0 z-[200] flex items-end justify-center pb-10 bg-black/50 backdrop-blur-sm">
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-3xl p-6 mx-4 w-full max-w-sm shadow-2xl">
                        <p className="text-base font-bold text-[var(--color-text)] text-center mb-1">Delete this spot?</p>
                        <p className="text-sm text-[var(--color-text-secondary)] text-center mb-6">This can't be undone.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 rounded-2xl border border-[var(--color-border)] text-[var(--color-text)] font-semibold text-sm">
                                Cancel
                            </button>
                            <button onClick={doDeletePing} className="flex-1 py-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-sm">
                                Delete Spot
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="inline-flex items-center gap-1.5 bg-[var(--color-card)] backdrop-blur-xl border border-emerald-500/20 rounded-full px-2.5 py-1 text-[10px] font-semibold text-emerald-400 shadow-md">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    {spotCount} free spot{spotCount !== 1 ? 's' : ''} nearby
                                </div>
                                {nearbyInterestCount > 0 && (
                                    <div className="inline-flex items-center gap-1.5 bg-[var(--color-card)] backdrop-blur-xl border border-[#1e75ff]/25 rounded-full px-2.5 py-1 text-[10px] font-semibold text-[#38bdf8] shadow-md">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-pulse" />
                                        {nearbyInterestCount} en route
                                    </div>
                                )}
                            </div>
                        ) : mapReady && !spotData.activeSpots.find(s => s.finderId === user?.id) && (
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

                    {/* Car (toggle) + Locate stacked vertically on the right */}
                    <div className="flex flex-col items-end gap-2 max-w-[380px] mx-auto w-full mb-2">
                        {userLocation && (
                            <button
                                onClick={() => {
                                    if (!savedSpot) saveMySpot();
                                    else if (isNearSavedSpot) setShowDepartureSheet(true);
                                    else setShowSessionSheet(true);
                                }}
                                title="My Car"
                                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 backdrop-blur-xl border ${
                                    savedSpot
                                        ? 'bg-[#1e75ff] border-[#1e75ff] hover:bg-[#1e75ff]/80'
                                        : 'bg-[var(--color-card)] border-[#1e75ff]/40 hover:border-[#1e75ff]/70 hover:bg-[#1e75ff]/10'
                                }`}
                            >
                                <Car size={17} className={savedSpot ? 'text-white' : 'text-[#1e75ff]'} />
                            </button>
                        )}
                        <button
                            onClick={handleLocateMe}
                            className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 bg-[var(--color-card)] backdrop-blur-xl border border-[#1e75ff]/40 hover:border-[#1e75ff]/70 hover:bg-[#1e75ff]/10"
                            title="Locate Me"
                        >
                            <Locate size={18} className="text-[#1e75ff]" />
                        </button>
                    </div>

                    {/* Timer chip — subtle indicator that a reminder is active */}
                    {parkingTimer.timer && savedSpot && (
                        <div className="max-w-[380px] mx-auto w-full pointer-events-auto">
                            <button
                                onClick={() => setShowSessionSheet(true)}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-[var(--color-card)] backdrop-blur-xl border border-[#1e75ff]/20 shadow-md">
                                <Clock size={11} className="text-[#38bdf8]" />
                                <p className="text-[11px] font-semibold text-[#38bdf8]">{parkingTimer.minutesRemaining}m remaining · tap to view</p>
                            </button>
                        </div>
                    )}

                    {nearestSpot && !selectedItem && (
                        <button
                            onClick={() => setSelectedItem(nearestSpot.spot)}
                            className="nearest-spot-chip mx-auto flex items-center gap-2 px-3.5 py-2 rounded-full border border-white/15 active:scale-95 transition-transform"
                            style={{ backdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0.06)' }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1e75ff] shrink-0" />
                            <span className="text-[12px] font-semibold text-[var(--color-text)] whitespace-nowrap">
                                {nearestSpot.distText}
                                {nearestSpot.spot.reportedAt && (() => {
                                    const dep = typeof nearestSpot.spot.reportedAt.toDate === 'function' ? nearestSpot.spot.reportedAt.toDate() : new Date(nearestSpot.spot.reportedAt);
                                    const isScheduled = dep.getTime() > Date.now() + 60_000;
                                    return <span className="text-[#38bdf8]"> · {isScheduled ? `Available ${dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Leaving now'}</span>;
                                })()}
                            </span>
                            <ChevronRight size={12} className="text-[var(--color-text-secondary)] shrink-0" />
                        </button>
                    )}

                    {(() => {
                        const myPing = spotData.activeSpots.find(s => s.finderId === user?.id);
                        const hasActivePing = !!myPing;
                        const isMyCarMode = !!savedSpot && !hasActivePing;
                        return (
                            <button
                                onClick={() => {
                                    if (hasActivePing) {
                                        setSelectedItem(myPing);
                                        setSelectedItemManageMode(true);
                                    } else if (isMyCarMode) {
                                        if (mapRef.current) {
                                            mapRef.current.flyTo({ center: [savedSpot.lng, savedSpot.lat], zoom: 17, duration: 800 });
                                        }
                                        setTimeout(() => setShowSessionSheet(true), 600);
                                    } else {
                                        setSelectedItem(null);
                                        setSpotModalOpen(true);
                                    }
                                }}
                                disabled={!user}
                                className="relative mx-auto h-[52px] rounded-full px-14 active:scale-95 text-white disabled:opacity-50 transition-transform duration-200 ping-glow"
                                style={{ background: 'linear-gradient(90deg, #1e75ff, #0ea5e9)', minWidth: '250px' }}
                            >
                                {isMyCarMode ? (
                                    <div className="flex items-center justify-center gap-2.5 w-full px-8">
                                        <VehicleIcon type={user?.vehicleType} color="White" size={22} />
                                        <div className="text-center">
                                            <p className="text-[17px] font-bold leading-tight whitespace-nowrap">My Parked Car</p>
                                            {myCarDistanceLabel && myCarDistanceLabel !== "You're here" && (
                                                <p className="text-[10px] font-semibold text-white/70 whitespace-nowrap leading-tight">
                                                    {myCarDistanceLabel}
                                                </p>
                                            )}
                                            {myCarDistanceLabel === "You're here" && (
                                                <p className="text-[10px] font-semibold text-emerald-300 whitespace-nowrap leading-tight">
                                                    You've arrived
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <MapPin size={24} className="absolute left-9 top-1/2 -translate-y-1/2" />
                                        <span className="text-[19px] font-bold absolute top-1/2 -translate-y-1/2 whitespace-nowrap" style={{ left: 'calc(50% + 12px)', transform: 'translate(-50%, -50%)' }}>
                                            {hasActivePing ? 'My Active Ping' : 'Ping Parking'}
                                        </span>
                                    </>
                                )}
                            </button>
                        );
                    })()}

                </div>
            </div>
        </div>
    );
};
