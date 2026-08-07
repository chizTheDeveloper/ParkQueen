// ─── Pure helpers (testable without Firestore) ────────────────────────────────
//
// The Firestore-writing half of this module (formerly backfillStreetIntelligence,
// invoked directly from views/admin/StreetSegmentsPage.tsx against the client
// Firestore SDK) has been removed. That direct-write path was authorized only
// by firestore.rules' token-only isAdmin() check, which a stale admin token
// (demoted/deleted/disabled after the token was minted) could still pass —
// Rules cannot re-verify current server-side Auth state the way
// requireCurrentAdmin does for callables. The mutation now happens exclusively
// via the adminBackfillStreetIntelligence callable (functions/index.js), whose
// field-derivation logic is a 1:1 port of the two pure functions below (see
// functions/backfillLogic.js).
//
// These pure functions are retained here only because utils/streetIntelligence.test.ts
// has existing unit coverage for them; they are no longer called by any
// production write path in this file.

function isSweepNYCData(data: Record<string, any>): boolean {
  return (
    data.source === 'sweepnyc' ||
    (data.cslSegmentId != null && data.cslSegmentId !== '')
  );
}

/**
 * Returns the fields that need to be added to a segment document.
 * Only includes keys that are currently missing (null or undefined).
 * Does NOT include `updatedAt` — caller adds it if the update is non-empty.
 */
export function computeSegmentUpdate(
  data: Record<string, any>,
): Record<string, any> {
  const isSwNYC = isSweepNYCData(data);
  const update: Record<string, any> = {};

  if (data.status == null) {
    update.status = 'active';
  }

  if (data.source == null) {
    update.source = isSwNYC ? 'sweepnyc' : 'admin';
  }

  if (data.confidenceScore == null) {
    update.confidenceScore = isSwNYC ? 0.95 : 1.0;
  }

  if (data.editedBy == null) {
    update.editedBy = 'migration:backfill';
  }

  if (data.provenance == null) {
    if (isSwNYC) {
      // Recover sweepNYCObjectId from cslSegmentId when available — not invented data.
      const parsed = data.cslSegmentId ? parseInt(data.cslSegmentId, 10) : NaN;
      update.provenance = {
        provider: 'sweepnyc' as const,
        ...(isNaN(parsed) ? {} : { sweepNYCObjectId: parsed }),
        importedBy: 'migration:backfill',
      };
    } else {
      update.provenance = {
        provider: 'admin' as const,
        importedBy: 'migration:backfill',
      };
    }
  }

  return update;
}

/**
 * Returns the fields that need to be added to a rule document.
 * `parentIsSwNYC` comes from the parent segment classification.
 */
export function computeRuleUpdate(
  ruleData: Record<string, any>,
  parentIsSwNYC: boolean,
): Record<string, any> {
  const update: Record<string, any> = {};

  if (ruleData.provenance == null) {
    // Rule's own `source` field takes precedence; fall back to parent only when absent.
    const isRuleSwNYC =
      ruleData.source != null
        ? ruleData.source === 'sweepnyc'
        : parentIsSwNYC;
    update.provenance = {
      provider: isRuleSwNYC ? ('sweepnyc' as const) : ('admin' as const),
      importedBy: 'migration:backfill',
    };
  }

  if (ruleData.editedBy == null) {
    update.editedBy = 'migration:backfill';
  }

  return update;
}
