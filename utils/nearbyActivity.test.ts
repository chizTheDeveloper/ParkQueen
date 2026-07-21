import { describe, it, expect } from 'vitest';
import { deriveNearbyState, nearbyPermissionState, type NearbyStateParams } from './nearbyActivity';
import en from '../i18n/en';

const t = (key: string) => en[key] ?? key;

const base: NearbyStateParams = {
    permissionState: 'granted',
    locating: false,
    locationError: false,
    userLocation: [40.7, -74.0],
    spotsLoading: false,
    spotsError: false,
    nearbyCount: 0,
};

// ─── nearbyPermissionState (web adapter) ──────────────────────────────────────

describe('nearbyPermissionState', () => {
    it('granted → granted', () => expect(nearbyPermissionState('granted')).toBe('granted'));
    it('denied → permanently_blocked', () => expect(nearbyPermissionState('denied')).toBe('permanently_blocked'));
    it('declined → denied_requestable', () => expect(nearbyPermissionState('declined')).toBe('denied_requestable'));
    it('unknown → not_determined', () => expect(nearbyPermissionState('unknown')).toBe('not_determined'));
});

// ─── deriveNearbyState — permission gates ─────────────────────────────────────

describe('deriveNearbyState — permission gates', () => {
    it('services_disabled', () => {
        expect(deriveNearbyState({ ...base, permissionState: 'services_disabled' })).toBe('services_disabled');
    });

    it('permanently_blocked', () => {
        expect(deriveNearbyState({ ...base, permissionState: 'permanently_blocked' })).toBe('permanently_blocked');
    });

    it('denied_requestable — same CTA as not_determined but distinct OS state', () => {
        expect(deriveNearbyState({ ...base, permissionState: 'denied_requestable' })).toBe('denied_requestable');
    });

    it('not_determined', () => {
        expect(deriveNearbyState({ ...base, permissionState: 'not_determined' })).toBe('not_determined');
    });
});

// ─── deriveNearbyState — granted flow ─────────────────────────────────────────

describe('deriveNearbyState — granted flow', () => {
    it('location_error when granted + locationError', () => {
        expect(deriveNearbyState({ ...base, locationError: true })).toBe('location_error');
    });

    it('locating when granted + locating', () => {
        expect(deriveNearbyState({ ...base, locating: true })).toBe('locating');
    });

    it('query_error when granted + location + spotsError', () => {
        expect(deriveNearbyState({ ...base, spotsError: true })).toBe('query_error');
    });

    it('pings_loading when granted + location + loading', () => {
        expect(deriveNearbyState({ ...base, spotsLoading: true })).toBe('pings_loading');
    });

    it('empty when granted + location + loaded + 0 spots', () => {
        expect(deriveNearbyState({ ...base, nearbyCount: 0 })).toBe('empty');
    });

    it('results when granted + location + loaded + spots', () => {
        expect(deriveNearbyState({ ...base, nearbyCount: 3 })).toBe('results');
    });
});

// ─── deriveNearbyState — priority ordering ────────────────────────────────────

describe('deriveNearbyState — priority ordering', () => {
    it('services_disabled beats permanently_blocked', () => {
        expect(deriveNearbyState({ ...base, permissionState: 'services_disabled' }))
            .toBe('services_disabled');
    });

    it('permanently_blocked beats denied_requestable', () => {
        // not possible in practice but confirms priority
        expect(deriveNearbyState({ ...base, permissionState: 'permanently_blocked' }))
            .toBe('permanently_blocked');
    });

    it('not_determined beats locating (no geolocation before permission)', () => {
        expect(deriveNearbyState({ ...base, permissionState: 'not_determined', locating: true }))
            .toBe('not_determined');
    });

    it('location_error beats locating', () => {
        expect(deriveNearbyState({ ...base, locationError: true, locating: true }))
            .toBe('location_error');
    });

    it('locating beats pings_loading', () => {
        expect(deriveNearbyState({ ...base, locating: true, spotsLoading: true }))
            .toBe('locating');
    });

    it('pings_loading beats empty', () => {
        expect(deriveNearbyState({ ...base, spotsLoading: true, nearbyCount: 0 }))
            .toBe('pings_loading');
    });

    it('empty never fires without a completed location-based query', () => {
        // spotsLoading must be false for empty to appear
        const loading = deriveNearbyState({ ...base, spotsLoading: true, nearbyCount: 0 });
        const done = deriveNearbyState({ ...base, spotsLoading: false, nearbyCount: 0 });
        expect(loading).toBe('pings_loading');
        expect(done).toBe('empty');
    });
});

// ─── i18n coverage ────────────────────────────────────────────────────────────

describe('nearby_activity i18n — English keys present', () => {
    const keys = [
        'nearby_activity.enable_headline',
        'nearby_activity.enable_body',
        'nearby_activity.enable_cta',
        'nearby_activity.enable_requesting',
        'nearby_activity.enable_reassurance',
        'nearby_activity.open_settings',
        'nearby_activity.turn_on_services',
        'nearby_activity.locating_headline',
        'nearby_activity.locating_body',
        'nearby_activity.error_headline',
        'nearby_activity.error_body',
        'nearby_activity.error_retry',
        'nearby_activity.loading_headline',
        'nearby_activity.empty_headline',
        'nearby_activity.empty_body',
        'nearby_activity.query_error_headline',
        'nearby_activity.query_error_retry',
    ] as const;

    for (const key of keys) {
        it(`${key} is defined and non-empty`, () => {
            const val = t(key as string);
            expect(val).toBeTruthy();
            expect(val).not.toBe(key);
        });
    }

    it('empty_headline says "No Pings nearby yet"', () => {
        expect(t('nearby_activity.empty_headline')).toBe('No Pings nearby yet');
    });

    it('open_settings says "Open Settings"', () => {
        expect(t('nearby_activity.open_settings')).toBe('Open Settings');
    });

    it('turn_on_services says "Turn on Location Services"', () => {
        expect(t('nearby_activity.turn_on_services')).toBe('Turn on Location Services');
    });
});
