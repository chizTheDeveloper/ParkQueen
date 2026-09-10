import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo', storageBucket: 'demo.appspot.com' });
process.env.GCLOUD_PROJECT = 'demo';
const {
  _parseSmartReplies,
  _parseListingDescription,
  _smartRepliesConfig,
  _listingDescriptionConfig,
  _signAnalysisConfig,
} = require('./index.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_SRC = readFileSync(resolve(HERE, 'index.js'), 'utf-8');

const FENCE = '`'.repeat(3);
const sliceFn = (name) => {
  const start = INDEX_SRC.indexOf(`exports.${name} = onCall`);
  const end = INDEX_SRC.indexOf('\nexports.', start + 10);
  return INDEX_SRC.slice(start, end === -1 ? undefined : end);
};

const okReplies = (r) => JSON.stringify({ replies: r });

describe('_parseSmartReplies — valid output', () => {
  it('returns the three suggestions in order', () => {
    const r = _parseSmartReplies(okReplies(['Yes, still available.', 'On my way!', 'Thanks!']));
    expect(r).toEqual(['Yes, still available.', 'On my way!', 'Thanks!']);
  });

  it('keeps replies that contain commas intact', () => {
    // The old implementation split the model's prose on "," and would have
    // turned this single reply into two fragments.
    const r = _parseSmartReplies(okReplies(['Yes, it is free', 'Sounds good', 'Thank you']));
    expect(r[0]).toBe('Yes, it is free');
    expect(r).toHaveLength(3);
  });

  it('trims surrounding whitespace', () => {
    expect(_parseSmartReplies(okReplies(['  Sure thing  ', 'Ok', 'Thanks']))[0]).toBe('Sure thing');
  });

  it('tolerates a markdown-fenced object', () => {
    const r = _parseSmartReplies(FENCE + 'json\n' + okReplies(['A', 'B', 'C']) + '\n' + FENCE);
    expect(r).toEqual(['A', 'B', 'C']);
  });
});

describe('_parseSmartReplies — never emits a broken suggestion', () => {
  it('drops empty and whitespace-only replies', () => {
    expect(_parseSmartReplies(okReplies(['', '   ', 'Thanks!']))).toEqual(['Thanks!']);
  });

  it('returns [] for the empty-response case that used to render a blank pill', () => {
    // "".split(",") produced [""], and MessagesView renders each entry as a
    // tappable button that sends the text — so a blank pill sent an empty message.
    expect(_parseSmartReplies('')).toEqual([]);
    expect(_parseSmartReplies('   ')).toEqual([]);
  });

  it('de-duplicates case-insensitively', () => {
    expect(_parseSmartReplies(okReplies(['Thanks!', 'thanks!', 'Sure']))).toEqual(['Thanks!', 'Sure']);
  });

  it('bounds an overlong reply', () => {
    const r = _parseSmartReplies(okReplies(['x'.repeat(500), 'Ok', 'Thanks']));
    expect(r[0]).toHaveLength(_smartRepliesConfig.maxReplyLength);
  });

  it('never returns more than the configured count', () => {
    const r = _parseSmartReplies(okReplies(['a', 'b', 'c', 'd', 'e', 'f']));
    expect(r).toHaveLength(_smartRepliesConfig.replyCount);
  });

  it('rejects malformed JSON', () => {
    expect(_parseSmartReplies('{"replies": [,,]}')).toEqual([]);
    expect(_parseSmartReplies('not json')).toEqual([]);
  });

  it('rejects model prose instead of structured data', () => {
    expect(_parseSmartReplies('Here are three replies: Yes, No, Maybe')).toEqual([]);
  });

  it('rejects a truncated object', () => {
    expect(_parseSmartReplies('{"replies":["Yes, still ava')).toEqual([]);
  });

  it('rejects a blocked or absent response', () => {
    for (const t of [undefined, null, 42, {}]) expect(_parseSmartReplies(t)).toEqual([]);
  });

  it('rejects a wrong-shaped payload', () => {
    expect(_parseSmartReplies('{"replies":"Yes"}')).toEqual([]);
    expect(_parseSmartReplies('{"suggestions":["Yes"]}')).toEqual([]);
    expect(_parseSmartReplies('["Yes","No","Maybe"]')).toEqual([]);
  });

  it('skips non-string entries rather than forwarding them', () => {
    expect(_parseSmartReplies(okReplies([1, { a: 1 }, 'Thanks']))).toEqual(['Thanks']);
  });
});

describe('_parseListingDescription', () => {
  const ok = (d) => JSON.stringify({ description: d });

  it('returns a complete description', () => {
    expect(_parseListingDescription(ok('Secure covered parking steps from the subway.')))
      .toBe('Secure covered parking steps from the subway.');
  });

  it('trims whitespace', () => {
    expect(_parseListingDescription(ok('  Premium spot.  '))).toBe('Premium spot.');
  });

  it('bounds an overlong description', () => {
    const r = _parseListingDescription(ok('x'.repeat(2000)));
    expect(r).toHaveLength(_listingDescriptionConfig.maxDescriptionLength);
  });

  it('rejects empty and whitespace-only descriptions', () => {
    expect(_parseListingDescription(ok(''))).toBeNull();
    expect(_parseListingDescription(ok('    '))).toBeNull();
  });

  it('rejects empty, malformed, blocked and wrong-shaped responses', () => {
    for (const t of ['', '   ', 'not json', '{"description":', undefined, null, 42]) {
      expect(_parseListingDescription(t)).toBeNull();
    }
    expect(_parseListingDescription('{"description":123}')).toBeNull();
    expect(_parseListingDescription('{"text":"hello"}')).toBeNull();
  });

  it('rejects a truncated object', () => {
    expect(_parseListingDescription('{"description":"Secure the ultimate pre')).toBeNull();
  });
});

describe('callable wiring — truncation, fallback and contracts', () => {
  const smart = sliceFn('generateSmartReplies');
  const listing = sliceFn('generateListingDescription');

  it('rejects a MAX_TOKENS finish outright in both callables', () => {
    for (const src of [smart, listing]) {
      expect(src).toContain('finishReason === "MAX_TOKENS"');
    }
  });

  it('smart replies degrade to an empty array, never a partial suggestion', () => {
    expect(smart).toContain('return { replies };');
    expect(smart).not.toContain('.split(",")');
  });

  it('listing description falls back to the safe canned string', () => {
    expect(listing).toContain('parsed ?? LISTING_DESCRIPTION_FALLBACK');
    expect(_listingDescriptionConfig.fallback).toBe('A great parking spot in the heart of the city.');
  });

  it('preserves the existing client contracts', () => {
    expect(smart).toMatch(/return \{ replies \}/);
    expect(listing).toMatch(/return \{ description: /);
  });

  it('sends the intended schema, mime type and thinking budget', () => {
    expect(smart).toContain('responseSchema: SMART_REPLIES_SCHEMA');
    expect(smart).toContain('thinkingConfig: { thinkingBudget: SMART_REPLIES_THINKING_BUDGET }');
    expect(listing).toContain('responseSchema: LISTING_DESCRIPTION_SCHEMA');
    expect(listing).toContain('thinkingConfig: { thinkingBudget: LISTING_DESCRIPTION_THINKING_BUDGET }');
  });

  it('uses the measured token caps, with thinking disabled', () => {
    // Complete answers measured 43 and 45 output tokens with thinking off.
    expect(_smartRepliesConfig.thinkingBudget).toBe(0);
    expect(_smartRepliesConfig.maxOutputTokens).toBe(192);
    expect(_listingDescriptionConfig.thinkingBudget).toBe(0);
    expect(_listingDescriptionConfig.maxOutputTokens).toBe(256);
  });

  it('describes exactly the client shape in each schema', () => {
    expect(Object.keys(_smartRepliesConfig.schema.properties)).toEqual(['replies']);
    expect(_smartRepliesConfig.schema.properties.replies.type).toBe('ARRAY');
    expect(_smartRepliesConfig.schema.properties.replies.minItems).toBe('3');
    expect(_smartRepliesConfig.schema.properties.replies.maxItems).toBe('3');
    expect(Object.keys(_listingDescriptionConfig.schema.properties)).toEqual(['description']);
  });
});

describe('failure logging leaks nothing', () => {
  it('records shape and budget only — never message text, prompt or key', () => {
    const start = INDEX_SRC.indexOf('function _logGeminiShortfall');
    const body = INDEX_SRC.slice(start, INDEX_SRC.indexOf('\n}', start));
    expect(body).toContain('finish:');
    expect(body).toContain('thoughtTokens:');
    expect(body).toContain('category:');
    // Only the length of the text is recorded, never the text itself.
    expect(body).toContain('response.text.length');
    expect(body).not.toMatch(/\$\{response\?\.text\}/);
    for (const forbidden of ['safeMessage', 'safeContext', 'lastMessage', 'features', 'geminiApiKey']) {
      expect(body).not.toContain(forbidden);
    }
  });

  it('neither callable logs the conversation or the feature list', () => {
    for (const src of [sliceFn('generateSmartReplies'), sliceFn('generateListingDescription')]) {
      const logs = src.split('\n').filter(l => /console\.(log|error|warn)/.test(l)).join('\n');
      expect(logs).not.toContain('safeMessage');
      expect(logs).not.toContain('safeContext');
      expect(logs).not.toContain('features');
    }
  });
});

describe('analyzeSign is untouched by this change', () => {
  it('keeps the PR #139 configuration exactly', () => {
    expect(_signAnalysisConfig.maxOutputTokens).toBe(512);
    expect(_signAnalysisConfig.thinkingBudget).toBe(0);
    expect(Object.keys(_signAnalysisConfig.schema.properties).sort()).toEqual(
      ['actionableAdvice', 'explanation', 'restrictionEndsAt', 'restrictionStartsAt', 'status']
    );
    expect(_signAnalysisConfig.schema.properties.status.enum).toEqual(['YES', 'NO', 'CONDITIONAL']);
  });

  it('still sends its own schema and budget', () => {
    const sign = sliceFn('analyzeSign');
    expect(sign).toContain('responseSchema: SIGN_ANALYSIS_SCHEMA');
    expect(sign).toContain('maxOutputTokens: SIGN_ANALYSIS_MAX_OUTPUT_TOKENS');
    expect(sign).toContain('thinkingConfig: { thinkingBudget: SIGN_ANALYSIS_THINKING_BUDGET }');
  });
});

describe('no cross-callable configuration leakage', () => {
  it('each callable references only its own schema and budget', () => {
    const pairs = [
      ['analyzeSign', 'SIGN_ANALYSIS', ['SMART_REPLIES', 'LISTING_DESCRIPTION']],
      ['generateSmartReplies', 'SMART_REPLIES', ['SIGN_ANALYSIS', 'LISTING_DESCRIPTION']],
      ['generateListingDescription', 'LISTING_DESCRIPTION', ['SIGN_ANALYSIS', 'SMART_REPLIES']],
    ];
    for (const [fn, own, foreign] of pairs) {
      const src = sliceFn(fn);
      expect(src).toContain(own + '_SCHEMA');
      for (const other of foreign) expect(src).not.toContain(other + '_SCHEMA');
    }
  });

  it('all three still share the one model constant and the one secret', () => {
    expect(INDEX_SRC).toContain('const GEMINI_MODEL = "gemini-3.5-flash";');
    for (const fn of ['analyzeSign', 'generateSmartReplies', 'generateListingDescription']) {
      expect(sliceFn(fn)).toContain('secrets: [geminiApiKey]');
    }
    expect(INDEX_SRC).toContain('defineSecret("GEMINI_API_KEY")');
  });

  it('keeps the existing rate limits on both callables', () => {
    expect(sliceFn('generateSmartReplies')).toMatch(/checkRateLimit\([^)]*'generateSmartReplies'[^)]*limit: 20/s);
    expect(sliceFn('generateListingDescription')).toMatch(/checkRateLimit\([^)]*'generateListingDescription'[^)]*limit: 20/s);
  });
});
