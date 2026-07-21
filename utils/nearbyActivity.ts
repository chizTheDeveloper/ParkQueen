import type { LocationAccess } from './locationAccess';

/**
 * Native OS permission state — distinct from the web-only LocationAccess enum.
 * The future React Native layer supplies these values directly from the OS.
 * The web beta derives them from LocationAccess (see nearbyPermissionState below).
 */
export type LocationPermissionState =
    | 'not_determined'      // never asked
    | 'denied_requestable'  // denied but OS still allows re-request (Android pattern)
    | 'permanently_blocked' // user denied permanently — must go to app Settings
    | 'services_disabled'   // device-wide Location Services off — distinct OS action needed
    | 'granted';

/**
 * Callback surface the native layer supplies; the web beta provides web equivalents.
 * Structure is stable — swapping the web adapter for a native one requires no view changes.
 */
export interface LocationCallbacks {
    requestLocationPermission: () => void;    // not_determined + denied_requestable
    openAppSettings: () => void;              // permanently_blocked
    openLocationServicesSettings: () => void; // services_disabled
    recheckPermission: () => void;            // called on foreground / visibilitychange
}

export type NearbyRenderState =
    | 'not_determined'
    | 'denied_requestable'
    | 'permanently_blocked'
    | 'services_disabled'
    | 'locating'
    | 'location_error'
    | 'pings_loading'
    | 'empty'
    | 'results'
    | 'query_error';

export interface NearbyStateParams {
    permissionState: LocationPermissionState;
    locating: boolean;
    locationError: boolean;
    userLocation: [number, number] | null;
    spotsLoading: boolean;
    spotsError: boolean;
    nearbyCount: number;
}

/** Priority-ordered derivation — pure and testable. */
export function deriveNearbyState(p: NearbyStateParams): NearbyRenderState {
    if (p.permissionState === 'services_disabled') return 'services_disabled';
    if (p.permissionState === 'permanently_blocked') return 'permanently_blocked';
    if (p.permissionState === 'denied_requestable') return 'denied_requestable';
    if (p.permissionState !== 'granted') return 'not_determined';
    if (p.locationError) return 'location_error';
    if (p.locating) return 'locating';
    if (p.spotsError) return 'query_error';
    if (p.spotsLoading) return 'pings_loading';
    if (p.nearbyCount === 0) return 'empty';
    return 'results';
}

/** Web beta adapter: maps the web-only LocationAccess to the native permission model. */
export function nearbyPermissionState(access: LocationAccess): LocationPermissionState {
    if (access === 'granted') return 'granted';
    if (access === 'denied') return 'permanently_blocked';
    if (access === 'declined') return 'denied_requestable';
    return 'not_determined'; // 'unknown'
}
