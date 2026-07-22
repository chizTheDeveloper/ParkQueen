import { describe, it, expect } from 'vitest';
import { getNotificationsSummaryState, getLocationSummaryState } from './settingsSummary';

describe('getNotificationsSummaryState', () => {
  it('enabled + radius returns on key and shows radius', () => {
    const s = getNotificationsSummaryState(true, 1);
    expect(s.statusKey).toBe('settings.notif_on');
    expect(s.showRadius).toBe(true);
    expect(s.radius).toBe(1);
  });

  it('disabled returns off key and hides radius', () => {
    const s = getNotificationsSummaryState(false, 2);
    expect(s.statusKey).toBe('settings.notif_off');
    expect(s.showRadius).toBe(false);
  });

  it('passes through any valid radius', () => {
    expect(getNotificationsSummaryState(true, 5).radius).toBe(5);
  });
});

describe('getLocationSummaryState', () => {
  it('granted + precise on', () => {
    const s = getLocationSummaryState('granted', true);
    expect(s.permissionKey).toBe('settings.location_allowed');
    expect(s.preciseKey).toBe('settings.precise_on');
  });

  it('granted + precise off', () => {
    const s = getLocationSummaryState('granted', false);
    expect(s.permissionKey).toBe('settings.location_allowed');
    expect(s.preciseKey).toBe('settings.precise_off');
  });

  it('not_determined', () => {
    expect(getLocationSummaryState('not_determined', false).permissionKey)
      .toBe('settings.location_not_enabled');
  });

  it('permanently_blocked', () => {
    expect(getLocationSummaryState('permanently_blocked', true).permissionKey)
      .toBe('settings.location_blocked');
  });

  it('denied_requestable', () => {
    expect(getLocationSummaryState('denied_requestable', false).permissionKey)
      .toBe('settings.location_not_allowed');
  });

  it('services_disabled', () => {
    expect(getLocationSummaryState('services_disabled', false).permissionKey)
      .toBe('settings.location_services_off');
  });
});
