import { describe, expect, it, vi } from 'vitest';
import { resolveNotificationPing } from './notificationPing';

const live = {
  id: 'spot-live', status: 'available', lat: 40.7, lng: -74,
  expiresAt: { toMillis: () => 2_000 },
};

describe('notification Ping resolution', () => {
  it('uses a live Ping already present in current map state', async () => {
    const fetchById = vi.fn();
    await expect(resolveNotificationPing('spot-live', [live], 1_000, fetchById))
      .resolves.toEqual({ kind: 'live', item: live });
    expect(fetchById).not.toHaveBeenCalled();
  });

  it('falls back when a current Ping has expired before the tap', async () => {
    await expect(resolveNotificationPing('spot-live', [live], 2_001, vi.fn()))
      .resolves.toEqual({ kind: 'unavailable' });
  });

  it('fetches a missing current-map Ping and opens it only if still live', async () => {
    const fetched = { ...live, id: 'spot-fetched' };
    const fetchById = vi.fn().mockResolvedValue(fetched);
    await expect(resolveNotificationPing('spot-fetched', [], 1_000, fetchById))
      .resolves.toEqual({ kind: 'live', item: fetched });
    expect(fetchById).toHaveBeenCalledWith('spot-fetched');
  });

  it.each([
    null,
    { ...live, id: 'spot-missing', status: 'archived' },
    { ...live, id: 'spot-missing', expiresAt: { toMillis: () => 999 } },
  ])('fails closed for a missing or unavailable fetched Ping %#', async (fetched) => {
    await expect(resolveNotificationPing('spot-missing', [], 1_000, vi.fn().mockResolvedValue(fetched)))
      .resolves.toEqual({ kind: 'unavailable' });
  });
});
