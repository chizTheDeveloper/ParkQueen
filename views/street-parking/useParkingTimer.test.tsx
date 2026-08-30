import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useParkingTimer } from './useParkingTimer';

const values = new Map<string, string>();

function Harness({ expose }: { expose: (value: ReturnType<typeof useParkingTimer>) => void }) {
  expose(useParkingTimer());
  return null;
}

describe('useParkingTimer notification ownership', () => {
  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
  });

  it('starts the existing page timer without requesting browser permission', () => {
    const requestPermission = vi.fn();
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: Object.assign(vi.fn(), { permission: 'default', requestPermission }),
    });
    let timer!: ReturnType<typeof useParkingTimer>;
    const renderer = TestRenderer.create(<Harness expose={value => { timer = value; }} />);

    act(() => timer.startTimer(15, 'Broadway'));

    expect(requestPermission).not.toHaveBeenCalled();
    expect(values.get('pq_parking_timer')).toContain('Broadway');
    act(() => renderer.unmount());
  });
});
