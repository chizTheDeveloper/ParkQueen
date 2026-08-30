import type { NotificationIntent } from './notificationIntent';

interface NotificationNavigationActions {
  openPing: (spotId: string) => void;
  openMyCar: () => void;
  openNotifications: () => void;
}

export function executeNotificationIntent(
  intent: NotificationIntent,
  actions: NotificationNavigationActions,
) {
  switch (intent.type) {
    case 'ping':
      actions.openPing(intent.spotId);
      return;
    case 'my_car':
      actions.openMyCar();
      return;
    case 'notifications':
      actions.openNotifications();
  }
}

export function createNotificationIntentQueue(
  execute: (intent: NotificationIntent) => void,
) {
  let ready = false;
  let disposed = false;
  let pending: NotificationIntent | null = null;

  const flush = () => {
    if (!ready || disposed || !pending) return;
    const intent = pending;
    pending = null;
    execute(intent);
  };

  return {
    accept: (intent: NotificationIntent) => {
      if (disposed) return;
      pending = intent;
      flush();
    },
    setReady: (nextReady: boolean) => {
      ready = nextReady;
      flush();
    },
    dispose: () => {
      disposed = true;
      pending = null;
    },
  };
}
