import { reportCriticalActionFailure } from '../../utils/errorReporting';

/**
 * All Ping-creation write paths in StreetParkingView (edit-existing-spot
 * batch, immediate-with-known-location, immediate-via-geolocation-callback)
 * share one terminal catch (`onSaveError`) — this is that shared reporting
 * point, so a single failure produces exactly one report regardless of
 * which path triggered it. Never reports coordinates or the scheduled time.
 */
export function reportPingCreationFailure(error: unknown, departureTime: Date | null): void {
  reportCriticalActionFailure('ping_create', error, {
    operationType: departureTime ? 'scheduled' : 'immediate',
  });
}
