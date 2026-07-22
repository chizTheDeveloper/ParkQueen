import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  deriveAgeRangeFromDob,
  isDirty,
  resolveGenderForSave,
  resolveGenderFromStored,
  buildPublicProfileUpdates,
  buildPrivateProfileUpdates,
  AGE_PREFER_NOT,
  type EditProfileDraft,
} from './editProfileForm';

// Pin "today" so age calculations are stable
const FIXED_TODAY = new Date('2026-07-21');
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_TODAY); });
afterEach(() => { vi.useRealTimers(); });

describe('deriveAgeRangeFromDob', () => {
  it('returns empty string for undefined', () => {
    expect(deriveAgeRangeFromDob(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(deriveAgeRangeFromDob('')).toBe('');
  });

  it('returns empty string for malformed input', () => {
    expect(deriveAgeRangeFromDob('not-a-date')).toBe('');
  });

  it('returns empty string for under-18', () => {
    expect(deriveAgeRangeFromDob('2010-07-22')).toBe(''); // turns 16 tomorrow
  });

  it('returns 18–24 for someone who just turned 18', () => {
    expect(deriveAgeRangeFromDob('2008-07-21')).toBe('18–24');
  });

  it('returns 18–24 for age 24', () => {
    expect(deriveAgeRangeFromDob('2002-07-21')).toBe('18–24');
  });

  it('returns 25–34 for age 25', () => {
    expect(deriveAgeRangeFromDob('2001-07-21')).toBe('25–34');
  });

  it('returns 35–44 for age 35', () => {
    expect(deriveAgeRangeFromDob('1991-07-21')).toBe('35–44');
  });

  it('returns 45–54 for age 45', () => {
    expect(deriveAgeRangeFromDob('1981-07-21')).toBe('45–54');
  });

  it('returns 55–64 for age 55', () => {
    expect(deriveAgeRangeFromDob('1971-07-21')).toBe('55–64');
  });

  it('returns 65+ for age 65', () => {
    expect(deriveAgeRangeFromDob('1961-07-21')).toBe('65+');
  });

  it('returns 65+ for age 90', () => {
    expect(deriveAgeRangeFromDob('1936-01-01')).toBe('65+');
  });
});

describe('isDirty', () => {
  const base: EditProfileDraft = {
    displayName: 'Jay',
    homeArea: 'Brooklyn',
    driverType: 'Daily commuter',
    ageRange: '25–34',
    genderSelect: 'Male',
    genderCustom: '',
  };

  it('returns false when draft matches initial', () => {
    expect(isDirty(base, { ...base })).toBe(false);
  });

  it('returns true when displayName changes', () => {
    expect(isDirty(base, { ...base, displayName: 'Jordan' })).toBe(true);
  });

  it('returns true when homeArea changes', () => {
    expect(isDirty(base, { ...base, homeArea: 'Queens' })).toBe(true);
  });

  it('returns true when ageRange changes', () => {
    expect(isDirty(base, { ...base, ageRange: '35–44' })).toBe(true);
  });

  it('returns true when genderSelect changes', () => {
    expect(isDirty(base, { ...base, genderSelect: 'Female' })).toBe(true);
  });

  it('returns true when genderCustom changes', () => {
    expect(isDirty(base, { ...base, genderSelect: 'Self-describe', genderCustom: 'Non-binary fluid' })).toBe(true);
  });

  it('returns false for empty-to-empty comparison', () => {
    const empty: EditProfileDraft = { displayName: '', homeArea: '', driverType: '', ageRange: '', genderSelect: '', genderCustom: '' };
    expect(isDirty(empty, { ...empty })).toBe(false);
  });
});

describe('resolveGenderForSave', () => {
  it('returns the selected value for known genders', () => {
    expect(resolveGenderForSave('Male', '')).toBe('Male');
    expect(resolveGenderForSave('Female', '')).toBe('Female');
    expect(resolveGenderForSave('Non-binary', '')).toBe('Non-binary');
    expect(resolveGenderForSave('Prefer not to say', '')).toBe('Prefer not to say');
  });

  it('returns the custom text when Self-describe is selected', () => {
    expect(resolveGenderForSave('Self-describe', 'Agender')).toBe('Agender');
  });

  it('trims whitespace from custom text', () => {
    expect(resolveGenderForSave('Self-describe', '  Agender  ')).toBe('Agender');
  });

  it('returns empty string when Self-describe has no custom text', () => {
    expect(resolveGenderForSave('Self-describe', '')).toBe('');
  });

  it('returns empty string when both are empty', () => {
    expect(resolveGenderForSave('', '')).toBe('');
  });
});

describe('resolveGenderFromStored', () => {
  it('returns empty strings for undefined', () => {
    expect(resolveGenderFromStored(undefined)).toEqual({ genderSelect: '', genderCustom: '' });
  });

  it('returns empty strings for empty string', () => {
    expect(resolveGenderFromStored('')).toEqual({ genderSelect: '', genderCustom: '' });
  });

  it('maps Male to known select', () => {
    expect(resolveGenderFromStored('Male')).toEqual({ genderSelect: 'Male', genderCustom: '' });
  });

  it('maps Non-binary to known select', () => {
    expect(resolveGenderFromStored('Non-binary')).toEqual({ genderSelect: 'Non-binary', genderCustom: '' });
  });

  it('maps Prefer not to say to known select', () => {
    expect(resolveGenderFromStored('Prefer not to say')).toEqual({ genderSelect: 'Prefer not to say', genderCustom: '' });
  });

  it('treats unknown stored value as self-describe custom text', () => {
    expect(resolveGenderFromStored('Agender')).toEqual({ genderSelect: 'Self-describe', genderCustom: 'Agender' });
  });

  it('treats legacy "Other" as self-describe (not a known gender)', () => {
    // "Other" was a prior stored value — it's not in the new set, so surfaces as self-describe
    expect(resolveGenderFromStored('Other')).toEqual({ genderSelect: 'Self-describe', genderCustom: 'Other' });
  });
});

const baseDraft: EditProfileDraft = {
  displayName: 'Jay',
  homeArea: 'Brooklyn',
  driverType: 'Daily commuter',
  ageRange: '25–34',
  genderSelect: 'Male',
  genderCustom: '',
};

describe('buildPublicProfileUpdates', () => {
  it('includes fullName when displayName changed', () => {
    const updates = buildPublicProfileUpdates({ ...baseDraft, displayName: 'Jordan' }, baseDraft);
    expect(updates.fullName).toBe('Jordan');
  });

  it('returns empty object when nothing changed', () => {
    expect(buildPublicProfileUpdates(baseDraft, baseDraft)).toEqual({});
  });

  it('never includes dob', () => {
    const updates = buildPublicProfileUpdates({ ...baseDraft, displayName: 'X' }, baseDraft);
    expect(updates).not.toHaveProperty('dob');
  });

  it('never includes private fields', () => {
    const updates = buildPublicProfileUpdates({ ...baseDraft, displayName: 'X' }, baseDraft);
    expect(updates).not.toHaveProperty('homeArea');
    expect(updates).not.toHaveProperty('driverType');
    expect(updates).not.toHaveProperty('ageRange');
    expect(updates).not.toHaveProperty('gender');
  });
});

describe('buildPrivateProfileUpdates', () => {
  it('returns empty when nothing changed and ageRangeTouched=false', () => {
    expect(buildPrivateProfileUpdates(baseDraft, baseDraft, false)).toEqual({});
  });

  it('derived ageRange is omitted when ageRangeTouched=false', () => {
    const updates = buildPrivateProfileUpdates({ ...baseDraft, homeArea: 'Queens' }, baseDraft, false);
    expect(updates).not.toHaveProperty('ageRange');
  });

  it('ageRange is written when ageRangeTouched=true', () => {
    const updates = buildPrivateProfileUpdates({ ...baseDraft, ageRange: '35–44' }, baseDraft, true);
    expect(updates.ageRange).toBe('35–44');
  });

  it('prefer-not-to-say is written as stable internal value when touched', () => {
    const updates = buildPrivateProfileUpdates({ ...baseDraft, ageRange: AGE_PREFER_NOT }, baseDraft, true);
    expect(updates.ageRange).toBe('prefer-not-to-say');
  });

  it('unchanged gender is omitted', () => {
    const updates = buildPrivateProfileUpdates({ ...baseDraft, homeArea: 'Queens' }, baseDraft, false);
    expect(updates).not.toHaveProperty('gender');
  });

  it('changed gender is included', () => {
    const updates = buildPrivateProfileUpdates({ ...baseDraft, genderSelect: 'Female' }, baseDraft, false);
    expect(updates.gender).toBe('Female');
  });

  it('changing homeArea does not rewrite gender', () => {
    const updates = buildPrivateProfileUpdates({ ...baseDraft, homeArea: 'Queens' }, baseDraft, false);
    expect(updates).toHaveProperty('homeArea', 'Queens');
    expect(updates).not.toHaveProperty('gender');
  });

  it('self-describe gender is saved as custom text', () => {
    const draft = { ...baseDraft, genderSelect: 'Self-describe', genderCustom: 'Agender' };
    const updates = buildPrivateProfileUpdates(draft, baseDraft, false);
    expect(updates.gender).toBe('Agender');
  });

  it('unchanged self-describe is omitted when custom text matches stored', () => {
    const init = { ...baseDraft, genderSelect: 'Self-describe', genderCustom: 'Agender' };
    const updates = buildPrivateProfileUpdates(init, init, false);
    expect(updates).not.toHaveProperty('gender');
  });

  it('whitespace-only self-describe is treated as empty and omitted when initial gender is empty', () => {
    const draft = { ...baseDraft, genderSelect: 'Self-describe', genderCustom: '   ' };
    const init = { ...baseDraft, genderSelect: '', genderCustom: '' };
    const updates = buildPrivateProfileUpdates(draft, init, false);
    // resolveGenderForSave trims → ''; initialGender is ''; no change → omit
    expect(updates).not.toHaveProperty('gender');
  });
});
