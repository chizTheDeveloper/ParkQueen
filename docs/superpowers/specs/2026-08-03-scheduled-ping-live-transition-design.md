# Scheduled Ping Live Transition Design

## Goal

An unclaimed “Leaving later” Ping becomes a normal live Ping at its persisted
`reportedAt` boundary without a Firestore write, snapshot, refresh, or reopening
the card.

## State model

`pingMode` records creation intent only. Current presentation is derived from
`reportedAt` and one shared client clock:

- `scheduled`: `reportedAt > now`
- `live`: `reportedAt <= now`

The derived phase is authoritative for available-Ping markers, stack markers and
rows, nearby ordering, the open details card, its badge, and its claim CTA.
Committed and heading claim states retain their existing state machine and owner
controls.

## Boundary clock

The map owns one clock. It schedules the nearest future `reportedAt`, publishes
the current time at the boundary, and reschedules for the next boundary. Window
focus and visible-document resume force an immediate reconciliation so sleeping
or backgrounded tabs cannot remain stale.

## Expiration

The existing normal live lifetime is 30 minutes. Every Ping creation path sets
`expiresAt` to `reportedAt + 30 minutes`, so scheduled time does not consume the
live availability window.

## Scope

This is a frontend-only lifecycle correction. It does not mutate a Ping at the
boundary and does not change Functions, Rules, indexes, notifications, claimed
handoffs, owner actions, FCM, theme, language, or backend behavior. A later
approved release therefore requires Hosting only.

## Verification

Behavioral tests cover timestamp forms, before/at/after boundaries, exact timer
transition, multiple boundaries, resume reconciliation, cleanup, and scheduled
TTL. Rendered browser evidence will keep a details card open across the boundary
and verify its badge, time label, and CTA change in place.
