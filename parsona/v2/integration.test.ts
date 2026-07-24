import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Parsona v2 dormant integration boundary', () => {
  it('guards the lab import and route with import.meta.env.DEV', () => {
    const app = readFileSync('App.tsx', 'utf8');
    expect(app).toMatch(
      /const ParsonaV2LabView = import\.meta\.env\.DEV[\s\S]*?import\('\.\/views\/ParsonaV2LabView'\)/,
    );
    expect(app).toMatch(
      /if \(import\.meta\.env\.DEV && ParsonaV2LabView[\s\S]*?qa=parsona-v2-lab/,
    );
  });

  it('keeps the v2 lab independent from authentication and Firestore', () => {
    const lab = readFileSync('views/ParsonaV2LabView.tsx', 'utf8');
    expect(lab).not.toMatch(/firebase|firestore|auth|updateDoc|setDoc/i);
  });

  it('keeps canonical tone_03 comparison tools in the DEV-only lab', () => {
    const lab = readFileSync('views/ParsonaV2LabView.tsx', 'utf8');
    expect(lab).toContain("'overlay'");
    expect(lab).toContain("'blink'");
    expect(lab).toContain('Masculine at 50% opacity over Feminine');
    expect(lab).toContain('visible alpha bounds: x 255–768, y 108–869');
    expect(lab).toContain("slot.skinToneId === 'tone_03'");
  });

  it('keeps the dormant creator free of Firestore writes', () => {
    const creator = readFileSync('views/ParsonaV2CreatorView.tsx', 'utf8');
    expect(creator).not.toMatch(/firebase|firestore|updateDoc|setDoc/i);
  });

  it('defines the public switch once and defaults it to false', () => {
    const constants = readFileSync('parsona/v2/constants.ts', 'utf8');
    const app = readFileSync('App.tsx', 'utf8');
    expect(constants).toContain('PARSONA_V2_PUBLIC_ENABLED = false');
    expect(constants.match(/PARSONA_V2_PUBLIC_ENABLED\s*=/g)).toHaveLength(1);
    expect(app).toMatch(
      /PARSONA_V2_PUBLIC_ENABLED && ParsonaV2CreatorView \? ParsonaV2CreatorView : ParsonaCreatorView/,
    );
  });
});
