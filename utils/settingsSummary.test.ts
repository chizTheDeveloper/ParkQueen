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
  it('granted + precise on: includes permission key and precise-on key', () => {
    const s = getLocationSummaryState('granted', true);
    expect(s.permissionKey).toBe('settings.location_allowed');
    expect(s.preciseKey).toBe('settings.precise_on');
  });

  it('granted + precise off: includes permission key and precise-off key', () => {
    const s = getLocationSummaryState('granted', false);
    expect(s.permissionKey).toBe('settings.location_allowed');
    expect(s.preciseKey).toBe('settings.precise_off');
  });

  it('not_determined: correct key, no preciseKey', () => {
    const s = getLocationSummaryState('not_determined', true);
    expect(s.permissionKey).toBe('settings.location_not_enabled');
    expect(s.preciseKey).toBeUndefined();
  });

  it('permanently_blocked: correct key, no preciseKey', () => {
    const s = getLocationSummaryState('permanently_blocked', true);
    expect(s.permissionKey).toBe('settings.location_blocked');
    expect(s.preciseKey).toBeUndefined();
  });

  it('denied_requestable: correct key, no preciseKey', () => {
    const s = getLocationSummaryState('denied_requestable', false);
    expect(s.permissionKey).toBe('settings.location_not_allowed');
    expect(s.preciseKey).toBeUndefined();
  });

  it('services_disabled: correct key, no preciseKey', () => {
    const s = getLocationSummaryState('services_disabled', false);
    expect(s.permissionKey).toBe('settings.location_services_off');
    expect(s.preciseKey).toBeUndefined();
  });
});
