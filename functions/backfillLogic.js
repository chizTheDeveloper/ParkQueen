'use strict';

// Pure field-derivation logic for the Street Intelligence schema backfill.
// Ported 1:1 from utils/backfill.ts's computeSegmentUpdate/computeRuleUpdate,
// which used to run this same logic directly against the client Firestore SDK
// from views/admin/StreetSegmentsPage.tsx. That direct-client-write path has
// been removed (see firestore.rules and adminBackfillStreetIntelligence in
// index.js) because a stale/demoted/deleted/disabled admin's token could
// still perform it via isAdmin()-gated Rules regardless of Cloud Function
// hardening. This module now backs the server-side callable instead; the
// derivation rules themselves are unchanged.

function isSweepNYCData(data) {
  return (
    data.source === 'sweepnyc' ||
    (data.cslSegmentId != null && data.cslSegmentId !== '')
  );
}

function computeSegmentUpdate(data) {
  const isSwNYC = isSweepNYCData(data);
  const update = {};

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
      const parsed = data.cslSegmentId ? parseInt(data.cslSegmentId, 10) : NaN;
      update.provenance = {
        provider: 'sweepnyc',
        ...(isNaN(parsed) ? {} : { sweepNYCObjectId: parsed }),
        importedBy: 'migration:backfill',
      };
    } else {
      update.provenance = {
        provider: 'admin',
        importedBy: 'migration:backfill',
      };
    }
  }

  return update;
}

function computeRuleUpdate(ruleData, parentIsSwNYC) {
  const update = {};

  if (ruleData.provenance == null) {
    const isRuleSwNYC =
      ruleData.source != null
        ? ruleData.source === 'sweepnyc'
        : parentIsSwNYC;
    update.provenance = {
      provider: isRuleSwNYC ? 'sweepnyc' : 'admin',
      importedBy: 'migration:backfill',
    };
  }

  if (ruleData.editedBy == null) {
    update.editedBy = 'migration:backfill';
  }

  return update;
}

module.exports = { isSweepNYCData, computeSegmentUpdate, computeRuleUpdate };
