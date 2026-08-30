import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'user-a' } as { uid: string } | null },
  doc: vi.fn(() => ({ path: 'users/user-a/private/preferences' })),
  updateDoc: vi.fn(),
  deleteField: vi.fn(() => ({ delete: true })),
  signOut: vi.fn(),
}));

vi.mock('../firebaseConfig', () => ({ auth: mocks.auth, db: {} }));
vi.mock('firebase/auth', () => ({
  signOut: mocks.signOut,
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: mocks.doc,
  updateDoc: mocks.updateDoc,
  deleteField: mocks.deleteField,
}));
vi.mock('firebase/functions', () => ({ getFunctions: vi.fn(), httpsCallable: vi.fn() }));

import { logoutUser, unlinkFcmTokenBeforeDeletion } from '../database';

const values = new Map<string, string>();

describe('FCM token logout and deletion cleanup', () => {
  beforeEach(() => {
    values.clear();
    values.set('theme', 'dark');
    values.set('parqueen_fcm_owner_uid', 'user-a');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear(),
      },
    });
    mocks.auth.currentUser = { uid: 'user-a' };
    mocks.doc.mockClear();
    mocks.updateDoc.mockReset().mockResolvedValue(undefined);
    mocks.deleteField.mockClear();
    mocks.signOut.mockReset().mockResolvedValue(undefined);
  });

  it('removes the scalar token from private preferences before sign-out', async () => {
    const order: string[] = [];
    mocks.updateDoc.mockImplementation(async () => { order.push('unlink'); });
    mocks.signOut.mockImplementation(async () => { order.push('signOut'); });

    await logoutUser();

    expect(mocks.doc).toHaveBeenCalledWith({}, 'users', 'user-a', 'private', 'preferences');
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      { path: 'users/user-a/private/preferences' },
      { fcmToken: { delete: true } },
    );
    expect(order).toEqual(['unlink', 'signOut']);
    expect(values.get('theme')).toBe('dark');
    expect(values.has('parqueen_fcm_owner_uid')).toBe(false);
  });

  it('restores the owner marker after offline cleanup failure and still signs out', async () => {
    mocks.updateDoc.mockRejectedValue(new Error('offline'));

    await expect(logoutUser()).resolves.toBeUndefined();

    expect(values.get('parqueen_fcm_owner_uid')).toBe('user-a');
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('does not attempt a token write when already signed out', async () => {
    mocks.auth.currentUser = null;

    await logoutUser();

    expect(mocks.updateDoc).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('account deletion unlinks the same private scalar token without blocking on failure', async () => {
    mocks.updateDoc.mockRejectedValue(new Error('offline'));

    await expect(unlinkFcmTokenBeforeDeletion()).resolves.toBeUndefined();

    expect(mocks.updateDoc).toHaveBeenCalledWith(
      { path: 'users/user-a/private/preferences' },
      { fcmToken: { delete: true } },
    );
  });
});
