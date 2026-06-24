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

export const createMarkerElement = (type: 'free' | 'paid' | 'public', price?: string) => {
    const el = document.createElement('div');
    el.className = "flex flex-col items-center select-none";
    el.style.zIndex = '10';
    el.style.cursor = 'pointer';

    let color = '#1e75ff';
    if (type === 'paid') color = '#22c55e';
    if (type === 'public') color = '#a855f7';

    let pillHtml = '';
    if ((type === 'paid' || type === 'public') && price) {
        const textColorClass = type === 'paid' ? 'text-[#22c55e]' : 'text-[#a855f7]';
        const borderColorClass = type === 'paid' ? 'border-[#22c55e]/25' : 'border-[#a855f7]/25';
        pillHtml = `
            <div class="mt-0.5 px-1.5 py-0.5 text-[9px] font-bold bg-[#07162c]/95 border ${borderColorClass} ${textColorClass} rounded-md shadow-lg backdrop-blur-sm whitespace-nowrap leading-none select-none pointer-events-none">
                ${price}
            </div>
        `;
    }

    el.innerHTML = `
        <div style="width: 32px; height: 32px; position: relative;" class="pointer-events-none">
          <svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.35));">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#FFF" stroke-width="1.5"/>
            <text x="12" y="11" font-size="8.5" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" text-anchor="middle" fill="white">P</text>
          </svg>
        </div>
        ${pillHtml}
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
