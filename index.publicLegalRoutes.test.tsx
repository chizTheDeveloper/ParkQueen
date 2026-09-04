import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { renderRoot, replaceState } = vi.hoisted(() => ({
  renderRoot: vi.fn(),
  replaceState: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  default: { createRoot: () => ({ render: renderRoot }) },
}));
vi.mock('./App', () => ({ default: () => <div>Authenticated application</div> }));
vi.mock('./utils/sentryInit', () => ({ initSentry: vi.fn() }));

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  },
});

const loadAt = async (pathname: string) => {
  vi.resetModules();
  renderRoot.mockClear();
  replaceState.mockClear();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: { pathname, search: '', hash: '', assign: vi.fn() },
      history: { replaceState },
      addEventListener: vi.fn(),
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { getElementById: () => ({}) },
  });

  await import('./index');
  const element = renderRoot.mock.calls[0]?.[0];
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(element);
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return renderer!;
};

describe('public legal route bootstrap', () => {
  beforeEach(() => values.clear());

  it('renders Privacy Policy directly at /privacy without entering the authenticated app', async () => {
    const renderer = await loadAt('/privacy');
    await vi.waitFor(() => expect(JSON.stringify(renderer.toJSON())).toContain('Privacy Policy'));
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Authenticated application');
  });

  it('renders Terms of Use directly at /terms without entering the authenticated app', async () => {
    const renderer = await loadAt('/terms');
    await vi.waitFor(() => expect(JSON.stringify(renderer.toJSON())).toContain('Terms of Use'));
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Authenticated application');
  });

  it.each([
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Use'],
  ])('owns vertical scrolling for the legal document at %s', async (pathname, heading) => {
    const renderer = await loadAt(pathname);
    await vi.waitFor(() => expect(JSON.stringify(renderer.toJSON())).toContain(heading));

    // The global body overflow-hidden leaves no viewport scroll owner, so the
    // shared legal route must establish its own scroll container.
    const tree = renderer.toJSON() as TestRenderer.ReactTestRendererJSON;
    expect(tree.props.className).toContain('public-legal-scroll');
    // The container is the only scroller once the viewport stops scrolling,
    // so it must stay keyboard-focusable.
    expect(tree.props.tabIndex).toBe(0);
  });

  it.each([
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Use'],
  ])('returns to the marketing site when Back is pressed at %s', async (pathname, heading) => {
    const renderer = await loadAt(pathname);
    await vi.waitFor(() => expect(JSON.stringify(renderer.toJSON())).toContain(heading));

    // Publicly opened legal pages have no app to go back to, so Back must
    // leave for the marketing site rather than the app host root.
    const back = renderer.root.findAllByType('button')[0];
    await act(async () => back.props.onClick());

    expect(window.location.assign).toHaveBeenCalledWith('https://parqueen.app');
    expect(window.location.assign).not.toHaveBeenCalledWith('/');
  });

  it.each([
    ['/privacy-policy', '/privacy', 'Privacy Policy'],
    ['/terms-conditions', '/terms', 'Terms of Use'],
  ])('canonicalizes legacy path %s to %s and renders its document', async (legacyPath, canonicalPath, heading) => {
    const renderer = await loadAt(legacyPath);
    await vi.waitFor(() => expect(JSON.stringify(renderer.toJSON())).toContain(heading));
    expect(replaceState).toHaveBeenCalledWith(null, '', canonicalPath);
  });
});
