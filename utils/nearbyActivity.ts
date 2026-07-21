import type { LocationAccess } from './locationAccess';

export type NearbyRenderState =
    | 'permission_prompt'
    | 'permission_denied'
    | 'locating'
    | 'location_error'
    | 'pings_loading'
    | 'empty'
    | 'results'
    | 'query_error';

export interface NearbyStateParams {
    locationAccess: LocationAccess;
    locating: boolean;
    locationError: boolean;
    userLocation: [number, number] | null;
    spotsLoading: boolean;
    spotsError: boolean;
    nearbyCount: number;
}

/** Priority-ordered state derivation — pure and testable. */
export function deriveNearbyState(p: NearbyStateParams): NearbyRenderState {
    if (p.locationAccess === 'denied') return 'permission_denied';
    if (p.locationAccess !== 'granted') return 'permission_prompt';
    if (p.locationError) return 'location_error';
    if (p.locating) return 'locating';
    if (p.spotsError) return 'query_error';
    if (p.spotsLoading) return 'pings_loading';
    if (p.nearbyCount === 0) return 'empty';
    return 'results';
}
