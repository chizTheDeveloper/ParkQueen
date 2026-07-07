import mapboxgl from 'mapbox-gl';

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
export const NYC_CENTER: [number, number] = [-73.9712, 40.7831];

const deg2rad = (deg: number) => deg * (Math.PI / 180);

export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const formatTimeLeft = (ms: number): string => {
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

export const createMarkerElement = (scheduled = false, reportedMs = 0) => {
    const el = document.createElement('div');
    el.style.position = 'relative';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.cursor = 'pointer';
    el.style.zIndex = '10';
    el.style.overflow = 'visible';
    el.dataset.scheduled = String(scheduled);

    const color = scheduled ? '#eab308' : '#1e75ff';
    const size = scheduled ? 38 : 46;
    const now = Date.now();
    const ageMs = reportedMs ? now - reportedMs : 0;
    const isAging = ageMs > 15 * 60 * 1000;
    const isFresh = reportedMs && reportedMs <= now && ageMs >= 0 && ageMs < 5000;
    const opacity = isAging ? '0.55' : '1';
    const pulseDelay1 = isFresh ? '3s' : '0s';
    const pulseDelay2 = isFresh ? '3.7s' : '0.7s';

    // Parking icon: rounded square + bold P (matches SpotDetailsCard)
    const pinIcon = scheduled
        ? /* clock hands for "leaving later" */
          `<circle cx="12" cy="9.5" r="3.5" fill="none" stroke="white" stroke-width="1.6"/>
           <line x1="12" y1="7.5" x2="12" y2="9.5" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
           <line x1="12" y1="9.5" x2="13.5" y2="10.5" stroke="white" stroke-width="1.6" stroke-linecap="round"/>`
        : /* parking P */
          `<rect x="8.5" y="5.5" width="7" height="7" rx="1.5" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" stroke-width="0.8"/>
           <text x="12" y="11" font-size="5.5" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-weight="900" text-anchor="middle" fill="white">P</text>`;

    // Rings live outside the sized pin wrapper so they never affect offsetHeight
    const pulseRings = !scheduled ? `
        <div class="map-pin-pulse" style="width:${size}px;height:${size}px;border:2px solid ${color};animation-delay:${pulseDelay1};position:absolute;top:40%;left:50%;"></div>
        <div class="map-pin-pulse" style="width:${size}px;height:${size}px;border:2px solid ${color};animation-delay:${pulseDelay2};position:absolute;top:40%;left:50%;"></div>
    ` : '';

    el.innerHTML = `
        ${pulseRings}
        <div style="width:${size}px;height:${size}px;flex-shrink:0;opacity:${opacity};pointer-events:none;">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;filter:drop-shadow(0px 4px 10px rgba(0,0,0,0.5));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${color}" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
            ${pinIcon}
          </svg>
        </div>
    `;
    return el;
};

export const clearRoute = (map: mapboxgl.Map) => {
    if (map.getLayer('route')) {
        map.removeLayer('route');
    }
    if (map.getSource('route')) {
        map.removeSource('route');
    }
};

export const drawRoute = async (map: mapboxgl.Map, start: [number, number], end: [number, number]) => {
    if (!MAPBOX_TOKEN) return;
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
