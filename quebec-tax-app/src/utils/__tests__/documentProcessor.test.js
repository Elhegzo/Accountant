import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock extractWithClaude so tests never hit the real API.
vi.mock('../extractWithClaude', () => ({
  extractWithClaude: vi.fn(),
}));

import { extractWithClaude } from '../extractWithClaude';
import { toFieldKey, processDocument } from '../documentProcessor';

// ---------------------------------------------------------------------------
// toFieldKey
// ---------------------------------------------------------------------------

describe('toFieldKey', () => {
  it('converts a numeric box string', () => {
    expect(toFieldKey('14')).toBe('box14');
    expect(toFieldKey('22')).toBe('box22');
  });

  it('converts a letter box', () => {
    expect(toFieldKey('A')).toBe('boxA');
    expect(toFieldKey('E')).toBe('boxE');
  });

  it('strips dots from compound boxes (B.A → boxBA)', () => {
    expect(toFieldKey('B.A')).toBe('boxBA');
    expect(toFieldKey('B.B')).toBe('boxBB');
  });

  it('passes through the special landlordName key unchanged', () => {
    expect(toFieldKey('landlordName')).toBe('landlordName');
  });
});

// ---------------------------------------------------------------------------
// processDocument — helpers
// ---------------------------------------------------------------------------

function makeFile(name, type = 'application/pdf') {
  return { name, type };
}

describe('processDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an error object for unsupported file types', async () => {
    const result = await processDocument(makeFile('taxes.xlsx', 'application/vnd.ms-excel'), 'key');
    expect(result.error).toMatch(/unsupported/i);
  });

  it('builds correct displayRows and fields from a T4 extraction', async () => {
    extractWithClaude.mockResolvedValueOnce({
      docType: 'T4',
      fields: [
        { box: '14', description: 'Employment Income',       value: '41870.06' },
        { box: '22', description: 'Federal Income Tax',      value: '4442.54'  },
      ],
    });

    const result = await processDocument(makeFile('t4.pdf'), 'key');

    expect(result.docType).toBe('T4');
    expect(result.extractionError).toBeNull();

    // fields object — used by tax calculator
    expect(result.fields.box14).toBeCloseTo(41870.06);
    expect(result.fields.box22).toBeCloseTo(4442.54);

    // displayRows — used by UI table
    expect(result.displayRows).toHaveLength(2);
    expect(result.displayRows[0].key).toBe('box14');
    expect(result.displayRows[0].isNumeric).toBe(true);
    // Label should come from our field definition, not Claude's phrasing
    expect(result.displayRows[0].description).toBe('Employment Income');
  });

  it('uses our own label when Claude returns a different description', async () => {
    extractWithClaude.mockResolvedValueOnce({
      docType: 'T4',
      fields: [{ box: '14', description: "Claude's weird phrasing", value: '50000' }],
    });

    const result = await processDocument(makeFile('t4.pdf'), 'key');
    // Our T4_FIELD_LABELS.box14.label should override Claude's description
    expect(result.displayRows[0].description).toBe('Employment Income');
  });

  it('omits rows with empty values from the fields object', async () => {
    extractWithClaude.mockResolvedValueOnce({
      docType: 'T4',
      fields: [
        { box: '14', description: 'Employment Income', value: '50000' },
        { box: '44', description: 'Union Dues',        value: ''      },
      ],
    });

    const result = await processDocument(makeFile('t4.pdf'), 'key');
    expect(result.fields).toHaveProperty('box14');
    expect(result.fields).not.toHaveProperty('box44');
  });

  it('handles RL-1 documents correctly', async () => {
    extractWithClaude.mockResolvedValueOnce({
      docType: 'RL1',
      fields: [
        { box: 'A',   description: 'Employment Income',        value: '41870.06' },
        { box: 'E',   description: 'Quebec Income Tax',        value: '3900.00'  },
        { box: 'B.A', description: 'QPP Contributions',        value: '2000.00'  },
      ],
    });

    const result = await processDocument(makeFile('rl1.pdf'), 'key');
    expect(result.docType).toBe('RL1');
    expect(result.fields.boxA).toBeCloseTo(41870.06);
    expect(result.fields.boxE).toBeCloseTo(3900.00);
    expect(result.fields.boxBA).toBeCloseTo(2000.00);
  });

  it('returns UNKNOWN docType and extractionError when extraction fails', async () => {
    extractWithClaude.mockRejectedValueOnce(new Error('network error'));

    const result = await processDocument(makeFile('t4.pdf'), 'key');
    expect(result.docType).toBe('UNKNOWN');
    expect(result.extractionError).toBeTruthy();
    expect(result.fields).toEqual({});
    expect(result.displayRows).toEqual([]);
  });

  it('returns the missing-key error message when apiKey is absent', async () => {
    const err = new Error('ANTHROPIC_API_KEY_MISSING');
    extractWithClaude.mockRejectedValueOnce(err);

    const result = await processDocument(makeFile('t4.pdf'), '');
    expect(result.extractionError).toMatch(/api key/i);
  });

  it('returns the auth-error message for a 401 response', async () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    extractWithClaude.mockRejectedValueOnce(err);

    const result = await processDocument(makeFile('t4.pdf'), 'bad-key');
    expect(result.extractionError).toMatch(/401/);
  });

  it('returns the timeout message for an AbortError', async () => {
    const err = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    extractWithClaude.mockRejectedValueOnce(err);

    const result = await processDocument(makeFile('t4.pdf'), 'key');
    expect(result.extractionError).toMatch(/timed out/i);
  });

  it('accepts image files in addition to PDFs', async () => {
    extractWithClaude.mockResolvedValueOnce({
      docType: 'T4',
      fields: [{ box: '14', description: 'Employment Income', value: '30000' }],
    });

    const result = await processDocument(makeFile('t4.jpg', 'image/jpeg'), 'key');
    expect(result.error).toBeUndefined();
    expect(result.docType).toBe('T4');
  });
});
