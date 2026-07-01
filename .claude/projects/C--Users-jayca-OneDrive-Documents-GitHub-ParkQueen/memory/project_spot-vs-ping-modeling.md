---
name: spot-vs-ping-modeling
description: The spots collection conflates two concepts (physical location vs time-based event) — flagged for future separation
metadata:
  type: project
---

The `spots` Firestore collection currently serves two roles: a physical parking location and a time-based departure event. Both are stored as spot documents. The `originSpotId` field (added 2026-06-28 for the handoff completion flow) is the first explicit link between these two concepts.

**Why:** Future features like spot history, most-active-streets heatmaps, and per-location reliability scores will need to distinguish between the place and the event. The current model will get messy if both keep sharing one collection with no semantic separation.

**How to apply:** When building location-aggregation features (history, heatmaps, reliability), consider introducing a `ParkingSpot` (stable location) vs `ParkingPing` (time-based event) distinction. Not urgent — the current single-collection model works for v1. Flag if a feature proposal would benefit from the split.
