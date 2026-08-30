import { describe, expect, it, vi } from 'vitest';
import {
  consumeNotificationIntentFragment,
  encodeNotificationIntentFragment,
  normalizeNotificationIntent,
  readNotificationIntentFromPayload,
} from './notificationIntent';

describe('notification intent validation', () => {
  it('accepts only the three versioned launch destinations', () => {
    expect(normalizeNotificationIntent({ version: 1, type: 'ping', spotId: 'abc_123-Z' }))
      .toEqual({ version: 1, type: 'ping', spotId: 'abc_123-Z' });
    expect(normalizeNotificationIntent({ version: 1, type: 'my_car' }))
      .toEqual({ version: 1, type: 'my_car' });
    expect(normalizeNotificationIntent({ version: 1, type: 'notifications' }))
      .toEqual({ version: 1, type: 'notifications' });
  });

  it.each([
    { version: 1, type: 'chat', chatId: 'alice_bob' },
    { version: 1, type: 'messages' },
    { version: 1, type: 'arrival' },
    { version: 2, type: 'notifications' },
    { version: 1, type: 'ping' },
    { version: 1, type: 'ping', spotId: '' },
    { version: 1, type: 'ping', spotId: '../admin' },
    { version: 1, type: 'ping', spotId: '//evil.example' },
    { version: 1, type: 'ping', spotId: 'spot?next=https://evil.example' },
    { version: 1, type: 'ping', spotId: 'mycar_userUid_sessionId' },
    { version: 1, type: 'ping', spotId: 'a'.repeat(129) },
    { version: 1, type: 'notifications', url: 'https://evil.example' },
  ])('rejects unsafe or unsupported intent %#', (value) => {
    expect(normalizeNotificationIntent(value)).toBeNull();
  });

  it('normalizes the current legacy nearby payload without accepting producer URLs', () => {
    expect(readNotificationIntentFromPayload({ data: { spotId: 'legacySpot42' } }))
      .toEqual({ version: 1, type: 'ping', spotId: 'legacySpot42' });
    expect(readNotificationIntentFromPayload({
      data: { spotId: 'legacySpot42', url: 'https://evil.example' },
    })).toEqual({ version: 1, type: 'ping', spotId: 'legacySpot42' });
  });

  it('normalizes future data-only navigation metadata and otherwise fails closed', () => {
    expect(readNotificationIntentFromPayload({
      data: { navigationVersion: '1', navigationType: 'my_car' },
    })).toEqual({ version: 1, type: 'my_car' });
    expect(readNotificationIntentFromPayload({
      data: { navigationVersion: '1', navigationType: 'ping', spotId: 'futureSpot1' },
    })).toEqual({ version: 1, type: 'ping', spotId: 'futureSpot1' });
    expect(readNotificationIntentFromPayload({
      data: { navigationVersion: '1', navigationType: 'chat', chatId: 'alice_bob' },
    })).toEqual({ version: 1, type: 'notifications' });
    expect(readNotificationIntentFromPayload({ data: { url: 'https://evil.example' } }))
      .toEqual({ version: 1, type: 'notifications' });
  });
});

describe('notification intent fragment lifecycle', () => {
  it('round-trips a validated Ping through a same-origin fragment and consumes it once', () => {
    const fragment = encodeNotificationIntentFragment({ version: 1, type: 'ping', spotId: 'spot_42' });
    expect(fragment).toBe('#pq-notification=v1%3Aping%3Aspot_42');

    const replaceState = vi.fn();
    const intent = consumeNotificationIntentFragment(
      { hash: fragment, pathname: '/map', search: '?debugStreet=1' },
      { replaceState },
    );

    expect(intent).toEqual({ version: 1, type: 'ping', spotId: 'spot_42' });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/map?debugStreet=1');
  });

  it('clears malformed notification routing state and never interprets an external URL', () => {
    const replaceState = vi.fn();
    expect(consumeNotificationIntentFragment(
      { hash: '#pq-notification=https%3A%2F%2Fevil.example', pathname: '/', search: '' },
      { replaceState },
    )).toEqual({ version: 1, type: 'notifications' });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('leaves unrelated fragments untouched', () => {
    const replaceState = vi.fn();
    expect(consumeNotificationIntentFragment(
      { hash: '#section-about', pathname: '/', search: '' },
      { replaceState },
    )).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
