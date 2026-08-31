import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('mobile viewport accessibility', () => {
  it('allows browser pinch zoom without changing the established viewport layout', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const viewport = html.match(/<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']/i)?.[1];

    expect(viewport).toBeDefined();
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('initial-scale=1.0');
    expect(viewport).toContain('viewport-fit=cover');
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(viewport).not.toMatch(/maximum-scale\s*=\s*1(?:\.0)?(?:\s*,|\s*$)/i);
  });
});
