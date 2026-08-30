import fs from 'node:fs';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface WorkerHarness {
  order: string[];
  showNotification: ReturnType<typeof vi.fn>;
  openWindow: ReturnType<typeof vi.fn>;
  background: (payload: unknown) => unknown;
  click: (event: any) => unknown;
  setClients: (clients: any[]) => void;
}

function loadWorker(): WorkerHarness {
  const source = fs.readFileSync(new URL('../public/firebase-messaging-sw.js', import.meta.url), 'utf8');
  const order: string[] = [];
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const listeners = new Map<string, (event: any) => unknown>();
  let background: ((payload: unknown) => unknown) | null = null;
  let clients: any[] = [];
  const self = {
    location: { origin: 'https://parqueen.app' },
    addEventListener: (type: string, listener: (event: any) => unknown) => {
      order.push(`listener:${type}`);
      listeners.set(type, listener);
    },
    registration: { showNotification },
    clients: {
      matchAll: vi.fn(async () => clients),
      openWindow,
    },
  };
  const messaging = {
    onBackgroundMessage: (handler: (payload: unknown) => unknown) => { background = handler; },
  };
  const context = vm.createContext({
    self,
    URL,
    console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    importScripts: (...urls: string[]) => order.push(...urls.map(url => `import:${url}`)),
    firebase: { initializeApp: vi.fn(), messaging: () => messaging },
  });
  new vm.Script(source, { filename: 'firebase-messaging-sw.js' }).runInContext(context);
  return {
    order,
    showNotification,
    openWindow,
    background: payload => background!(payload),
    click: event => listeners.get('notificationclick')!(event),
    setClients: next => { clients = next; },
  };
}

function clickEvent(data: unknown) {
  let completion: Promise<unknown> | null = null;
  return {
    notification: { data, close: vi.fn() },
    waitUntil: (promise: Promise<unknown>) => { completion = promise; },
    completion: () => completion!,
  };
}

describe('firebase messaging compatibility worker', () => {
  let worker: WorkerHarness;
  beforeEach(() => { worker = loadWorker(); });

  it('registers notificationclick before importing Firebase Messaging', () => {
    const clickIndex = worker.order.indexOf('listener:notificationclick');
    const firebaseImportIndex = worker.order.findIndex(value => value.includes('firebase-app-compat'));
    expect(clickIndex).toBeGreaterThanOrEqual(0);
    expect(clickIndex).toBeLessThan(firebaseImportIndex);
  });

  it('does not manually redisplay a legacy notification-bearing payload', async () => {
    await worker.background({
      notification: { title: 'New Spot Near You!', body: 'Someone left a spot.' },
      data: { spotId: 'spot_1' },
    });
    expect(worker.showNotification).not.toHaveBeenCalled();
  });

  it('manually displays exactly one validated future data-only payload', async () => {
    await worker.background({
      data: {
        title: 'New Spot Near You!',
        body: 'Someone left a spot.',
        navigationVersion: '1',
        navigationType: 'ping',
        spotId: 'spot_1',
        deliveryId: 'nearby_spot_1_user',
      },
    });
    expect(worker.showNotification).toHaveBeenCalledTimes(1);
    expect(worker.showNotification).toHaveBeenCalledWith('New Spot Near You!', {
      body: 'Someone left a spot.',
      icon: '/icons/parqueen-192.png',
      badge: '/icons/parqueen-192.png',
      tag: 'nearby_spot_1_user',
      data: { version: 1, type: 'ping', spotId: 'spot_1' },
    });
  });

  it('fails malformed future routing closed to Notifications and ignores data without display copy', async () => {
    await worker.background({
      data: {
        title: 'Update', body: 'Open ParQueen.', navigationVersion: '1',
        navigationType: 'chat', url: 'https://evil.example',
      },
    });
    expect(worker.showNotification).toHaveBeenCalledWith('Update', expect.objectContaining({
      data: { version: 1, type: 'notifications' },
    }));
    worker.showNotification.mockClear();
    await worker.background({ data: { navigationVersion: '1', navigationType: 'notifications' } });
    expect(worker.showNotification).not.toHaveBeenCalled();
  });

  it('focuses and posts a normalized intent only to a same-origin existing client', async () => {
    const evil = { url: 'https://evil.example/', focus: vi.fn(), postMessage: vi.fn() };
    const parqueen = { url: 'https://parqueen.app/map', focus: vi.fn(), postMessage: vi.fn() };
    worker.setClients([evil, parqueen]);
    const event = clickEvent({ version: 1, type: 'ping', spotId: 'spot_1' });

    worker.click(event);
    await event.completion();

    expect(event.notification.close).toHaveBeenCalledTimes(1);
    expect(evil.focus).not.toHaveBeenCalled();
    expect(evil.postMessage).not.toHaveBeenCalled();
    expect(parqueen.postMessage).toHaveBeenCalledWith({
      kind: 'PARQUEEN_NOTIFICATION_OPEN',
      version: 1,
      intent: { version: 1, type: 'ping', spotId: 'spot_1' },
    });
    expect(parqueen.focus).toHaveBeenCalledTimes(1);
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it('opens only an internally built same-origin fragment when the app is closed', async () => {
    worker.setClients([]);
    const event = clickEvent({ version: 1, type: 'my_car' });
    worker.click(event);
    await event.completion();
    expect(worker.openWindow).toHaveBeenCalledWith(
      'https://parqueen.app/#pq-notification=v1%3Amy_car',
    );
  });

  it.each([
    { version: 1, type: 'chat', chatId: 'alice_bob' },
    { version: 1, type: 'ping', spotId: '//evil.example' },
    { version: 1, type: 'ping', spotId: 'a'.repeat(129) },
    { url: 'https://evil.example' },
  ])('rejects unsafe click data %# and falls back internally', async (data) => {
    worker.setClients([]);
    const event = clickEvent(data);
    worker.click(event);
    await event.completion();
    expect(worker.openWindow).toHaveBeenCalledWith(
      'https://parqueen.app/#pq-notification=v1%3Anotifications',
    );
  });
});
