# Yellow Ping Status Design

## Summary

Add yellow map markers for "Leaving Later" pings alongside existing blue "Leaving Now" pings. Yellow pings automatically transition to blue when their scheduled departure time arrives. Remove unused paid/public marker logic.

## Data Model

**No new fields required.** The existing `reportedAt` timestamp already distinguishes now vs later. Add one explicit field for clarity:

- `pingMode: 'now' | 'later'` — written at creation time, stored on the spot document

A spot is visually "leaving later" (yellow) when `reportedAt` is more than 1 minute in the future. Once `reportedAt` passes, it displays as "leaving now" (blue). The `pingMode` field preserves the user's original intent for analytics/queries but the visual color is always derived from the current time vs `reportedAt`.

**Validation:** The SpotModal rejects departure times in the past. Only future times are accepted for "Leaving Later".

## Marker Rendering

### `createMarkerElement` (utils.ts)

Add a `scheduled` boolean parameter:
- `scheduled: false` → blue pin (`#1e75ff`)
- `scheduled: true` → yellow pin (`#eab308`)

Remove the `'paid'` and `'public'` type branches and the price pill HTML — those features are disabled (`showPaid`/`showPublic` are always false). The function simplifies to:

```
createMarkerElement(scheduled: boolean): HTMLDivElement
```

### Marker effect (StreetParkingView.tsx)

The caller computes `isScheduled` for each item:
```
const isScheduled = item.reportedAt &&
  (typeof item.reportedAt.toMillis === 'function'
    ? item.reportedAt.toMillis()
    : item.reportedAt.seconds * 1000) > Date.now() + 60_000;
```

**Yellow→blue transition:** Existing markers are only created when their ID is new. To handle the color transition without a full page refresh, store `isScheduled` as a data attribute on the marker element. On each render pass, if the marker exists but its scheduled state has changed, remove and recreate it with the new color.

## SpotDetailsCard

When a spot is scheduled (yellow):
- **Status badge:** "Soon" with yellow styling (`text-amber-400 bg-amber-500/10 border-amber-500/20`) instead of "Free" with green
- **Subtext:** "Available at {time}" (e.g. "Available at 6:30 PM") instead of "Departure: Leaving Now"
- **Buttons:** "I'm heading there" remains available — users can reserve scheduled spots

When a scheduled spot's time passes (transitions to blue), the card shows the normal "Leaving Now" state automatically.

## SpotModal

Already functional — "Leaving Now" passes `null` → `reportedAt = now`, "Leaving Later" passes a `Date` → `reportedAt = future time`.

**Add:** Past-time validation. If the user selects a time that's already passed, show an error and block submission.

**Add:** Write `pingMode: 'now'` or `pingMode: 'later'` to the spot document alongside existing fields.

## Cleanup

- Remove `type` parameter from `createMarkerElement` (no longer needed — all rendered spots are free)
- Remove price pill HTML generation
- Remove `priceStr` computation in the marker rendering effect
- Remove unused `'paid'` and `'public'` branches from SpotDetailsCard's badge color logic

## Files Changed

1. `views/street-parking/utils.ts` — simplify `createMarkerElement`
2. `views/StreetParkingView.tsx` — compute `isScheduled`, pass to marker, handle color transitions, write `pingMode`
3. `views/street-parking/SpotDetailsCard.tsx` — yellow badge + "Available at" subtext for scheduled spots
4. `views/street-parking/SpotModal.tsx` — past-time validation
5. `views/street-parking/types.ts` — add `pingMode` to MapItem (optional)

## What This Does NOT Change

- Interest/reservation flow (unchanged)
- Expiration logic (unchanged)
- Push notifications (unchanged)
- Cloud Functions (unchanged)
