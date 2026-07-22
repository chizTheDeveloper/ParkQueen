import type { LocationPermissionState } from './nearbyActivity';

export interface NotificationsSummaryState {
  statusKey: 'settings.notif_on' | 'settings.notif_off';
  showRadius: boolean;
  radius: number;
}

export interface LocationSummaryState {
  permissionKey:
    | 'settings.location_allowed'
    | 'settings.location_not_enabled'
    | 'settings.location_not_allowed'
    | 'settings.location_blocked'
    | 'settings.location_services_off';
  preciseKey: 'settings.precise_on' | 'settings.precise_off';
}

export function getNotificationsSummaryState(
  enabled: boolean,
  radius: number,
): NotificationsSummaryState {
  return {
    statusKey: enabled ? 'settings.notif_on' : 'settings.notif_off',
    showRadius: enabled,
    radius,
  };
}

export function getLocationSummaryState(
  permissionState: LocationPermissionState,
  precise: boolean,
): LocationSummaryState {
  const permissionKey: LocationSummaryState['permissionKey'] = (() => {
    switch (permissionState) {
      case 'granted':           return 'settings.location_allowed';
      case 'not_determined':    return 'settings.location_not_enabled';
      case 'denied_requestable':return 'settings.location_not_allowed';
      case 'permanently_blocked': return 'settings.location_blocked';
      case 'services_disabled': return 'settings.location_services_off';
    }
  })();
  return {
    permissionKey,
    preciseKey: precise ? 'settings.precise_on' : 'settings.precise_off',
  };
}
