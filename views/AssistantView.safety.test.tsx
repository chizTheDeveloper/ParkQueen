import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const analyzeParkingSign = vi.fn();

vi.hoisted(() => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  };
  (globalThis as any).window = { addEventListener: () => {}, removeEventListener: () => {} };
});

vi.mock('../services/geminiService', () => ({
  analyzeParkingSign: (...args: any[]) => analyzeParkingSign(...args),
}));
vi.mock('../hooks/useFocusOnMount', () => ({ useFocusOnMount: () => {} }));
vi.mock('./street-parking/useParkingTimer', () => ({
  useParkingTimer: () => ({ startTimer: vi.fn(), timer: null }),
}));

import { AssistantView } from './AssistantView';

class FakeFileReader {
  result = 'data:image/png;base64,aW1hZ2U=';
  onloadend: null | (() => void) = null;
  readAsDataURL() { this.onloadend?.(); }
}

function textOf(renderer: TestRenderer.ReactTestRenderer): string {
  return renderer.root.findAll(node => typeof node.children?.[0] === 'string')
    .flatMap(node => node.children.filter((child): child is string => typeof child === 'string'))
    .join(' ');
}

describe('AssistantView sign-result safety copy', () => {
  beforeEach(() => {
    analyzeParkingSign.mockReset();
    analyzeParkingSign.mockResolvedValue({ status: 'YES', explanation: 'The interpreted schedule allows parking.' });
    (globalThis as any).FileReader = FakeFileReader;
  });

  it('places an explicit AI limitation beside a successful sign interpretation', async () => {
    let renderer: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<AssistantView />);
    });

    await act(async () => {
      renderer!.root.findAllByType('button')[0].props.onClick();
    });
    const input = renderer!.root.findAllByType('input')[0];
    await act(async () => {
      input.props.onChange({ target: { files: [{}] } });
      await Promise.resolve();
      await Promise.resolve();
    });

    const text = textOf(renderer!);
    expect(text).toContain('AI interpretation may be incomplete or incorrect. Verify posted signs.');
    expect(text.indexOf('The interpreted schedule allows parking.'))
      .toBeLessThan(text.indexOf('AI interpretation may be incomplete or incorrect. Verify posted signs.'));
  });
});
