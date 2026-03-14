import { describe, it, expect, vi } from 'vitest';

// Mock browser-only dependencies before importing the module under test.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
  version: '5.0.0',
}));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor() { this.messages = { create: vi.fn() }; }
  },
}));

import { parseClaudeResponse } from '../extractWithClaude';

// ---------------------------------------------------------------------------
// parseClaudeResponse — exercises all parsing, filtering, and mapping logic
// ---------------------------------------------------------------------------

describe('parseClaudeResponse', () => {

  // --- Happy paths ---

  it('parses a valid T4 response', () => {
    const raw = JSON.stringify({
      documentType: 'T4',
      fields: [
        { box: '14', description: 'Employment Income',        value: '41870.06' },
        { box: '22', description: 'Federal Income Tax Deducted', value: '4442.54' },
      ],
    });
    const { docType, fields } = parseClaudeResponse(raw);
    expect(docType).toBe('T4');
    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({ box: '14', value: '41870.06' });
    expect(fields[1]).toMatchObject({ box: '22', value: '4442.54' });
  });

  it('maps RL-1 to the internal RL1 key', () => {
    const raw = JSON.stringify({
      documentType: 'RL-1',
      fields: [{ box: 'A', description: 'Employment Income', value: '50000.00' }],
    });
    const { docType } = parseClaudeResponse(raw);
    expect(docType).toBe('RL1');
  });

  it('maps RL-31 to the internal RL31 key', () => {
    const raw = JSON.stringify({
      documentType: 'RL-31',
      fields: [{ box: 'A', description: 'Unit number', value: '101' }],
    });
    const { docType } = parseClaudeResponse(raw);
    expect(docType).toBe('RL31');
  });

  it('preserves description and box from each row', () => {
    const raw = JSON.stringify({
      documentType: 'T4',
      fields: [{ box: '17', description: 'QPP Contributions', value: '3210.00' }],
    });
    const { fields } = parseClaudeResponse(raw);
    expect(fields[0].box).toBe('17');
    expect(fields[0].description).toBe('QPP Contributions');
    expect(fields[0].value).toBe('3210.00');
  });

  // --- Markdown fence stripping ---

  it('strips ```json fences before parsing', () => {
    const raw = '```json\n' + JSON.stringify({
      documentType: 'T4',
      fields: [{ box: '14', description: 'Employment Income', value: '50000.00' }],
    }) + '\n```';
    const { docType } = parseClaudeResponse(raw);
    expect(docType).toBe('T4');
  });

  it('strips bare ``` fences', () => {
    const raw = '```' + JSON.stringify({
      documentType: 'T4',
      fields: [{ box: '14', description: 'Employment Income', value: '50000.00' }],
    }) + '```';
    const { docType } = parseClaudeResponse(raw);
    expect(docType).toBe('T4');
  });

  it('tolerates leading and trailing prose around the JSON object', () => {
    const json = JSON.stringify({
      documentType: 'T4',
      fields: [{ box: '14', description: 'Employment Income', value: '60000.00' }],
    });
    const { docType, fields } = parseClaudeResponse(`Here is the result: ${json} Done.`);
    expect(docType).toBe('T4');
    expect(fields[0].value).toBe('60000.00');
  });

  // --- Empty / blank field filtering ---

  it('filters out rows with a null value', () => {
    const raw = JSON.stringify({
      documentType: 'T4',
      fields: [
        { box: '14', description: 'Employment Income', value: '50000.00' },
        { box: '16', description: 'CPP',               value: null },
      ],
    });
    const { fields } = parseClaudeResponse(raw);
    expect(fields).toHaveLength(1);
    expect(fields[0].box).toBe('14');
  });

  it('filters out rows with an empty-string value', () => {
    const raw = JSON.stringify({
      documentType: 'T4',
      fields: [
        { box: '14', description: 'Employment Income', value: '50000.00' },
        { box: '17', description: 'QPP',               value: '' },
      ],
    });
    const { fields } = parseClaudeResponse(raw);
    expect(fields).toHaveLength(1);
  });

  it('filters out rows with a whitespace-only value', () => {
    const raw = JSON.stringify({
      documentType: 'T4',
      fields: [
        { box: '14', description: 'Employment Income', value: '50000.00' },
        { box: '44', description: 'Union Dues',        value: '   ' },
      ],
    });
    const { fields } = parseClaudeResponse(raw);
    expect(fields).toHaveLength(1);
  });

  it('filters out rows with no box identifier', () => {
    const raw = JSON.stringify({
      documentType: 'T4',
      fields: [
        { box: '14',  description: 'Employment Income', value: '50000.00' },
        { box: '',    description: 'Unknown',           value: '100.00' },
        { box: null,  description: 'Also unknown',      value: '200.00' },
      ],
    });
    const { fields } = parseClaudeResponse(raw);
    expect(fields).toHaveLength(1);
  });

  it('returns an empty fields array when the fields key is absent', () => {
    const raw = JSON.stringify({ documentType: 'T4' });
    const { fields } = parseClaudeResponse(raw);
    expect(fields).toEqual([]);
  });

  it('returns an empty fields array when fields is an empty array', () => {
    const raw = JSON.stringify({ documentType: 'T4', fields: [] });
    const { fields } = parseClaudeResponse(raw);
    expect(fields).toEqual([]);
  });

  // --- Error cases ---

  it('throws when there is no JSON object in the response', () => {
    expect(() => parseClaudeResponse('Sorry, I cannot read this document.')).toThrow(
      'No JSON in response'
    );
  });

  it('throws on an empty string response', () => {
    expect(() => parseClaudeResponse('')).toThrow('No JSON in response');
  });

  it('throws on an unrecognised document type', () => {
    const raw = JSON.stringify({ documentType: 'W2', fields: [] });
    expect(() => parseClaudeResponse(raw)).toThrow('Unrecognised document type: "W2"');
  });

  it('throws on malformed JSON', () => {
    expect(() => parseClaudeResponse('{"documentType":"T4","fields":[{broken}]}')).toThrow();
  });
});
