/**
 * Pure migration logic — no Firestore dependency.
 * Used by both the admin migration script and the vitest test suite.
 */

export const PRIVATE_FIELDS = ['dob', 'gender', 'homeArea', 'driverType', 'ageRange'] as const;

export type PrivateField = typeof PRIVATE_FIELDS[number];

export interface MigrationResult {
  /** Fields to merge into users/{uid}/private/profile (absent in private, non-empty in public). */
  privateUpdates: Partial<Record<PrivateField, unknown>>;
  /** All private-category fields found in public doc — deleted regardless of conflict. */
  publicDeletes: PrivateField[];
  /** Private fields where private doc already had a value; public value discarded, not copied. */
  skippedFields: PrivateField[];
}

function isPresent(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

/**
 * Compute what must move from publicData → privateData.
 *
 * Conflict rule: private doc value wins.
 * - If private already has a value → skip copy, still delete from public.
 * - If private is absent → copy from public, then delete from public.
 * - Empty / undefined public values are never copied.
 */
export function computeMigration(
  publicData: Record<string, unknown>,
  privateData: Record<string, unknown>,
): MigrationResult {
  const privateUpdates: Partial<Record<PrivateField, unknown>> = {};
  const publicDeletes: PrivateField[] = [];
  const skippedFields: PrivateField[] = [];

  for (const field of PRIVATE_FIELDS) {
    const pubVal = publicData[field];
    if (!isPresent(pubVal)) continue; // not in public or empty — nothing to do

    publicDeletes.push(field); // always schedule removal from public

    if (isPresent(privateData[field])) {
      skippedFields.push(field); // private wins — don't overwrite
    } else {
      privateUpdates[field] = pubVal; // copy to private
    }
  }

  return { privateUpdates, publicDeletes, skippedFields };
}
