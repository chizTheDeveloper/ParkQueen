export interface UserLocationGeohashInput {
  trackingAllowed: boolean;
  authUid: string | null;
  ownerUid: string | null;
  geohash: string;
}

export type UserLocationGeohashWrite = (uid: string, geohash: string) => Promise<void>;

export const createUserLocationGeohashPersister = (write: UserLocationGeohashWrite) => {
  let lastWrittenOwnerPrefix: string | null = null;
  let writeInFlight = false;

  return {
    async persist(input: UserLocationGeohashInput): Promise<'written' | 'skipped'> {
      const { trackingAllowed, authUid, ownerUid, geohash } = input;
      if (!trackingAllowed || !authUid || !ownerUid || authUid !== ownerUid) return 'skipped';

      const prefix = geohash.substring(0, 5);
      if (!prefix) return 'skipped';
      const ownerPrefix = `${ownerUid}:${prefix}`;
      if (writeInFlight || ownerPrefix === lastWrittenOwnerPrefix) return 'skipped';

      writeInFlight = true;
      try {
        await write(ownerUid, geohash);
        lastWrittenOwnerPrefix = ownerPrefix;
        return 'written';
      } finally {
        writeInFlight = false;
      }
    },
  };
};
