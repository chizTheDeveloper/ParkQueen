import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { readNotificationIntentFromPayload } from './notificationIntent';

type Payload = {
  notification?: { title: string; body: string };
  data?: Record<string, string>;
};

function loadBackgroundHandler(workerPath: URL) {
  const source = fs.readFileSync(workerPath, 'utf8');
  const showNotification = vi.fn().mockResolvedValue(undefined);
  let background: ((payload: Payload) => unknown) | null = null;
  const self = {
    location: { origin: 'https://parqueen.app' },
    addEventListener: vi.fn(),
    registration: { showNotification },
    clients: { matchAll: vi.fn(), openWindow: vi.fn() },
  };
  const messaging = {
    onBackgroundMessage: (handler: (payload: Payload) => unknown) => { background = handler; },
  };
  const context = vm.createContext({
    self,
    URL,
    console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    importScripts: vi.fn(),
    firebase: { initializeApp: vi.fn(), messaging: () => messaging },
  });
  new vm.Script(source, { filename: workerPath.pathname }).runInContext(context);

  return {
    async deliver(payload: Payload) {
      const automaticDisplays = payload.notification ? 1 : 0;
      let error: unknown = null;
      try {
        await background!(payload);
      } catch (caught) {
        error = caught;
      }
      return {
        automaticDisplays,
        manualDisplays: showNotification.mock.calls.length,
        totalDisplays: automaticDisplays + showNotification.mock.calls.length,
        error,
      };
    },
    showNotification,
  };
}

const oldWorker = new URL('./fixtures/firebase-messaging-sw.pre93-08f7d61.js', import.meta.url);
const currentWorker = new URL('../public/firebase-messaging-sw.js', import.meta.url);

const currentPayloads: Payload[] = [
  {
    notification: { title: 'New Spot Near You!', body: 'Someone just left a spot nearby.' },
    data: { spotId: 'spot_1' },
  },
  { notification: { title: 'Spot opening soon', body: 'Your claimed spot opens soon.' } },
  { notification: { title: 'Street cleaning soon', body: 'Move your car before cleaning.' } },
];

const transitionalPayloads: Payload[] = [
  {
    notification: { title: 'New Spot Near You!', body: 'Someone just left a spot nearby.' },
    data: {
      navigationVersion: '1', navigationType: 'ping', spotId: 'spot_1',
      deliveryId: 'nearby_abc123',
    },
  },
  {
    notification: { title: 'Spot opening soon', body: 'Your claimed spot opens soon.' },
    data: {
      navigationVersion: '1', navigationType: 'ping', spotId: 'spot_1',
      deliveryId: 'reminder_abc123',
    },
  },
  {
    notification: { title: 'Street cleaning soon', body: 'Move your car before cleaning.' },
    data: {
      navigationVersion: '1', navigationType: 'my_car', deliveryId: 'cleaning_abc123',
    },
  },
];

describe('notification producer compatibility matrix', () => {
  it.each(currentPayloads)('pre-#93 worker preserves the existing double-display behavior for current payload %#', async payload => {
    const worker = loadBackgroundHandler(oldWorker);
    const result = await worker.deliver(payload);
    expect(result).toMatchObject({ automaticDisplays: 1, manualDisplays: 1, totalDisplays: 2, error: null });
  });

  it.each(transitionalPayloads)('pre-#93 worker accepts transitional combined payload %# without a new regression', async payload => {
    const worker = loadBackgroundHandler(oldWorker);
    const result = await worker.deliver(payload);
    expect(result).toMatchObject({ automaticDisplays: 1, manualDisplays: 1, totalDisplays: 2, error: null });
    expect(worker.showNotification).toHaveBeenCalledWith(
      payload.notification!.title,
      expect.objectContaining({ data: payload.data }),
    );
  });

  it.each([...currentPayloads, ...transitionalPayloads])('#93 worker displays notification-bearing payload %# exactly once', async payload => {
    const worker = loadBackgroundHandler(currentWorker);
    const result = await worker.deliver(payload);
    expect(result).toMatchObject({ automaticDisplays: 1, manualDisplays: 0, totalDisplays: 1, error: null });
  });

  it.each([
    [transitionalPayloads[0], { version: 1, type: 'ping', spotId: 'spot_1' }],
    [transitionalPayloads[1], { version: 1, type: 'ping', spotId: 'spot_1' }],
    [transitionalPayloads[2], { version: 1, type: 'my_car' }],
  ] as const)('the #93 foreground path can route transitional payload %#', (payload, intent) => {
    expect(readNotificationIntentFromPayload(payload)).toEqual(intent);
  });

  it('documents why pure data-only is unsafe for the pre-#93 worker', async () => {
    const worker = loadBackgroundHandler(oldWorker);
    const result = await worker.deliver({
      data: {
        title: 'New Spot Near You!', body: 'Someone just left a spot nearby.',
        navigationVersion: '1', navigationType: 'ping', spotId: 'spot_1',
        deliveryId: 'nearby_abc123',
      },
    });
    expect(result).toMatchObject({ automaticDisplays: 0, manualDisplays: 0, totalDisplays: 0 });
    expect(result.error).toMatchObject({ name: 'TypeError' });
  });
});
