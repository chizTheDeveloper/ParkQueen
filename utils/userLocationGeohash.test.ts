import { describe, expect, it } from 'vitest';
import { createUserLocationGeohashPersister } from './userLocationGeohash';

const authorizedInput = {
  trackingAllowed: true,
  authUid: 'new-account-uid',
  ownerUid: 'new-account-uid',
  geohash: 'dr5ru7k2',
};

describe('userLocations geohash persistence ownership', () => {
  it('writes the first authorized GPS geohash for a new account', async () => {
    const writes: Array<{ uid: string; geohash: string }> = [];
    const persister = createUserLocationGeohashPersister(async (uid, geohash) => {
      writes.push({ uid, geohash });
    });

    await expect(persister.persist(authorizedInput)).resolves.toBe('written');
    expect(writes).toEqual([{ uid: 'new-account-uid', geohash: 'dr5ru7k2' }]);
  });

  it('serializes concurrent first updates and skips duplicate prefixes', async () => {
    let releaseWrite!: () => void;
    const pendingWrite = new Promise<void>(resolve => { releaseWrite = resolve; });
    let writes = 0;
    const persister = createUserLocationGeohashPersister(async () => {
      writes += 1;
      await pendingWrite;
    });

    const first = persister.persist(authorizedInput);
    const duplicate = persister.persist({ ...authorizedInput, geohash: 'dr5ruzzz' });

    await expect(duplicate).resolves.toBe('skipped');
    expect(writes).toBe(1);
    releaseWrite();
    await expect(first).resolves.toBe('written');
    await expect(persister.persist({ ...authorizedInput, geohash: 'dr5ru111' })).resolves.toBe('skipped');
    expect(writes).toBe(1);
  });

  it('keeps a failed write retryable instead of caching an unwritten prefix', async () => {
    let attempts = 0;
    const persister = createUserLocationGeohashPersister(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('permission-denied');
    });

    await expect(persister.persist(authorizedInput)).rejects.toThrow('permission-denied');
    await expect(persister.persist(authorizedInput)).resolves.toBe('written');
    expect(attempts).toBe(2);
  });

  it.each([
    ['location permission is denied', { trackingAllowed: false }],
    ['Auth is null after deletion', { authUid: null }],
    ['the rendered user does not own the Auth session', { authUid: 'different-uid' }],
    ['the owner UID is missing', { ownerUid: null }],
  ])('skips persistence when %s', async (_label, override) => {
    let writes = 0;
    const persister = createUserLocationGeohashPersister(async () => { writes += 1; });

    await expect(persister.persist({ ...authorizedInput, ...override })).resolves.toBe('skipped');
    expect(writes).toBe(0);
  });

  it('treats a recreated account UID as a separate owner even at the same geohash', async () => {
    const writes: string[] = [];
    const persister = createUserLocationGeohashPersister(async uid => { writes.push(uid); });

    await persister.persist({ ...authorizedInput, authUid: 'old-uid', ownerUid: 'old-uid' });
    await persister.persist({ ...authorizedInput, authUid: 'new-uid', ownerUid: 'new-uid' });

    expect(writes).toEqual(['old-uid', 'new-uid']);
  });
});
