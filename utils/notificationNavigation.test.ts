import { describe, expect, it, vi } from 'vitest';
import {
  createNotificationIntentQueue,
  executeNotificationIntent,
} from './notificationNavigation';
import type { NotificationIntent } from './notificationIntent';

const intents: Record<string, NotificationIntent> = {
  ping: { version: 1, type: 'ping', spotId: 'spot_42' },
  my_car: { version: 1, type: 'my_car' },
  notifications: { version: 1, type: 'notifications' },
};

describe('notification intent destination mapping', () => {
  it('maps only the three launch destinations to existing App navigation actions', () => {
    const actions = { openPing: vi.fn(), openMyCar: vi.fn(), openNotifications: vi.fn() };
    executeNotificationIntent(intents.ping, actions);
    executeNotificationIntent(intents.my_car, actions);
    executeNotificationIntent(intents.notifications, actions);
    expect(actions.openPing).toHaveBeenCalledWith('spot_42');
    expect(actions.openMyCar).toHaveBeenCalledTimes(1);
    expect(actions.openNotifications).toHaveBeenCalledTimes(1);
  });
});

describe('auth-gated notification intent queue', () => {
  it('waits for authentication readiness and consumes the pending intent once', () => {
    const execute = vi.fn();
    const queue = createNotificationIntentQueue(execute);
    queue.accept(intents.ping);
    expect(execute).not.toHaveBeenCalled();

    queue.setReady(true);
    expect(execute).toHaveBeenCalledWith(intents.ping);
    expect(execute).toHaveBeenCalledTimes(1);

    queue.setReady(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('executes a worker-delivered intent immediately once ready', () => {
    const execute = vi.fn();
    const queue = createNotificationIntentQueue(execute);
    queue.setReady(true);
    queue.accept(intents.my_car);
    expect(execute).toHaveBeenCalledWith(intents.my_car);
  });

  it('does not execute after disposal', () => {
    const execute = vi.fn();
    const queue = createNotificationIntentQueue(execute);
    queue.setReady(true);
    queue.dispose();
    queue.accept(intents.notifications);
    expect(execute).not.toHaveBeenCalled();
  });
});
