import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { ForegroundNotificationToast } from './ForegroundNotificationToast';

describe('ForegroundNotificationToast', () => {
  it('provides one explicit Open action and a separate dismiss action', () => {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    const renderer = TestRenderer.create(
      <ForegroundNotificationToast
        title="Spot opening soon"
        body="Time to head over"
        openLabel="Open"
        dismissLabel="Dismiss"
        onOpen={onOpen}
        onDismiss={onDismiss}
      />,
    );
    expect(JSON.stringify(renderer.toJSON())).toContain('Spot opening soon');
    act(() => renderer.root.findByProps({ 'data-foreground-notification-action': 'open' }).props.onClick());
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => renderer.root.findByProps({ 'data-foreground-notification-action': 'dismiss' }).props.onClick());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
