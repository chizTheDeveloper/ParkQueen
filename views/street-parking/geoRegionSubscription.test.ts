import { describe, expect, it, vi } from 'vitest';
import {
    GeoRegionSubscription,
    rangeKey,
    mergeRangeMaps,
    rangeKeySetsEqual,
    normalizeRangeKeys,
} from './geoRegionSubscription';

type Doc = { id: string; data: { name: string } };

/** A fake subscribeRange that lets tests control exactly when each range
 * "delivers" a snapshot or an error, and records every call it receives. */
function makeFakeSubscriber() {
    const calls: Array<{
        key: string;
        emit: (docs: Doc[]) => void;
        emitError: (err: unknown) => void;
        unsubscribed: boolean;
    }> = [];

    const subscribeRange = vi.fn((range: { start: string; end: string }, onSnapshot: (docs: Doc[]) => void, onError: (err: unknown) => void) => {
        const call = {
            key: rangeKey(range),
            emit: (docs: Doc[]) => onSnapshot(docs),
            emitError: (err: unknown) => onError(err),
            unsubscribed: false,
        };
        calls.push(call);
        return () => { call.unsubscribed = true; };
    });

    return { subscribeRange, calls };
}

describe('pure helpers', () => {
    it('rangeKey is deterministic from start/end', () => {
        expect(rangeKey({ start: 'a', end: 'b' })).toBe('a:b');
    });

    it('normalizeRangeKeys dedupes and sorts', () => {
        expect(normalizeRangeKeys([{ start: 'b', end: 'c' }, { start: 'a', end: 'b' }, { start: 'b', end: 'c' }]))
            .toEqual(['a:b', 'b:c']);
    });

    it('rangeKeySetsEqual ignores order', () => {
        expect(rangeKeySetsEqual(['a:b', 'c:d'], ['c:d', 'a:b'])).toBe(true);
        expect(rangeKeySetsEqual(['a:b'], ['a:b', 'c:d'])).toBe(false);
    });

    it('mergeRangeMaps: one range + one document -> one canonical document', () => {
        const rangeMaps = new Map([['r1', new Map([['doc1', { name: 'a' }]])]]);
        const merged = mergeRangeMaps(rangeMaps);
        expect(merged.size).toBe(1);
        expect(merged.get('doc1')).toEqual({ name: 'a' });
    });

    it('mergeRangeMaps: two ranges containing the same document -> one canonical document', () => {
        const rangeMaps = new Map([
            ['r1', new Map([['doc1', { name: 'a' }]])],
            ['r2', new Map([['doc1', { name: 'a' }]])],
        ]);
        const merged = mergeRangeMaps(rangeMaps);
        expect(merged.size).toBe(1);
    });

    it('mergeRangeMaps: multiple unique docs across multiple ranges -> complete merged set', () => {
        const rangeMaps = new Map([
            ['r1', new Map([['doc1', { name: 'a' }]])],
            ['r2', new Map([['doc2', { name: 'b' }], ['doc3', { name: 'c' }]])],
        ]);
        const merged = mergeRangeMaps(rangeMaps);
        expect(merged.size).toBe(3);
        expect([...merged.keys()].sort()).toEqual(['doc1', 'doc2', 'doc3']);
    });
});

describe('GeoRegionSubscription — initial region and simple updates', () => {
    it('one range + one document -> onData receives one canonical document', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }]);
        calls[0].emit([{ id: 'doc1', data: { name: 'a' } }]);

        expect(onData).toHaveBeenCalledTimes(1);
        expect(onData.mock.calls[0][0].get('doc1')).toEqual({ name: 'a' });
    });

    it('removing document from range A while still present in range B -> document remains canonical', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }, { start: 'c', end: 'd' }]);
        // both ranges report doc1 initially
        calls[0].emit([{ id: 'doc1', data: { name: 'a' } }]);
        calls[1].emit([{ id: 'doc1', data: { name: 'a' } }]);
        // range A's next snapshot no longer contains doc1 (e.g. it moved out of A's geohash cell)
        calls[0].emit([]);

        const last = onData.mock.calls.at(-1)![0];
        expect(last.has('doc1')).toBe(true);
    });

    it('removing from the final containing range -> document disappears', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }]);
        calls[0].emit([{ id: 'doc1', data: { name: 'a' } }]);
        calls[0].emit([]);

        const last = onData.mock.calls.at(-1)![0];
        expect(last.has('doc1')).toBe(false);
    });

    it('duplicate generated ranges -> only one listener created', () => {
        const { subscribeRange } = makeFakeSubscriber();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData: vi.fn() });
        sub.setRegion([{ start: 'a', end: 'b' }, { start: 'a', end: 'b' }]);
        expect(subscribeRange).toHaveBeenCalledTimes(1);
    });

    it('identical normalized range key set -> no subscription replacement required', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }]);
        calls[0].emit([{ id: 'doc1', data: { name: 'a' } }]); // promotes to active
        expect(subscribeRange).toHaveBeenCalledTimes(1);

        sub.setRegion([{ start: 'a', end: 'b' }]); // same set again
        expect(subscribeRange).toHaveBeenCalledTimes(1); // no new subscription
    });

    it('changed range set -> replacement required', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }]);
        calls[0].emit([{ id: 'doc1', data: { name: 'a' } }]);

        sub.setRegion([{ start: 'c', end: 'd' }]);
        expect(subscribeRange).toHaveBeenCalledTimes(2);
    });
});

describe('GeoRegionSubscription — transition semantics', () => {
    it('old dataset remains visible while new ranges initialize (two-range new set)', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }]);
        calls[0].emit([{ id: 'old1', data: { name: 'old' } }]); // old set active

        sub.setRegion([{ start: 'c', end: 'd' }, { start: 'e', end: 'f' }]); // new 2-range set
        // only one of the two new ranges has delivered so far — must not promote yet
        calls[1].emit([{ id: 'new1', data: { name: 'new' } }]);

        const last = onData.mock.calls.at(-1)![0];
        expect(last.has('old1')).toBe(true);
        expect(last.has('new1')).toBe(false);
    });

    it('new set does not promote until ALL initial range snapshots arrive; then promotes once and unsubscribes old', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }]);
        calls[0].emit([{ id: 'old1', data: { name: 'old' } }]);
        const oldCall = calls[0];

        sub.setRegion([{ start: 'c', end: 'd' }, { start: 'e', end: 'f' }]);
        calls[1].emit([{ id: 'new1', data: { name: 'new' } }]);
        expect(oldCall.unsubscribed).toBe(false); // not yet — second new range still pending

        calls[2].emit([{ id: 'new2', data: { name: 'new' } }]);
        // now both new ranges have delivered — promoted
        expect(oldCall.unsubscribed).toBe(true);
        const last = onData.mock.calls.at(-1)![0];
        expect(last.has('old1')).toBe(false);
        expect(last.has('new1')).toBe(true);
        expect(last.has('new2')).toBe(true);
    });

    it('superseded pending region cannot later become active', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }]);
        calls[0].emit([{ id: 'A', data: { name: 'A' } }]); // Region A active

        sub.setRegion([{ start: 'c', end: 'd' }]); // Region B pending
        const bCall = calls[1];

        sub.setRegion([{ start: 'e', end: 'f' }]); // user moves again before B ready -> Region C pending, B superseded
        expect(bCall.unsubscribed).toBe(true); // B's listener torn down

        // B fires its (late/superseded) snapshot anyway — must be ignored
        bCall.emit([{ id: 'B', data: { name: 'B' } }]);
        const afterLateB = onData.mock.calls.at(-1)![0];
        expect(afterLateB.has('B')).toBe(false);
        expect(afterLateB.has('A')).toBe(true); // still on old active A, C not ready yet

        calls[2].emit([{ id: 'C', data: { name: 'C' } }]); // C completes
        const final = onData.mock.calls.at(-1)![0];
        expect(final.has('C')).toBe(true);
        expect(final.has('A')).toBe(false);
        expect(final.has('B')).toBe(false);
    });

    it('pending listener failure leaves old region active', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const onPendingListenerError = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData, onPendingListenerError });

        sub.setRegion([{ start: 'a', end: 'b' }]);
        calls[0].emit([{ id: 'A', data: { name: 'A' } }]);

        sub.setRegion([{ start: 'c', end: 'd' }, { start: 'e', end: 'f' }]);
        calls[1].emit([{ id: 'new1', data: { name: 'new' } }]); // one of two ready
        calls[2].emitError(new Error('boom')); // the other errors before promotion

        expect(onPendingListenerError).toHaveBeenCalledTimes(1);
        const last = onData.mock.calls.at(-1)![0];
        expect(last.has('A')).toBe(true); // old data preserved
        expect(last.has('new1')).toBe(false); // partial pending data never promoted
    });

    it('active listener error preserves last-known data and reports via callback', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const onActiveListenerError = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData, onActiveListenerError });

        sub.setRegion([{ start: 'a', end: 'b' }]);
        calls[0].emit([{ id: 'A', data: { name: 'A' } }]);
        calls[0].emitError(new Error('transient'));

        expect(onActiveListenerError).toHaveBeenCalledTimes(1);
        // no additional onData call forced by the error — last data unchanged
        const last = onData.mock.calls.at(-1)![0];
        expect(last.has('A')).toBe(true);
    });

    it('identical range set: metadata updates immediately alongside the existing (unchanged) dataset', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }, { radius: number }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }], { radius: 1 });
        calls[0].emit([{ id: 'A', data: { name: 'A' } }]);
        expect(onData.mock.calls.at(-1)![1]).toEqual({ radius: 1 });

        sub.setRegion([{ start: 'a', end: 'b' }], { radius: 2 }); // same range set, new metadata
        expect(subscribeRange).toHaveBeenCalledTimes(1); // no new Firestore subscription
        const [merged, metadata] = onData.mock.calls.at(-1)!;
        expect(metadata).toEqual({ radius: 2 }); // metadata updates immediately
        expect(merged.has('A')).toBe(true); // same dataset republished, unchanged
    });

    it('changed range set: metadata stays pending (old metadata still paired with old data) until promotion, then both update atomically', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }, { radius: number }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }], { radius: 1 });
        calls[0].emit([{ id: 'A', data: { name: 'A' } }]); // Region A active with radius 1

        sub.setRegion([{ start: 'c', end: 'd' }], { radius: 2 }); // Region B pending with radius 2
        // No snapshot from B yet — nothing should have republished B's metadata.
        const beforePromotion = onData.mock.calls.at(-1)!;
        expect(beforePromotion[1]).toEqual({ radius: 1 }); // still old metadata, paired with old data
        expect(beforePromotion[0].has('A')).toBe(true);

        calls[1].emit([{ id: 'B', data: { name: 'B' } }]); // B's only range delivers -> promotes
        const afterPromotion = onData.mock.calls.at(-1)!;
        expect(afterPromotion[1]).toEqual({ radius: 2 }); // new metadata, atomic with new data
        expect(afterPromotion[0].has('B')).toBe(true);
        expect(afterPromotion[0].has('A')).toBe(false);
    });

    it('dispose() unsubscribes both active and pending listeners', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }]);
        calls[0].emit([{ id: 'A', data: { name: 'A' } }]);
        sub.setRegion([{ start: 'c', end: 'd' }]); // pending, not yet promoted

        sub.dispose();
        expect(calls[0].unsubscribed).toBe(true);
        expect(calls[1].unsubscribed).toBe(true);
    });

    it('dispose() is idempotent — calling it twice does not throw or double-unsubscribe', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }]);
        calls[0].emit([{ id: 'A', data: { name: 'A' } }]);

        expect(() => { sub.dispose(); sub.dispose(); }).not.toThrow();
        expect(calls[0].unsubscribed).toBe(true);
    });

    it('an empty (zero-document) initial snapshot still counts toward promotion — a genuinely empty range is not "not ready"', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }]);
        calls[0].emit([{ id: 'old1', data: { name: 'old' } }]);
        const oldCall = calls[0];

        sub.setRegion([{ start: 'c', end: 'd' }, { start: 'e', end: 'f' }]);
        calls[1].emit([]); // range 1 of 2: genuinely no documents in this cell
        expect(oldCall.unsubscribed).toBe(false); // still waiting on range 2

        calls[2].emit([{ id: 'new1', data: { name: 'new' } }]); // range 2 of 2 delivers
        expect(oldCall.unsubscribed).toBe(true); // promoted — the empty snapshot counted
        const last = onData.mock.calls.at(-1)![0];
        expect(last.has('new1')).toBe(true);
        expect(last.has('old1')).toBe(false);
    });

    it('an active-generation error on one range leaves other active ranges\' data intact', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const onActiveListenerError = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData, onActiveListenerError });

        sub.setRegion([{ start: 'a', end: 'b' }, { start: 'c', end: 'd' }]);
        calls[0].emit([{ id: 'docA', data: { name: 'A' } }]);
        calls[1].emit([{ id: 'docB', data: { name: 'B' } }]); // both ranges ready -> promoted

        calls[0].emitError(new Error('transient'));

        expect(onActiveListenerError).toHaveBeenCalledTimes(1);
        const last = onData.mock.calls.at(-1)![0];
        expect(last.has('docA')).toBe(true); // errored range's last-known data untouched
        expect(last.has('docB')).toBe(true); // sibling range's data untouched
    });

    it('the same range set supplied in a different array order is classified identically (no spurious replacement)', () => {
        const { subscribeRange, calls } = makeFakeSubscriber();
        const onData = vi.fn();
        const sub = new GeoRegionSubscription<{ name: string }>({ subscribeRange, onData });

        sub.setRegion([{ start: 'a', end: 'b' }, { start: 'c', end: 'd' }]);
        calls[0].emit([{ id: 'docA', data: { name: 'A' } }]);
        calls[1].emit([{ id: 'docB', data: { name: 'B' } }]); // both ready -> promoted to active
        expect(subscribeRange).toHaveBeenCalledTimes(2);

        sub.setRegion([{ start: 'c', end: 'd' }, { start: 'a', end: 'b' }]); // same set, reversed order
        expect(subscribeRange).toHaveBeenCalledTimes(2); // no new subscriptions
    });
});
