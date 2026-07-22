import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  deriveAgeRangeFromDob,
  isDirty,
  resolveGenderForSave,
  resolveGenderFromStored,
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
