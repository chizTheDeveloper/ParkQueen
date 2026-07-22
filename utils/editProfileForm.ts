export interface EditProfileDraft {
  displayName: string;
  homeArea: string;
  driverType: string;
  ageRange: string;
  genderSelect: string;
  genderCustom: string;
}

export const AGE_RANGES = ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'] as const;
export const AGE_PREFER_NOT = 'prefer-not-to-say' as const;
export type AgeRange = typeof AGE_RANGES[number] | typeof AGE_PREFER_NOT | '';

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

const EMPTY_DRAFT: EditProfileDraft = { displayName: '', homeArea: '', driverType: '', ageRange: '', genderSelect: '', genderCustom: '' };

/**
 * Fields to write to users/{uid} (public document).
 * Only writes displayName if it changed. Never writes demographics or dob.
 */
export function buildPublicProfileUpdates(
  draft: EditProfileDraft,
  initial: EditProfileDraft | null,
): Record<string, any> {
  const init = initial ?? EMPTY_DRAFT;
  const updates: Record<string, any> = {};
  if (draft.displayName !== init.displayName) updates.fullName = draft.displayName;
  return updates;
}

/**
 * Fields to write to users/{uid}/private/profile (owner-only document).
 * ageRange is included only when ageRangeTouched is true (explicit user selection).
 * Gender is included only when the resolved value differs from stored.
 */
export function buildPrivateProfileUpdates(
  draft: EditProfileDraft,
  initial: EditProfileDraft | null,
  ageRangeTouched: boolean,
): Record<string, any> {
  const init = initial ?? EMPTY_DRAFT;
  const updates: Record<string, any> = {};
  if (draft.homeArea !== init.homeArea) updates.homeArea = draft.homeArea;
  if (draft.driverType !== init.driverType) updates.driverType = draft.driverType;
  if (ageRangeTouched) updates.ageRange = draft.ageRange;
  const gender = resolveGenderForSave(draft.genderSelect, draft.genderCustom);
  const initialGender = resolveGenderForSave(init.genderSelect, init.genderCustom);
  if (gender !== initialGender) updates.gender = gender;
  return updates;
}
