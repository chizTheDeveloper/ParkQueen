export type StreetIntelligencePresentationState = 'supported' | 'caution' | 'unknown';
export type StreetIntelligenceSource = 'admin' | 'sweepnyc' | 'nyc_open_data';

export interface StreetIntelligencePresentation {
  state: StreetIntelligencePresentationState;
  source: StreetIntelligenceSource | null;
  lastSourceSync: string | null;
}

const SOURCES: StreetIntelligenceSource[] = ['admin', 'sweepnyc', 'nyc_open_data'];

function isSource(value: unknown): value is StreetIntelligenceSource {
  return typeof value === 'string' && SOURCES.includes(value as StreetIntelligenceSource);
}

function hasSupportedConfidence(segment: Record<string, any>): boolean {
  return (segment.source === 'admin' && segment.confidenceScore === 1)
    || (segment.source === 'sweepnyc' && segment.confidenceScore === 0.95);
}

function latestSourceSync(rules: Record<string, any>[]): string | null {
  const values = rules
    .map(rule => rule.lastSourceSync)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .sort();
  return values.length > 0 ? values[values.length - 1] : null;
}

export function classifyStreetIntelligence(
  segment: Record<string, any> | null,
  rules: Record<string, any>[],
): StreetIntelligencePresentation {
  const unknown: StreetIntelligencePresentation = {
    state: 'unknown',
    source: null,
    lastSourceSync: null,
  };

  if (!segment || !Array.isArray(rules) || rules.length === 0) return unknown;
  if (segment.status !== 'active' && segment.status !== 'needs_review') return unknown;
  if (!isSource(segment.source) || !isSource(segment.provenance?.provider)) return unknown;
  if (segment.source !== segment.provenance.provider) return unknown;
  if (typeof segment.confidenceScore !== 'number' || !Number.isFinite(segment.confidenceScore)) return unknown;
  if (rules.some(rule => !isSource(rule.source))) return unknown;

  const usableSchedules = rules.flatMap(rule => Array.isArray(rule.schedules) ? rule.schedules : []);
  if (usableSchedules.length === 0) return unknown;

  const ruleSources = [...new Set(rules.map(rule => rule.source as StreetIntelligenceSource))];
  const source = ruleSources.length === 1 ? ruleSources[0] : null;
  const hasMixedRuleSources = ruleSources.length > 1;
  const lastSourceSync = latestSourceSync(rules);
  const hasFallbackSource = ruleSources.includes('nyc_open_data')
    || segment.provenance.geometrySource === 'fallback';
  const hasReviewSignal = segment.status === 'needs_review'
    || segment.needsReview === true
    || rules.some(rule => rule.needsReview === true)
    || segment.confidence?.level === 'flagged'
    || segment.confidence?.level === 'unverified';
  const hasLowConfidence = !hasSupportedConfidence(segment);

  return {
    state: hasFallbackSource || hasReviewSignal || hasLowConfidence || hasMixedRuleSources
      ? 'caution'
      : 'supported',
    source,
    lastSourceSync,
  };
}
