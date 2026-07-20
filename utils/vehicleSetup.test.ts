/**
 * Pure-function tests for vehicle type data and i18n coverage.
 *
 * Component-level tests (rendering, selection behavior, radio group state,
 * reduced-motion behavior) require @testing-library/react, which is not in
 * the current test architecture. These tests cover everything that can be
 * verified without a DOM.
 */
import { describe, it, expect } from 'vitest';
import { TYPES } from '../utils/vehicleTypes';
import en from '../i18n/en';
import es from '../i18n/es';

// ─── Test 4 & 5: Vehicle type identifiers ───────────────────────────────────

describe('TYPES — vehicle type identifiers', () => {
    it('has exactly 10 vehicle types', () => {
        expect(TYPES).toHaveLength(10);
    });

    it('contains every expected type in the correct order', () => {
        expect([...TYPES]).toEqual([
            'Sedan',
            'Compact',
            'SUV',
            'Hatchback',
            'Coupe',
            'Pickup Truck',
            'Van',
            'Minivan',
            'Wagon',
            'Convertible',
        ]);
    });

    it('identifiers match Firestore storage strings exactly (no rename guard)', () => {
        // These string values are written directly to users/{uid}.vehicleType in Firestore.
        // If any changes here, the corresponding Firestore data must be migrated.
        const expected = ['Sedan','Compact','SUV','Hatchback','Coupe','Pickup Truck','Van','Minivan','Wagon','Convertible'] as const;
        expected.forEach(id => expect(TYPES).toContain(id));
    });
});

// ─── Test 16: i18n coverage — English ───────────────────────────────────────

describe('English i18n — vehicle type labels', () => {
    const typeKeyMap: Record<string, string> = {
        'Sedan':        'vehicle.type_sedan',
        'Compact':      'vehicle.type_compact',
        'SUV':          'vehicle.type_suv',
        'Hatchback':    'vehicle.type_hatchback',
        'Coupe':        'vehicle.type_coupe',
        'Pickup Truck': 'vehicle.type_pickup_truck',
        'Van':          'vehicle.type_van',
        'Minivan':      'vehicle.type_minivan',
        'Wagon':        'vehicle.type_wagon',
        'Convertible':  'vehicle.type_convertible',
    };

    TYPES.forEach(type => {
        it(`"${type}" has an English label that is not a raw i18n key`, () => {
            const key = typeKeyMap[type];
            expect(key).toBeDefined();
            const label = en[key];
            expect(label).toBeDefined();
            expect(label).not.toBe(key);   // not a fallback raw key
            expect(label.length).toBeGreaterThan(0);
        });
    });

    it('Step 4 of 4 label is present', () => {
        expect(en['vehicle.step']).toBe('Step 4 of 4');
    });

    it('eyebrow copy is present', () => {
        expect(en['vehicle.eyebrow']).toBe('VEHICLE DETAILS');
    });

    it('substep counts are present', () => {
        expect(en['vehicle.substep_count_type']).toBe('1 OF 3');
        expect(en['vehicle.substep_count_brand']).toBe('2 OF 3');
        expect(en['vehicle.substep_count_color']).toBe('3 OF 3');
    });

    it('headline and supporting copy are present', () => {
        expect(en['vehicle.headline_type']).toBe('Choose your vehicle type');
        expect(en['vehicle.supporting_type']).toContain('other drivers');
        // Must not contain "Optional" — Skip action communicates optionality
        expect(en['vehicle.supporting_type']).not.toContain('Optional');
    });

    it('"Skip for now" is present in English', () => {
        expect(en['vehicle.skip_for_now']).toBe('Skip for now');
    });
});

// ─── Test 16: i18n coverage — Spanish ───────────────────────────────────────

describe('Spanish i18n — vehicle type labels', () => {
    const typeKeyMap: Record<string, string> = {
        'Sedan':        'vehicle.type_sedan',
        'Compact':      'vehicle.type_compact',
        'SUV':          'vehicle.type_suv',
        'Hatchback':    'vehicle.type_hatchback',
        'Coupe':        'vehicle.type_coupe',
        'Pickup Truck': 'vehicle.type_pickup_truck',
        'Van':          'vehicle.type_van',
        'Minivan':      'vehicle.type_minivan',
        'Wagon':        'vehicle.type_wagon',
        'Convertible':  'vehicle.type_convertible',
    };

    TYPES.forEach(type => {
        it(`"${type}" has a Spanish label that is not a raw i18n key`, () => {
            const key = typeKeyMap[type];
            const label = es[key];
            expect(label).toBeDefined();
            expect(label).not.toBe(key);
            expect(label.length).toBeGreaterThan(0);
        });
    });

    it('Step 4 de 4 label is present in Spanish', () => {
        expect(es['vehicle.step']).toBe('Paso 4 de 4');
    });

    it('eyebrow copy is present in Spanish', () => {
        expect(es['vehicle.eyebrow']).toBe('DATOS DEL VEHÍCULO');
    });

    it('substep counts are present in Spanish', () => {
        expect(es['vehicle.substep_count_type']).toBe('1 DE 3');
        expect(es['vehicle.substep_count_brand']).toBe('2 DE 3');
        expect(es['vehicle.substep_count_color']).toBe('3 DE 3');
    });

    it('skip for now is "Omitir por ahora" in Spanish', () => {
        // Updated from "Saltar por ahora" to match product copy spec
        expect(es['vehicle.skip_for_now']).toBe('Omitir por ahora');
    });

    it('supporting copy is present in Spanish and does not contain "Optional"', () => {
        const val = es['vehicle.supporting_type'];
        expect(val).toBeDefined();
        expect(val.length).toBeGreaterThan(0);
        expect(val).not.toContain('Optional');
    });
});
