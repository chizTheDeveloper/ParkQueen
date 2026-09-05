import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const root = resolve(__dirname, '..');
const indexCss = readFileSync(resolve(root, 'index.css'), 'utf-8');
const indexHtml = readFileSync(resolve(root, 'index.html'), 'utf-8');
const indexTsx = readFileSync(resolve(root, 'index.tsx'), 'utf-8');
const tailwindConfig = readFileSync(resolve(root, 'tailwind.config.js'), 'utf-8');

describe('Tailwind cascade position', () => {
  // The Play CDN appended its compiled <style> to document.head at runtime,
  // landing AFTER the bundled stylesheet. Utilities therefore beat the semantic
  // classes on equal specificity. Hoisting @tailwind to the top of index.css
  // would flip those conflicts (.sp-overlay vs p-0/md:p-3, .map-status-row vs
  // md:w-full, ...) and break layout with a green test suite. Pin the order.
  it('emits @tailwind after every semantic rule in index.css', () => {
    // Comments discuss the directives by name, so compare on stripped source.
    const stripped = indexCss.replace(/\/\*[\s\S]*?\*\//g, '');

    expect(stripped).toContain('@tailwind base;');
    expect(stripped).toContain('@tailwind components;');
    expect(stripped).toContain('@tailwind utilities;');

    const firstDirective = stripped.indexOf('@tailwind');
    // Every semantic rule sits above the directives...
    expect(stripped.lastIndexOf('.public-legal-scroll')).toBeLessThan(firstDirective);
    expect(stripped.lastIndexOf('.sp-overlay')).toBeLessThan(firstDirective);
    expect(stripped.lastIndexOf('.map-status-row')).toBeLessThan(firstDirective);
    // ...and nothing but the three directives follows them.
    const trailing = stripped
      .slice(firstDirective)
      .replace(/@tailwind\s+(base|components|utilities);/g, '')
      .trim();
    expect(trailing).toBe('');
  });

  it('keeps index.css as the last build-time stylesheet in the document', () => {
    // Vite appends the link for this import at the end of <head>, so the CSS
    // that carries the utilities stays last. index.html must not add a
    // stylesheet after it, and no other module may import global CSS eagerly.
    expect(indexTsx).toContain("import './index.css'");
    const htmlSheets = [...indexHtml.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)];
    expect(htmlSheets).toHaveLength(1); // FontAwesome only
    expect(htmlSheets[0][0]).toContain('font-awesome');
  });
});

describe('Tailwind config parity with the removed CDN runtime config', () => {
  it('no longer loads or configures the Play CDN', () => {
    expect(indexHtml).not.toContain('cdn.tailwindcss.com');
    expect(indexHtml).not.toContain('tailwind.config');
  });

  it('preserves darkMode: class and the ParQueen palettes', () => {
    const config = require(resolve(root, 'tailwind.config.js'));
    expect(config.darkMode).toBe('class');
    expect(config.theme.extend.colors.queen[500]).toBe('#3b82f6');
    expect(config.theme.extend.colors.queen[900]).toBe('#1e3a8a');
    expect(config.theme.extend.colors.dark[900]).toBe('#071426');
    expect(config.theme.extend.colors.dark[800]).toBe('#091d36');
    expect(config.theme.extend.colors.dark[700]).toBe('#0f294d');
  });

  it('scans every directory that authors class names', () => {
    // The CDN JIT-compiled against the live DOM; static extraction only sees
    // what these globs cover. Missing one silently drops utilities in prod.
    for (const dir of ['components', 'views', 'utils']) {
      expect(tailwindConfig).toContain(dir);
    }
    expect(tailwindConfig).toContain('./index.html');
  });
});
