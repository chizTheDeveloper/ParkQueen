import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';

// Guards the app-wide secondary text colour. It is used for ~370 normal-size
// text runs, so it has to clear WCAG AA (4.5:1) on its own, and nothing may
// quietly dim it further.
const root = resolve(__dirname, '..');
const css = readFileSync(resolve(root, 'index.css'), 'utf-8');

const block = (selector: string) => {
    const start = css.indexOf(selector);
    return css.slice(start, css.indexOf('}', start));
};
const token = (src: string, name: string) => src.match(new RegExp(`${name}:\\s*([^;]+);`))![1].trim();
const rgba = (v: string): number[] => {
    if (v.startsWith('#')) return [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)).concat(1);
    const n = v.match(/[\d.]+/g)!.map(Number);
    return [n[0], n[1], n[2], n[3] ?? 1];
};
const lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const contrast = (fgValue: string, bgValue: string) => {
    const fg = rgba(fgValue), bg = rgba(bgValue);
    const mixed = [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
    const a = lum(mixed), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name.startsWith('.') || name === 'dist' || name === 'functions') continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) sourceFiles(p, out);
        else if (p.endsWith('.tsx') && !p.endsWith('.test.tsx')) out.push(p);
    }
    return out;
}

describe('secondary text contrast', () => {
    const light = block(':root {');
    const dark = block('.dark {');

    it('light --color-text-secondary clears 4.5:1 on the page and surface colours', () => {
        const fg = token(light, '--color-text-secondary');
        expect(contrast(fg, token(light, '--color-bg'))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(fg, token(light, '--color-surface'))).toBeGreaterThanOrEqual(4.5);
    });

    it('dark --color-text-secondary clears 4.5:1 on the page and surface colours', () => {
        const fg = token(dark, '--color-text-secondary');
        expect(contrast(fg, token(dark, '--color-bg'))).toBeGreaterThanOrEqual(4.5);
        expect(contrast(fg, token(dark, '--color-surface'))).toBeGreaterThanOrEqual(4.5);
    });

    it('secondary text is never dimmed further with a plain opacity class', () => {
        // disabled:/active:/hover: states and decorative aria-hidden icons are exempt.
        const offenders: string[] = [];
        for (const file of sourceFiles(root)) {
            readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
                if (!line.includes('text-[var(--color-text-secondary)]')) return;
                if (!/(^|[\s"'`])opacity-\d+/.test(line)) return;
                if (line.includes('aria-hidden="true"')) return;
                offenders.push(`${file.slice(root.length + 1)}:${i + 1}`);
            });
        }
        expect(offenders).toEqual([]);
    });

    it('themed text never sits on a hardcoded near-black background on the same element', () => {
        // A hardcoded dark bg ignores the theme, so light-mode themed text on it is dark-on-dark.
        const offenders: string[] = [];
        for (const file of sourceFiles(root)) {
            readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
                if (!/text-\[var\(--color-text(-secondary)?\)\]/.test(line)) return;
                for (const m of line.matchAll(/(?:^|[\s"'`])bg-\[#([0-9a-fA-F]{6})\]/g)) {
                    if (lum(rgba('#' + m[1])) < 0.05) offenders.push(`${file.slice(root.length + 1)}:${i + 1} #${m[1]}`);
                }
            });
        }
        expect(offenders).toEqual([]);
    });
});
