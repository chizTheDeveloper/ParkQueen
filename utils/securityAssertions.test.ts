import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const indexHtml = readFileSync(resolve(__dirname, '../index.html'), 'utf-8');

describe('index.html security assertions', () => {
  it('does not load voiceagent.ai', () => {
    expect(indexHtml).not.toContain('voiceagent.ai');
  });

  it('does not reference acme-corp placeholder ID', () => {
    expect(indexHtml).not.toContain('acme-corp');
  });

  it('does not include @google/genai in the importmap', () => {
    expect(indexHtml).not.toContain('@google/genai');
  });

  it('does not load any unapproved external scripts', () => {
    const externalScripts = [...indexHtml.matchAll(/<script[^>]+src="(https?:\/\/[^"]+)"/g)]
      .map(m => m[1]);
    const allowList = [
      'https://cdn.tailwindcss.com',
    ];
    for (const src of externalScripts) {
      expect(allowList, `Unexpected external script: ${src}`).toContain(src);
    }
  });
});
