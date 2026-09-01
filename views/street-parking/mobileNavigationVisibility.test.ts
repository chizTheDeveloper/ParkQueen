import { describe, expect, it } from 'vitest';
import { shouldShowMapPrimaryNavigation } from './mobileNavigationVisibility';

describe('map primary-navigation visibility', () => {
  it('shows only on the idle Map root', () => {
    expect(shouldShowMapPrimaryNavigation({ enabled: true })).toBe(true);
    expect(shouldShowMapPrimaryNavigation({ enabled: false })).toBe(false);
  });

  it.each([
    'spotModalOpen',
    'spotDetailsOpen',
    'sessionSheetOpen',
    'postSaveOfferOpen',
    'departureSheetOpen',
    'handoffSheetOpen',
    'stackSheetOpen',
    'deleteDialogOpen',
    'destinationActivitySheetOpen',
  ] as const)('hides while %s is active', state => {
    expect(shouldShowMapPrimaryNavigation({ enabled: true, [state]: true })).toBe(false);
  });
});
