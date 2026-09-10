import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo', storageBucket: 'demo.appspot.com' });
process.env.GCLOUD_PROJECT = 'demo';
const { _parseSignAnalysis, _signAnalysisConfig } = require('./index.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_SRC = readFileSync(resolve(HERE, 'index.js'), 'utf-8');

const COMPLETE = JSON.stringify({
  status: 'CONDITIONAL',
  explanation: 'No parking 8-9:30 AM Monday and Thursday for street cleaning.',
  restrictionStartsAt: '2026-09-10T08:00:00-04:00',
  restrictionEndsAt: '2026-09-10T09:30:00-04:00',
  actionableAdvice: 'Move the car before 8 AM Thursday.',
});

const FENCE = '`'.repeat(3);

describe('_parseSignAnalysis — model output handling', () => {
  it('maps a complete valid response onto the client contract', () => {
    const r = _parseSignAnalysis(COMPLETE);
    expect(r.status).toBe('CONDITIONAL');
    expect(r.explanation).toContain('street cleaning');
    expect(r.restrictionStartsAt).toBe('2026-09-10T08:00:00-04:00');
    expect(r.restrictionEndsAt).toBe('2026-09-10T09:30:00-04:00');
    expect(r.actionableAdvice).toBe('Move the car before 8 AM Thursday.');
    // Exactly the keys services/geminiService.ts declares — no extras.
    expect(Object.keys(r).sort()).toEqual(
      ['actionableAdvice', 'explanation', 'restrictionEndsAt', 'restrictionStartsAt', 'status']
    );
  });

  it('rejects the exact truncation that broke production', () => {
    // Verbatim from the live diagnostic: finishReason MAX_TOKENS, 288 thought
    // tokens, 8 output tokens. The model never reached the JSON.
    const r = _parseSignAnalysis('Here is the JSON requested:\n');
    expect(r.status).toBe('ERROR');
    expect(r.explanation).toBe('Could not parse sign analysis response.');
  });

  it('rejects JSON truncated mid-object', () => {
    expect(_parseSignAnalysis(COMPLETE.slice(0, 60)).status).toBe('ERROR');
  });

  it('rejects empty and whitespace-only output instead of inventing a verdict', () => {
    for (const t of ['', '   ', '\n\n']) {
      const r = _parseSignAnalysis(t);
      expect(r.status).toBe('ERROR');
      expect(r.explanation).toBe('Could not read a result from the sign analysis.');
    }
  });

  it('rejects a missing response (blocked or absent candidate)', () => {
    for (const t of [undefined, null, 42, {}]) {
      expect(_parseSignAnalysis(t).status).toBe('ERROR');
    }
  });

  it('rejects malformed JSON', () => {
    expect(_parseSignAnalysis('{"status": "YES",,}').status).toBe('ERROR');
    expect(_parseSignAnalysis('not json at all').status).toBe('ERROR');
  });

  it('rejects a JSON array', () => {
    expect(_parseSignAnalysis('[{"status":"YES","explanation":"ok"}]').status).toBe('ERROR');
  });

  it('still tolerates a markdown-fenced object', () => {
    const r = _parseSignAnalysis(FENCE + 'json\n' + COMPLETE + '\n' + FENCE);
    expect(r.status).toBe('CONDITIONAL');
  });
});

describe('_parseSignAnalysis — never invents permission to park', () => {
  it('does not pass through a status outside the allowlist', () => {
    for (const status of ['MAYBE', 'yes', 'SAFE', 'OK', '', null, true]) {
      const r = _parseSignAnalysis(JSON.stringify({ status, explanation: 'Looks fine.' }));
      expect(r.status).toBe('ERROR');
    }
  });

  it('refuses a verdict that arrives with no explanation behind it', () => {
    // A bare {"status":"YES"} is a claim with nothing supporting it, and the UI
    // would render it as a definitive green result.
    for (const explanation of [undefined, '', '   ', 123]) {
      const r = _parseSignAnalysis(JSON.stringify({ status: 'YES', explanation }));
      expect(r.status).toBe('ERROR');
    }
  });

  it('keeps a genuine YES that is fully formed', () => {
    const r = _parseSignAnalysis(JSON.stringify({ status: 'YES', explanation: 'Parking is allowed here now.' }));
    expect(r.status).toBe('YES');
  });

  it('bounds every string field', () => {
    const r = _parseSignAnalysis(JSON.stringify({
      status: 'NO',
      explanation: 'x'.repeat(500),
      restrictionStartsAt: 'y'.repeat(100),
      restrictionEndsAt: 'z'.repeat(100),
      actionableAdvice: 'w'.repeat(400),
    }));
    expect(r.explanation).toHaveLength(300);
    expect(r.restrictionStartsAt).toHaveLength(40);
    expect(r.restrictionEndsAt).toHaveLength(40);
    expect(r.actionableAdvice).toHaveLength(150);
  });

  it('nulls non-string optional fields rather than passing objects through', () => {
    const r = _parseSignAnalysis(JSON.stringify({
      status: 'NO', explanation: 'No standing any time.',
      restrictionStartsAt: { evil: true }, actionableAdvice: ['a'],
    }));
    expect(r.restrictionStartsAt).toBeNull();
    expect(r.actionableAdvice).toBeNull();
  });
});

describe('analyzeSign generation config', () => {
  it('disables thinking and leaves the whole budget for the answer', () => {
    // The production failure was thinking eating a 300-token cap: 288 thought
    // tokens, 8 output tokens, finishReason MAX_TOKENS.
    expect(_signAnalysisConfig.thinkingBudget).toBe(0);
    expect(_signAnalysisConfig.maxOutputTokens).toBe(512);
  });

  it('sends the schema, the mime type and the thinking budget on the request', () => {
    const fn = INDEX_SRC.slice(INDEX_SRC.indexOf('exports.analyzeSign'));
    expect(fn).toContain('responseSchema: SIGN_ANALYSIS_SCHEMA');
    expect(fn).toContain('responseMimeType: "application/json"');
    expect(fn).toContain('thinkingConfig: { thinkingBudget: SIGN_ANALYSIS_THINKING_BUDGET }');
    expect(fn).toContain('maxOutputTokens: SIGN_ANALYSIS_MAX_OUTPUT_TOKENS');
  });

  it('describes exactly the fields the client consumes, and no more', () => {
    expect(Object.keys(_signAnalysisConfig.schema.properties).sort()).toEqual(
      ['actionableAdvice', 'explanation', 'restrictionEndsAt', 'restrictionStartsAt', 'status']
    );
    expect(_signAnalysisConfig.schema.properties.status.enum).toEqual(['YES', 'NO', 'CONDITIONAL']);
    expect(_signAnalysisConfig.schema.required).toEqual(['status', 'explanation']);
  });

  it('asks for a conditional verdict when the sign is ambiguous', () => {
    const prompt = INDEX_SRC.slice(INDEX_SRC.indexOf('You are a NYC parking expert'), INDEX_SRC.indexOf('You are a NYC parking expert') + 900);
    expect(prompt).toMatch(/ambiguous or only partly legible/);
    expect(prompt).toMatch(/"YES" only if parking is clearly permitted/);
  });

  it('never logs the model text, the image or the key on the failure path', () => {
    const fn = INDEX_SRC.slice(INDEX_SRC.indexOf('exports.analyzeSign'), INDEX_SRC.indexOf('exports.generateSmartReplies'));
    const logLine = fn.slice(fn.indexOf('[analyzeSign] unusable model response'), fn.indexOf('return result;'));
    expect(logLine).toContain('finish:');
    expect(logLine).toContain('thoughtTokens:');
    expect(logLine).not.toContain('imageBase64');
    expect(logLine).not.toContain('geminiApiKey');
    // Only the length of the text is recorded, never the text itself.
    expect(logLine).toContain('response.text.length');
    expect(logLine).not.toMatch(/\$\{response\?\.text\}/);
  });
});

describe('unrelated Gemini callables keep their own configuration', () => {
  it('does not apply the sign schema or budget to the other two', () => {
    // The other callables have since been given their own schema and thinking
    // budget, so the property under test is that none of analyzeSign's
    // constants reach them — not that they lack a config of their own.
    const smart = INDEX_SRC.slice(INDEX_SRC.indexOf('exports.generateSmartReplies'), INDEX_SRC.indexOf('exports.generateSmartReplies') + 3000);
    const listing = INDEX_SRC.slice(INDEX_SRC.indexOf('exports.generateListingDescription'), INDEX_SRC.indexOf('exports.generateListingDescription') + 3000);
    for (const src of [smart, listing]) {
      expect(src).not.toContain('SIGN_ANALYSIS_SCHEMA');
      expect(src).not.toContain('SIGN_ANALYSIS_MAX_OUTPUT_TOKENS');
      expect(src).not.toContain('SIGN_ANALYSIS_THINKING_BUDGET');
      expect(src).not.toContain('_parseSignAnalysis');
    }
  });

  it('keeps analyzeSign on the shared model constant', () => {
    expect(INDEX_SRC).toContain('const GEMINI_MODEL = "gemini-3.5-flash";');
  });
});
