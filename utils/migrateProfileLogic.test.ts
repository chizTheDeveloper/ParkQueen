import { describe, it, expect } from 'vitest';
import { computeMigration, PRIVATE_FIELDS } from './migrateProfileLogic';

const ALL_PUBLIC: Record<string, unknown> = {
  dob: '1990-05-15',
  gender: 'Female',
  homeArea: 'Brooklyn',
  driverType: 'Daily commuter',
  ageRange: '25–34',
  fullName: 'Jay Castro',
  username: 'jayc',
};

describe('computeMigration', () => {
  it('copies all private fields when private doc is empty', () => {
    const { privateUpdates, publicDeletes, skippedFields } = computeMigration(ALL_PUBLIC, {});
    expect(privateUpdates).toEqual({
      dob: '1990-05-15',
      gender: 'Female',
      homeArea: 'Brooklyn',
      driverType: 'Daily commuter',
      ageRange: '25–34',
    });
    expect(publicDeletes).toEqual(expect.arrayContaining(PRIVATE_FIELDS as unknown as string[]));
    expect(skippedFields).toHaveLength(0);
  });

  it('private value wins on conflict — public value not copied', () => {
    const { privateUpdates, skippedFields } = computeMigration(ALL_PUBLIC, { gender: 'Non-binary' });
    expect(privateUpdates).not.toHaveProperty('gender');
    expect(skippedFields).toContain('gender');
  });

  it('private win field is still scheduled for deletion from public', () => {
    const { publicDeletes } = computeMigration(ALL_PUBLIC, { gender: 'Non-binary' });
    expect(publicDeletes).toContain('gender');
  });

  it('deletes migrated public fields', () => {
    const { publicDeletes } = computeMigration({ homeArea: 'Queens' }, {});
    expect(publicDeletes).toContain('homeArea');
  });

  it('unrelated public fields are not touched', () => {
    const { privateUpdates, publicDeletes } = computeMigration(ALL_PUBLIC, {});
    expect(privateUpdates).not.toHaveProperty('fullName');
    expect(privateUpdates).not.toHaveProperty('username');
    expect(publicDeletes).not.toContain('fullName');
    expect(publicDeletes).not.toContain('username');
  });

  it('missing private document (empty object) is handled safely', () => {
    expect(() => computeMigration(ALL_PUBLIC, {})).not.toThrow();
    const { privateUpdates } = computeMigration(ALL_PUBLIC, {});
    expect(Object.keys(privateUpdates).length).toBeGreaterThan(0);
  });

  it('rerunning on already-clean public doc produces no changes', () => {
    const { privateUpdates, publicDeletes, skippedFields } = computeMigration(
      { fullName: 'Jay', username: 'jayc' },
      { dob: '1990-05-15', gender: 'Female' },
    );
    expect(Object.keys(privateUpdates)).toHaveLength(0);
    expect(publicDeletes).toHaveLength(0);
    expect(skippedFields).toHaveLength(0);
  });

  it('partial prior migration: only copies fields still absent from private', () => {
    const partial = { dob: '1990-05-15' }; // already migrated
    const { privateUpdates, publicDeletes } = computeMigration(ALL_PUBLIC, partial);
    expect(privateUpdates).not.toHaveProperty('dob');
    expect(publicDeletes).toContain('dob'); // still deleted from public
    expect(privateUpdates).toHaveProperty('gender');
    expect(privateUpdates).toHaveProperty('homeArea');
  });

  it('empty string legacy values are not copied', () => {
    const { privateUpdates, publicDeletes } = computeMigration({ dob: '', gender: '' }, {});
    expect(Object.keys(privateUpdates)).toHaveLength(0);
    expect(publicDeletes).toHaveLength(0);
  });

  it('null legacy values are not copied', () => {
    const { privateUpdates } = computeMigration({ dob: null, gender: null }, {});
    expect(Object.keys(privateUpdates)).toHaveLength(0);
  });

  it('exact dob is preserved unchanged — not transformed or derived', () => {
    const dob = '1985-11-30';
    const { privateUpdates } = computeMigration({ dob }, {});
    expect(privateUpdates.dob).toBe(dob);
  });

  it('ageRange is never derived — only copied verbatim when present in public', () => {
    // Only a stored ageRange value is copied; we don't derive from dob
    const { privateUpdates } = computeMigration({ dob: '1985-11-30' }, {});
    expect(privateUpdates).not.toHaveProperty('ageRange');
  });
});
