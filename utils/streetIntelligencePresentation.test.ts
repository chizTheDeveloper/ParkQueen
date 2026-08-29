import { describe, expect, it } from 'vitest';
import { classifyStreetIntelligence } from './streetIntelligencePresentation';

const schedules = [{ side: 'West', days: ['Mon'], startTime: '08:30', endTime: '10:00' }];

const adminSegment = {
  status: 'active',
  source: 'admin',
  confidenceScore: 1,
  provenance: { provider: 'admin' },
};

const sweepSegment = {
  status: 'active',
  source: 'sweepnyc',
  confidenceScore: 0.95,
  provenance: { provider: 'sweepnyc', geometrySource: 'osm' },
};

const adminRule = { source: 'admin', schedules, lastSourceSync: '2026-08-29' };
const sweepRule = { source: 'sweepnyc', schedules, lastSourceSync: '2026-08-29T18:20:00.000Z' };

describe('classifyStreetIntelligence', () => {
  it.each([
    ['missing segment', null, [adminRule]],
    ['missing status', { ...adminSegment, status: undefined }, [adminRule]],
    ['missing source', { ...adminSegment, source: undefined }, [adminRule]],
    ['missing confidence', { ...adminSegment, confidenceScore: undefined }, [adminRule]],
    ['lastVerifiedAt without confidence', { ...adminSegment, confidenceScore: undefined, confidence: { lastVerifiedAt: '2026-08-29' } }, [adminRule]],
    ['mismatched provenance provider', { ...adminSegment, provenance: { provider: 'sweepnyc' } }, [adminRule]],
    ['missing rule source', adminSegment, [{ ...adminRule, source: undefined }]],
    ['empty schedules', adminSegment, [{ ...adminRule, schedules: [] }]],
    ['archived segment', { ...adminSegment, status: 'archived' }, [adminRule]],
    ['duplicate segment', { ...adminSegment, status: 'duplicate' }, [adminRule]],
    ['missing rules', adminSegment, []],
  ])('fails closed to unknown for %s', (_name, segment, rules) => {
    expect(classifyStreetIntelligence(segment, rules).state).toBe('unknown');
  });

  it.each([
    ['needs_review status', { ...sweepSegment, status: 'needs_review' }, [sweepRule]],
    ['needsReview flag', { ...sweepSegment, needsReview: true }, [sweepRule]],
    ['rule needsReview flag', sweepSegment, [{ ...sweepRule, needsReview: true }]],
    ['fallback geometry', { ...sweepSegment, confidenceScore: 0.6, provenance: { provider: 'sweepnyc', geometrySource: 'fallback' } }, [sweepRule]],
    ['NYC Open Data fallback', { ...sweepSegment, source: 'nyc_open_data', confidenceScore: 0.5, provenance: { provider: 'nyc_open_data', geometrySource: 'osm' } }, [{ ...sweepRule, source: 'nyc_open_data' }]],
    ['low repository confidence', { ...sweepSegment, confidenceScore: 0.6 }, [sweepRule]],
  ])('uses caution for %s', (_name, segment, rules) => {
    expect(classifyStreetIntelligence(segment, rules).state).toBe('caution');
  });

  it.each([
    ['admin data', adminSegment, [adminRule], 'admin'],
    ['SweepNYC data', sweepSegment, [sweepRule], 'sweepnyc'],
  ])('keeps supported %s useful without inventing a score', (_name, segment, rules, source) => {
    expect(classifyStreetIntelligence(segment, rules)).toMatchObject({
      state: 'supported',
      source,
      lastSourceSync: expect.any(String),
    });
  });

  it('does not invent freshness when lastSourceSync is absent', () => {
    const result = classifyStreetIntelligence(adminSegment, [{ ...adminRule, lastSourceSync: null }]);
    expect(result.lastSourceSync).toBeNull();
  });

  it('reports the actual rule source when an admin rule supplies the parking decision for a SweepNYC segment', () => {
    const result = classifyStreetIntelligence(sweepSegment, [adminRule]);
    expect(result.source).toBe('admin');
  });

  it('treats mixed active rule sources as caution and does not imply one authoritative source', () => {
    const result = classifyStreetIntelligence(sweepSegment, [sweepRule, adminRule]);
    expect(result).toMatchObject({ state: 'caution', source: null });
  });

  it.each([
    ['admin source with SweepNYC confidence', { ...adminSegment, confidenceScore: 0.95 }, adminRule],
    ['SweepNYC source with admin confidence', { ...sweepSegment, confidenceScore: 1 }, sweepRule],
  ])('fails closed to caution for mismatched source semantics: %s', (_name, segment, rule) => {
    expect(classifyStreetIntelligence(segment, [rule]).state).toBe('caution');
  });
});
