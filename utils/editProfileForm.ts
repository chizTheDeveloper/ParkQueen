export interface EditProfileDraft {
  displayName: string;
  homeArea: string;
  driverType: string;
  ageRange: string;
  genderSelect: string;
  genderCustom: string;
}

export const AGE_RANGES = ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'] as const;
export type AgeRange = typeof AGE_RANGES[number] | '';

const KNOWN_GENDERS = new Set(['Male', 'Female', 'Non-binary', 'Self-describe', 'Prefer not to say']);

export function deriveAgeRangeFromDob(dob: string | undefined): AgeRange {
  if (!dob) return '';
  const [y, m, d] = dob.split('-').map(Number);
  if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) return '';
  const birth = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(birth.getTime())) return '';
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const bdayThisYear = new Date(Date.UTC(now.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()));
  if (now < bdayThisYear) age--;
  if (age < 18) return '';
  if (age <= 24) return '18–24';
  if (age <= 34) return '25–34';
  if (age <= 44) return '35–44';
  if (age <= 54) return '45–54';
  if (age <= 64) return '55–64';
  return '65+';
}

export function isDirty(initial: EditProfileDraft, current: EditProfileDraft): boolean {
  return (Object.keys(initial) as (keyof EditProfileDraft)[]).some(k => initial[k] !== current[k]);
}

export function resolveGenderForSave(genderSelect: string, genderCustom: string): string {
  if (genderSelect === 'Self-describe') return genderCustom.trim();
  return genderSelect;
}

export function resolveGenderFromStored(stored: string | undefined): { genderSelect: string; genderCustom: string } {
  if (!stored) return { genderSelect: '', genderCustom: '' };
  if (KNOWN_GENDERS.has(stored)) return { genderSelect: stored, genderCustom: '' };
  return { genderSelect: 'Self-describe', genderCustom: stored };
}
