import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PING_LIVE_TTL_MS,
  createPingPhaseClock,
  derivePingLifecycle,
  getPingExpiresAtMs,
  getPingPhase,
  getNextPingPhaseBoundary,
} from './pingLifecycle';

const scheduledAt = Date.parse('2026-08-03T16:00:00.000Z');
const timestamp = { toMillis: () => scheduledAt };

afterEach(() => {
  vi.useRealTimers();
});

describe('scheduled Ping phase', () => {
  it('is still scheduled five minutes and one second before departure', () => {
    const ping = { reportedAt: timestamp };
    expect(getPingPhase(ping, scheduledAt - 5 * 60_000)).toBe('scheduled');
    expect(getPingPhase(ping, scheduledAt - 1_000)).toBe('scheduled');
  });

  it('is scheduled immediately before departure and live at and after departure', () => {
    const ping = { reportedAt: timestamp, pingMode: 'later' as const };

    expect(getPingPhase(ping, scheduledAt - 1)).toBe('scheduled');
    expect(getPingPhase(ping, scheduledAt)).toBe('live');
    expect(getPingPhase(ping, scheduledAt + 1)).toBe('live');
  });

  it('does not let creation intent keep a past Ping scheduled', () => {
    expect(getPingPhase({ reportedAt: { seconds: scheduledAt / 1000 }, pingMode: 'later' }, scheduledAt + 60_000)).toBe('live');
  });

  it('keeps an immediate Ping live', () => {
    expect(getPingPhase({ reportedAt: { seconds: (scheduledAt - 1) / 1000 }, pingMode: 'now' }, scheduledAt)).toBe('live');
  });

  it('normalizes Date, Firestore toMillis, and serialized Timestamp values consistently', () => {
    expect(getPingPhase({ reportedAt: new Date(scheduledAt) }, scheduledAt)).toBe('live');
    expect(getPingPhase({ reportedAt: timestamp }, scheduledAt - 1)).toBe('scheduled');
    expect(getPingPhase({ reportedAt: { seconds: scheduledAt / 1000 } }, scheduledAt)).toBe('live');
    expect(getPingPhase({ reportedAt: { seconds: scheduledAt / 1000, nanoseconds: 500_000_000 } }, scheduledAt + 499)).toBe('scheduled');
    expect(getPingPhase({ reportedAt: { seconds: scheduledAt / 1000, nanoseconds: 500_000_000 } }, scheduledAt + 500)).toBe('live');
  });

  it('finds the nearest future transition across multiple Pings', () => {
    const items = [
      { reportedAt: { seconds: (scheduledAt + 120_000) / 1000 } },
      { reportedAt: { seconds: (scheduledAt + 30_000) / 1000 } },
      { reportedAt: { seconds: (scheduledAt - 1) / 1000 }, expiresAt: { seconds: (scheduledAt + 10_000) / 1000 } },
    ];

    expect(getNextPingPhaseBoundary(items, scheduledAt)).toBe(scheduledAt + 10_000);
  });
});

describe('claim-safe Ping lifecycle', () => {
  const base = {
    finderId: 'owner', status: 'available', reportedAt: timestamp,
    expiresAt: { toMillis: () => scheduledAt + 30 * 60_000 },
  };

  it('transitions the same unclaimed Ping from scheduled to live', () => {
    expect(derivePingLifecycle(base, scheduledAt - 1, 'viewer').state).toBe('scheduled_unclaimed');
    expect(derivePingLifecycle(base, scheduledAt, 'viewer').state).toBe('live_unclaimed');
  });

  it('keeps a claimed scheduled Ping assigned and non-claimable after departure', () => {
    const claimed = { ...base, status: 'interested', interestedUserId: 'claimer' };
    expect(derivePingLifecycle(claimed, scheduledAt - 1, 'other')).toMatchObject({ state: 'scheduled_claimed', claimed: true, canClaim: false });
    expect(derivePingLifecycle(claimed, scheduledAt + 1, 'other')).toMatchObject({ state: 'live_claimed', claimed: true, canClaim: false, isClaimant: false });
    expect(derivePingLifecycle(claimed, scheduledAt + 1, 'claimer').isClaimant).toBe(true);
  });

  it('never offers the creator a claim action', () => {
    expect(derivePingLifecycle(base, scheduledAt, 'owner')).toMatchObject({ isOwner: true, canClaim: false });
    expect(derivePingLifecycle(base, scheduledAt, 'other')).toMatchObject({ isOwner: false, canClaim: true });
  });

  it('derives the same result for multiple clients with the same data and time', () => {
    expect(derivePingLifecycle(base, scheduledAt, 'client-a').state).toBe(derivePingLifecycle(base, scheduledAt, 'client-b').state);
  });

  it('expires deterministically at expiresAt', () => {
    expect(derivePingLifecycle(base, scheduledAt + 30 * 60_000 - 1, 'viewer').expired).toBe(false);
    expect(derivePingLifecycle(base, scheduledAt + 30 * 60_000, 'viewer')).toMatchObject({ state: 'expired', expired: true, canClaim: false });
  });
});

describe('scheduled Ping boundary clock', () => {
  it('publishes the live phase at the exact boundary without a snapshot', () => {
    vi.useFakeTimers();
    vi.setSystemTime(scheduledAt - 1_000);
    const phases: string[] = [];
    const clock = createPingPhaseClock({
      getItems: () => [{ reportedAt: timestamp, pingMode: 'later' }],
      onTick: now => phases.push(getPingPhase({ reportedAt: timestamp }, now)),
    });

    clock.start();
    expect(phases).toEqual(['scheduled']);
    vi.advanceTimersByTime(1_000);
    expect(phases).toEqual(['scheduled', 'live']);
    clock.stop();
  });

  it('reschedules through multiple future boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(scheduledAt);
    const ticks: number[] = [];
    const clock = createPingPhaseClock({
      getItems: () => [
        { reportedAt: { seconds: (scheduledAt + 1_000) / 1000 } },
        { reportedAt: { seconds: (scheduledAt + 3_000) / 1000 } },
      ],
      onTick: now => ticks.push(now),
    });

    clock.start();
    vi.advanceTimersByTime(3_000);
    expect(ticks).toEqual([scheduledAt, scheduledAt + 1_000, scheduledAt + 3_000]);
    clock.stop();
  });

  it('reconciles immediately when a suspended tab resumes after departure', () => {
    vi.useFakeTimers();
    vi.setSystemTime(scheduledAt - 60_000);
    const phases: string[] = [];
    const clock = createPingPhaseClock({
      getItems: () => [{ reportedAt: timestamp }],
      onTick: now => phases.push(getPingPhase({ reportedAt: timestamp }, now)),
    });

    clock.start();
    vi.setSystemTime(scheduledAt + 60_000);
    clock.resume();
    expect(phases.at(-1)).toBe('live');
    clock.stop();
  });

  it('cancels its pending transition on cleanup', () => {
    vi.useFakeTimers();
    vi.setSystemTime(scheduledAt - 1_000);
    const onTick = vi.fn();
    const clock = createPingPhaseClock({ getItems: () => [{ reportedAt: timestamp }], onTick });

    clock.start();
    clock.stop();
    vi.advanceTimersByTime(1_000);
    expect(onTick).toHaveBeenCalledTimes(1);
  });
});

describe('Ping expiration', () => {
  it('starts the normal 30-minute live TTL at a scheduled departure', () => {
    expect(PING_LIVE_TTL_MS).toBe(30 * 60 * 1000);
    expect(getPingExpiresAtMs(timestamp)).toBe(scheduledAt + 30 * 60 * 1000);
  });
});
