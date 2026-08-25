export interface GeoQueryRange {
    start: string;
    end: string;
}

export function rangeKey(range: GeoQueryRange): string {
    return `${range.start}:${range.end}`;
}

export function normalizeRangeKeys(ranges: GeoQueryRange[]): string[] {
    return Array.from(new Set(ranges.map(rangeKey))).sort();
}

export function rangeKeySetsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.every((k, i) => k === sb[i]);
}

/**
 * Merges one Map<docId, T> per geohash range into a single canonical
 * Map<docId, T>. A document present in more than one range is included
 * exactly once. Ranges are merged in sorted-key order for a deterministic
 * (if arbitrary) tiebreak — in practice the same Firestore document read
 * from two ranges carries identical data, so the tiebreak never matters.
 */
export function mergeRangeMaps<T>(rangeMaps: Map<string, Map<string, T>>): Map<string, T> {
    const merged = new Map<string, T>();
    for (const key of Array.from(rangeMaps.keys()).sort()) {
        const rangeMap = rangeMaps.get(key);
        if (!rangeMap) continue;
        for (const [docId, value] of rangeMap) {
            merged.set(docId, value);
        }
    }
    return merged;
}

type Unsubscribe = () => void;

type SubscribeRangeFn<T> = (
    range: GeoQueryRange,
    onSnapshot: (docs: Array<{ id: string; data: T }>) => void,
    onError: (err: unknown) => void,
) => Unsubscribe;

export interface GeoRegionSubscriptionOptions<T, M = undefined> {
    subscribeRange: SubscribeRangeFn<T>;
    onData: (merged: Map<string, T>, metadata: M) => void;
    onActiveListenerError?: (err: unknown, key: string) => void;
    onPendingListenerError?: (err: unknown, key: string) => void;
}

/**
 * Manages the active/pending/generation bookkeeping for a set of
 * simultaneous geohash-range Firestore listeners, independent of Firestore
 * and React so it can be exercised with a fake subscribeRange in tests.
 *
 * Contract:
 *  - setRegion(ranges) only replaces the ACTIVE subscription set once every
 *    range in the NEW set has delivered its initial snapshot — the old
 *    active set keeps serving data until then (no empty-map flash).
 *  - if setRegion is called again before a pending set finishes
 *    initializing, that stale pending set is discarded (its listeners
 *    unsubscribed) and can never later become active, even if a late
 *    snapshot for it arrives afterward.
 *  - if a PENDING range errors before promotion, the whole pending
 *    generation is discarded and the existing active set is preserved.
 *  - if an ACTIVE range errors, its last-known data is left in place —
 *    matches the pre-existing single-listener behavior of only logging.
 *  - setRegion(ranges) with a key-set identical to the current ACTIVE set
 *    is a no-op with respect to Firestore listeners — no new subscriptions
 *    are created — but the caller-supplied metadata (e.g. the exact-radius
 *    center/radius pair to filter against) is still updated and published
 *    immediately, since there is no pending replacement to wait for.
 *  - when a range-set DOES change, the metadata passed alongside the new
 *    ranges is held pending and only becomes "active" (published to onData)
 *    atomically together with the data, at promotion time. This guarantees
 *    a caller doing exact-distance filtering never filters the OLD active
 *    dataset against a NEW center/radius before the new dataset exists.
 */
export class GeoRegionSubscription<T, M = undefined> {
    private readonly subscribeRange: SubscribeRangeFn<T>;
    private readonly onData: (merged: Map<string, T>, metadata: M) => void;
    private readonly onActiveListenerError?: (err: unknown, key: string) => void;
    private readonly onPendingListenerError?: (err: unknown, key: string) => void;

    private generationCounter = 0;
    private activeGeneration = -1;
    private activeRangeMaps = new Map<string, Map<string, T>>();
    private activeUnsubs = new Map<string, Unsubscribe>();
    private activeMetadata!: M;

    private pendingGeneration = -1;
    private pendingRangeMaps = new Map<string, Map<string, T>>();
    private pendingUnsubs = new Map<string, Unsubscribe>();
    private pendingReady = new Set<string>();
    private pendingTotal = 0;
    private pendingMetadata!: M;

    private disposed = false;

    constructor(options: GeoRegionSubscriptionOptions<T, M>) {
        this.subscribeRange = options.subscribeRange;
        this.onData = options.onData;
        this.onActiveListenerError = options.onActiveListenerError;
        this.onPendingListenerError = options.onPendingListenerError;
    }

    setRegion(ranges: GeoQueryRange[], metadata?: M): void {
        if (this.disposed) return;
        const newKeys = normalizeRangeKeys(ranges);
        const activeKeys = Array.from(this.activeRangeMaps.keys()).sort();

        if (rangeKeySetsEqual(newKeys, activeKeys)) {
            // No Firestore replacement needed — update metadata immediately
            // and re-publish the (unchanged) active dataset against it.
            this.activeMetadata = metadata;
            this.onData(mergeRangeMaps(this.activeRangeMaps), this.activeMetadata);
            return;
        }

        this.discardPending();

        const myGeneration = ++this.generationCounter;
        this.pendingGeneration = myGeneration;
        this.pendingRangeMaps = new Map();
        this.pendingUnsubs = new Map();
        this.pendingReady = new Set();
        this.pendingTotal = newKeys.length;
        this.pendingMetadata = metadata;

        const uniqueRanges = new Map<string, GeoQueryRange>();
        ranges.forEach(r => uniqueRanges.set(rangeKey(r), r));

        for (const [key, range] of uniqueRanges) {
            const unsub = this.subscribeRange(
                range,
                (docs) => this.handleSnapshot(myGeneration, key, docs),
                (err) => this.handleError(myGeneration, key, err),
            );
            this.pendingUnsubs.set(key, unsub);
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.activeUnsubs.forEach(unsub => unsub());
        this.activeUnsubs = new Map();
        this.activeRangeMaps = new Map();
        this.discardPending();
    }

    private handleSnapshot(generation: number, key: string, docs: Array<{ id: string; data: T }>): void {
        if (this.disposed) return;
        const rangeMap = new Map<string, T>();
        docs.forEach(d => rangeMap.set(d.id, d.data));

        if (generation === this.activeGeneration) {
            this.activeRangeMaps.set(key, rangeMap);
            this.onData(mergeRangeMaps(this.activeRangeMaps), this.activeMetadata);
            return;
        }

        if (generation !== this.pendingGeneration) {
            // Superseded generation — already unsubscribed; ignore late snapshot.
            return;
        }

        this.pendingRangeMaps.set(key, rangeMap);
        this.pendingReady.add(key);

        if (this.pendingReady.size >= this.pendingTotal) {
            this.promotePending(generation);
        }
    }

    private handleError(generation: number, key: string, err: unknown): void {
        if (this.disposed) return;
        if (generation === this.activeGeneration) {
            this.onActiveListenerError?.(err, key);
            return;
        }
        if (generation === this.pendingGeneration) {
            this.onPendingListenerError?.(err, key);
            this.discardPending();
        }
    }

    private promotePending(generation: number): void {
        this.activeUnsubs.forEach(unsub => unsub());

        this.activeGeneration = generation;
        this.activeRangeMaps = this.pendingRangeMaps;
        this.activeUnsubs = this.pendingUnsubs;
        this.activeMetadata = this.pendingMetadata;

        this.pendingGeneration = -1;
        this.pendingRangeMaps = new Map();
        this.pendingUnsubs = new Map();
        this.pendingReady = new Set();
        this.pendingTotal = 0;

        this.onData(mergeRangeMaps(this.activeRangeMaps), this.activeMetadata);
    }

    private discardPending(): void {
        this.pendingUnsubs.forEach(unsub => unsub());
        this.pendingGeneration = -1;
        this.pendingRangeMaps = new Map();
        this.pendingUnsubs = new Map();
        this.pendingReady = new Set();
        this.pendingTotal = 0;
    }
}
