import { describe, it, expect } from 'vitest';
import { deriveNearbyState, type NearbyStateParams } from './nearbyActivity';
import en from '../i18n/en';

const t = (key: string) => en[key] ?? key;

const base: NearbyStateParams = {
    locationAccess: 'granted',
    locating: false,
    locationError: false,
    userLocation: [40.7, -74.0],
    spotsLoading: false,
    spotsError: false,
    nearbyCount: 0,
};

// ─── State derivation ──────────────────────────────────────────────────────────

describe('deriveNearbyState — permission gates', () => {
    it('denied → permission_denied', () => {
        expect(deriveNearbyState({ ...base, locationAccess: 'denied' })).toBe('permission_denied');
    });

    it('unknown → permission_prompt', () => {
        expect(deriveNearbyState({ ...base, locationAccess: 'unknown' })).toBe('permission_prompt');
    });

    it('declined → permission_prompt (user can re-enable from Nearby Activity)', () => {
        expect(deriveNearbyState({ ...base, locationAccess: 'declined' })).toBe('permission_prompt');
    });
});

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

    it('pings_loading when granted + location + spots loading', () => {
        expect(deriveNearbyState({ ...base, spotsLoading: true })).toBe('pings_loading');
    });

    it('empty when granted + location + loaded + 0 spots', () => {
        expect(deriveNearbyState({ ...base, nearbyCount: 0 })).toBe('empty');
    });

    it('results when granted + location + loaded + spots', () => {
        expect(deriveNearbyState({ ...base, nearbyCount: 3 })).toBe('results');
    });
});

describe('deriveNearbyState — priority ordering', () => {
    it('permission_denied beats location_error', () => {
        expect(deriveNearbyState({ ...base, locationAccess: 'denied', locationError: true }))
            .toBe('permission_denied');
    });

    it('permission_prompt beats locating', () => {
        expect(deriveNearbyState({ ...base, locationAccess: 'unknown', locating: true }))
            .toBe('permission_prompt');
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
});

// ─── i18n coverage ─────────────────────────────────────────────────────────────

describe('nearby_activity i18n — English keys present', () => {
    const keys = [
        'nearby_activity.enable_headline',
        'nearby_activity.enable_body',
        'nearby_activity.enable_cta',
        'nearby_activity.enable_requesting',
        'nearby_activity.enable_reassurance',
        'nearby_activity.denied_headline',
        'nearby_activity.denied_body',
        'nearby_activity.denied_how',
        'nearby_activity.denied_check',
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
            const val = t(key as any);
            expect(val).toBeTruthy();
            expect(val).not.toBe(key); // not falling back to the key itself
        });
    }

    it('empty_headline says "No Pings nearby yet"', () => {
        expect(t('nearby_activity.empty_headline')).toBe('No Pings nearby yet');
    });

    it('enable_cta says "Enable location"', () => {
        expect(t('nearby_activity.enable_cta')).toBe('Enable location');
    });
});
