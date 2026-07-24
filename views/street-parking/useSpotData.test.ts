import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('useSpotData live Ping query', () => {
    it('constrains the listener to statuses readable by every signed-in user', () => {
        const source = readFileSync(
            new URL('./useSpotData.ts', import.meta.url),
            'utf8',
        );

        expect(source).toContain(
            'where("status", "in", ["available", "interested"])',
        );
    });
});
