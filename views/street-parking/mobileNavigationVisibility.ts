interface MapPrimaryNavigationState {
  enabled: boolean;
  spotModalOpen?: boolean;
  spotDetailsOpen?: boolean;
  sessionSheetOpen?: boolean;
  postSaveOfferOpen?: boolean;
  departureSheetOpen?: boolean;
  handoffSheetOpen?: boolean;
  stackSheetOpen?: boolean;
  deleteDialogOpen?: boolean;
  destinationActivitySheetOpen?: boolean;
}

export function shouldShowMapPrimaryNavigation(state: MapPrimaryNavigationState): boolean {
  return state.enabled && !(
    state.spotModalOpen
    || state.spotDetailsOpen
    || state.sessionSheetOpen
    || state.postSaveOfferOpen
    || state.departureSheetOpen
    || state.handoffSheetOpen
    || state.stackSheetOpen
    || state.deleteDialogOpen
    || state.destinationActivitySheetOpen
  );
}
