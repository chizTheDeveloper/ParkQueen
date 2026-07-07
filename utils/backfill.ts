import {
  collection, getDocs, doc, updateDoc, Timestamp,
  type Firestore,
} from 'firebase/firestore';

// ─── Pure helpers (testable without Firestore) ────────────────────────────────

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

// ─── Result type ──────────────────────────────────────────────────────────────

export interface BackfillResult {
  segmentsScanned: number;
  segmentsUpdated: number;
  rulesScanned: number;
  rulesUpdated: number;
  dryRun: boolean;
}

// ─── Firestore runner ─────────────────────────────────────────────────────────

/**
 * Backfills missing schema fields on all streetSegments and their streetRules.
 *
 * Idempotent: only writes fields that are currently null/undefined.
 * Running twice leaves already-backfilled documents unchanged.
 *
 * @param dryRun  When true, counts what would change but writes nothing.
 */
export async function backfillStreetIntelligence(
  db: Firestore,
  dryRun = false,
): Promise<BackfillResult> {
  const result: BackfillResult = {
    segmentsScanned: 0,
    segmentsUpdated: 0,
    rulesScanned: 0,
    rulesUpdated: 0,
    dryRun,
  };

  const segmentsSnap = await getDocs(collection(db, 'streetSegments'));

  for (const segDoc of segmentsSnap.docs) {
    result.segmentsScanned++;
    const data = segDoc.data();
    const isSwNYC = isSweepNYCData(data);

    const segUpdate = computeSegmentUpdate(data);

    // Add updatedAt only when there's actually something to update,
    // and only if updatedAt is also missing (don't bump timestamps on no-ops).
    if (Object.keys(segUpdate).length > 0) {
      if (data.updatedAt == null) {
        segUpdate.updatedAt = Timestamp.now();
      }
      result.segmentsUpdated++;
      if (!dryRun) {
        await updateDoc(doc(db, 'streetSegments', segDoc.id), segUpdate);
      }
    }

    // Rules subcollection
    const rulesSnap = await getDocs(
      collection(db, 'streetSegments', segDoc.id, 'streetRules'),
    );
    for (const ruleDoc of rulesSnap.docs) {
      result.rulesScanned++;
      const ruleData = ruleDoc.data();
      const ruleUpdate = computeRuleUpdate(ruleData, isSwNYC);

      if (Object.keys(ruleUpdate).length > 0) {
        result.rulesUpdated++;
        if (!dryRun) {
          await updateDoc(
            doc(db, 'streetSegments', segDoc.id, 'streetRules', ruleDoc.id),
            ruleUpdate,
          );
        }
      }
    }
  }

  return result;
}
