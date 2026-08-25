import { geohashQueryBounds } from 'geofire-common';

export interface GeoQueryRange {
    start: string;
    end: string;
}

const MILES_TO_METERS = 1609.34;

/**
 * Pure spatial-query groundwork for a future bounded Firestore spots
 * listener. No Firestore calls, no React, no side effects — this only
 * computes the geohash range(s) a caller would use to build one or more
 * `where('geohash', '>=', start).where('geohash', '<=', end)` queries
 * covering a circular radius around a center point.
 */
export function buildGeoQueryRanges(
    centerLat: number,
    centerLng: number,
    radiusMiles: number,
): GeoQueryRange[] {
    if (!Number.isFinite(centerLat) || centerLat < -90 || centerLat > 90) {
        throw new Error(`buildGeoQueryRanges: invalid latitude ${centerLat}`);
    }
    if (!Number.isFinite(centerLng) || centerLng < -180 || centerLng > 180) {
        throw new Error(`buildGeoQueryRanges: invalid longitude ${centerLng}`);
    }
    if (!Number.isFinite(radiusMiles) || radiusMiles <= 0) {
        throw new Error(`buildGeoQueryRanges: radius must be a positive finite number of miles, got ${radiusMiles}`);
    }

    const radiusMeters = radiusMiles * MILES_TO_METERS;
    const bounds = geohashQueryBounds([centerLat, centerLng], radiusMeters);

    // Defensive dedup — not observed to be necessary against geofire-common's
    // current output, but callers should never have to guard against it.
    const seen = new Set<string>();
    const ranges: GeoQueryRange[] = [];
    for (const [start, end] of bounds) {
        const key = `${start}|${end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        ranges.push({ start, end });
    }
    return ranges;
}
