import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pdfjs-dist before the module under test is loaded.
// The module assigns to GlobalWorkerOptions.workerSrc at evaluation time;
// the mock lets that succeed without loading the real (browser-only) library.
vi.mock('pdfjs-dist', () => ({
  default: {},
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
  version: '5.0.0',
}));

// Mock the Anthropic SDK — unit tests must not make real network calls.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor() {
      this.messages = { create: vi.fn() };
    }
  },
}));

// Import after mocks are in place.
import { parseClaudeResponse } from '../extractWithClaude';

// ---------------------------------------------------------------------------
// parseClaudeResponse
// ---------------------------------------------------------------------------

describe('parseClaudeResponse', () => {
  it('parses a valid T4 response', () => {
    const raw = '{"documentType":"T4","fields":{"box14":41870.06,"box22":4442.54}}';
    const { docType, fields } = parseClaudeResponse(raw);
    expect(docType).toBe('T4');
    expect(fields.box14).toBe(41870.06);
    expect(fields.box22).toBe(4442.54);
  });

  it('maps RL-1 to the internal RL1 key', () => {
    const raw = '{"documentType":"RL-1","fields":{"boxA":50000,"boxE":5000}}';
    const { docType, fields } = parseClaudeResponse(raw);
    expect(docType).toBe('RL1');
    expect(fields.boxA).toBe(50000);
  });

  it('maps RL-31 to the internal RL31 key', () => {
    const raw = '{"documentType":"RL-31","fields":{"boxA":"101","boxB":2}}';
    const { docType } = parseClaudeResponse(raw);
    expect(docType).toBe('RL31');
  });

  it('strips markdown code fences before parsing', () => {
    const raw = '```json\n{"documentType":"T4","fields":{"box14":50000}}\n```';
    const { docType, fields } = parseClaudeResponse(raw);
    expect(docType).toBe('T4');
    expect(fields.box14).toBe(50000);
  });

  it('strips bare ``` fences', () => {
    const raw = '```{"documentType":"T4","fields":{"box14":50000}}```';
    const { docType } = parseClaudeResponse(raw);
    expect(docType).toBe('T4');
  });

  it('tolerates leading/trailing prose around the JSON object', () => {
    const raw = 'Here is the result: {"documentType":"T4","fields":{"box14":60000}} Done.';
    const { docType, fields } = parseClaudeResponse(raw);
    expect(docType).toBe('T4');
    expect(fields.box14).toBe(60000);
  });

  it('filters out null field values', () => {
    const raw = '{"documentType":"T4","fields":{"box14":50000,"box16":null}}';
    const { fields } = parseClaudeResponse(raw);
    expect(fields.box14).toBe(50000);
    expect('box16' in fields).toBe(false);
  });

  it('filters out empty-string field values', () => {
    const raw = '{"documentType":"T4","fields":{"box14":50000,"box17":""}}';
    const { fields } = parseClaudeResponse(raw);
    expect('box17' in fields).toBe(false);
  });

  it('keeps a zero value (explicitly set, not blank)', () => {
    const raw = '{"documentType":"T4","fields":{"box14":50000,"box52":0}}';
    const { fields } = parseClaudeResponse(raw);
    // 0 is a legitimate extracted value (pension adjustment = 0)
    expect(fields.box52).toBe(0);
  });

  it('returns an empty fields object when fields is missing', () => {
    const raw = '{"documentType":"T4"}';
    const { fields } = parseClaudeResponse(raw);
    expect(fields).toEqual({});
  });

  it('throws when there is no JSON object in the response', () => {
    expect(() => parseClaudeResponse('Sorry, I cannot read this.')).toThrow(
      'No JSON in response'
    );
  });

  it('throws on an empty string response', () => {
    expect(() => parseClaudeResponse('')).toThrow('No JSON in response');
  });

  it('throws on an unrecognised document type', () => {
    const raw = '{"documentType":"W2","fields":{"box1":50000}}';
    expect(() => parseClaudeResponse(raw)).toThrow('Unrecognised document type: "W2"');
  });

  it('throws on malformed JSON', () => {
    expect(() => parseClaudeResponse('{"documentType":"T4","fields":{broken}')).toThrow();
  });
});
