import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function pngDimensions(relativePath: string) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

describe('PWA install boundary', () => {
  it('publishes a scoped standalone manifest with real install icons', () => {
    const manifest = readJson('public/manifest.webmanifest');
    expect(manifest).toMatchObject({
      name: 'ParQueen - NYC Parking',
      short_name: 'ParQueen',
      id: '/',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#071426',
      background_color: '#071426',
    });
    expect(manifest.icons).toEqual(expect.arrayContaining([
      { src: '/icons/parqueen-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/parqueen-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/parqueen-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]));

    expect(pngDimensions('public/icons/parqueen-192.png')).toEqual({ width: 192, height: 192 });
    expect(pngDimensions('public/icons/parqueen-512.png')).toEqual({ width: 512, height: 512 });
    expect(pngDimensions('public/icons/parqueen-maskable-512.png')).toEqual({ width: 512, height: 512 });
    expect(pngDimensions('public/icons/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
  });

  it('links the manifest, theme, and Apple touch icon from the document head', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('<meta name="theme-color" content="#071426"');
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"');
  });

  it('serves the worker and manifest with update-safe cache policies', () => {
    const firebase = readJson('firebase.json');
    const headers = firebase.hosting.headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    const cacheControl = (source: string) => headers
      .find(entry => entry.source === source)?.headers
      .find(header => header.key === 'Cache-Control')?.value;

    expect(cacheControl('/firebase-messaging-sw.js')).toBe('no-cache');
    expect(cacheControl('/manifest.webmanifest')).toBe('no-cache');

    const globalCsp = headers.find(entry => entry.source === '**')?.headers
      .find(header => header.key === 'Content-Security-Policy-Report-Only')?.value;
    expect(globalCsp).toContain("worker-src 'self' blob:");
  });

  it('aligns the worker Firebase compat SDK with the installed page SDK', () => {
    const pageVersion = readJson('package-lock.json').packages['node_modules/firebase'].version;
    const worker = fs.readFileSync(path.join(root, 'public/firebase-messaging-sw.js'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    expect(worker).toContain(`/firebasejs/${pageVersion}/firebase-app-compat.js`);
    expect(worker).toContain(`/firebasejs/${pageVersion}/firebase-messaging-compat.js`);
    expect(html).toContain(`https://esm.sh/firebase@${pageVersion}/messaging`);
    expect(html).not.toContain('https://esm.sh/firebase@10.8.0/');
  });
});
