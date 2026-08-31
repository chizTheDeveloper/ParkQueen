import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { TimePicker } from './TimePicker';

vi.hoisted(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  };
});

describe('TimePicker accessibility semantics', () => {
  it('names every numeric input and adjustment control', () => {
    const renderer = TestRenderer.create(
      <TimePicker initialTime={new Date('2026-08-31T09:05:00')} onTimeChange={vi.fn()} />,
    );

    expect(renderer.root.findByProps({ 'aria-label': 'Hour' }).type).toBe('input');
    expect(renderer.root.findByProps({ 'aria-label': 'Minute' }).type).toBe('input');
    for (const label of ['Increase hour', 'Decrease hour', 'Increase minute', 'Decrease minute']) {
      const control = renderer.root.findByProps({ 'aria-label': label });
      expect(control.type).toBe('button');
      expect(control.props.type).toBe('button');
    }

    act(() => renderer.unmount());
  });

  it('exposes AM/PM as one named pressed-state choice without changing time logic', () => {
    const onTimeChange = vi.fn();
    const renderer = TestRenderer.create(
      <TimePicker initialTime={new Date('2026-08-31T09:05:00')} onTimeChange={onTimeChange} />,
    );

    expect(renderer.root.findByProps({ role: 'group', 'aria-label': 'AM or PM' })).toBeDefined();
    const am = renderer.root.findByProps({ 'aria-label': 'AM' });
    const pm = renderer.root.findByProps({ 'aria-label': 'PM' });
    expect(am.props['aria-pressed']).toBe(true);
    expect(pm.props['aria-pressed']).toBe(false);

    act(() => pm.props.onClick());
    expect(renderer.root.findByProps({ 'aria-label': 'AM' }).props['aria-pressed']).toBe(false);
    expect(renderer.root.findByProps({ 'aria-label': 'PM' }).props['aria-pressed']).toBe(true);
    expect(onTimeChange).toHaveBeenLastCalledWith(expect.objectContaining({}));

    act(() => renderer.unmount());
  });

  it('announces the selected time politely in text', () => {
    const renderer = TestRenderer.create(
      <TimePicker initialTime={new Date('2026-08-31T09:05:00')} onTimeChange={vi.fn()} />,
    );

    const announcement = renderer.root.findByProps({ 'aria-live': 'polite' });
    expect(announcement.props.children).toBe('Selected time 09:05 AM');

    act(() => renderer.unmount());
  });
});
