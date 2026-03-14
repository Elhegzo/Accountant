import { describe, it, expect } from 'vitest';
import { T4_FIELD_LABELS } from '../parseT4';
import { RL1_FIELD_LABELS } from '../parseRl1';
import { RL31_FIELD_LABELS } from '../parseRl31';

// ---------------------------------------------------------------------------
// Schema guard — every field definition must have the shape the UI depends on.
// Catching a missing or misnamed property here prevents silent UI breakage.
// ---------------------------------------------------------------------------

function assertFieldShape(key, def) {
  expect(typeof def.label,       `${key}.label`).toBe('string');
  expect(def.label.length,       `${key}.label is non-empty`).toBeGreaterThan(0);
  expect(typeof def.box,         `${key}.box`).toBe('string');
  expect(def.box.length,         `${key}.box is non-empty`).toBeGreaterThan(0);
  expect(typeof def.description, `${key}.description`).toBe('string');
  expect(typeof def.isNumeric,   `${key}.isNumeric`).toBe('boolean');
}

describe('T4_FIELD_LABELS', () => {
  it('defines all required T4 boxes', () => {
    const required = ['box14', 'box16', 'box17', 'box18', 'box22',
                      'box44', 'box46', 'box52', 'box55', 'box40', 'box85'];
    for (const key of required) {
      expect(T4_FIELD_LABELS, `T4_FIELD_LABELS should contain ${key}`).toHaveProperty(key);
    }
  });

  it('every T4 field has the correct shape', () => {
    for (const [key, def] of Object.entries(T4_FIELD_LABELS)) {
      assertFieldShape(key, def);
    }
  });

  it('all numeric T4 fields are marked isNumeric: true', () => {
    // All standard T4 fields are monetary values
    for (const [key, def] of Object.entries(T4_FIELD_LABELS)) {
      expect(def.isNumeric, `${key} should be numeric`).toBe(true);
    }
  });
});

describe('RL1_FIELD_LABELS', () => {
  it('defines all required RL-1 boxes', () => {
    const required = ['boxA', 'boxBA', 'boxBB', 'boxC', 'boxE',
                      'boxG', 'boxH', 'boxI', 'boxJ', 'box235'];
    for (const key of required) {
      expect(RL1_FIELD_LABELS, `RL1_FIELD_LABELS should contain ${key}`).toHaveProperty(key);
    }
  });

  it('every RL-1 field has the correct shape', () => {
    for (const [key, def] of Object.entries(RL1_FIELD_LABELS)) {
      assertFieldShape(key, def);
    }
  });

  it('all RL-1 fields are marked isNumeric: true', () => {
    for (const [key, def] of Object.entries(RL1_FIELD_LABELS)) {
      expect(def.isNumeric, `${key} should be numeric`).toBe(true);
    }
  });
});

describe('RL31_FIELD_LABELS', () => {
  it('defines all required RL-31 fields', () => {
    const required = ['boxA', 'boxB', 'boxC', 'landlordName'];
    for (const key of required) {
      expect(RL31_FIELD_LABELS, `RL31_FIELD_LABELS should contain ${key}`).toHaveProperty(key);
    }
  });

  it('every RL-31 field has the correct shape', () => {
    for (const [key, def] of Object.entries(RL31_FIELD_LABELS)) {
      assertFieldShape(key, def);
    }
  });

  it('boxB (number of tenants) is numeric, others are not', () => {
    expect(RL31_FIELD_LABELS.boxB.isNumeric).toBe(true);
    expect(RL31_FIELD_LABELS.boxA.isNumeric).toBe(false);
    expect(RL31_FIELD_LABELS.boxC.isNumeric).toBe(false);
    expect(RL31_FIELD_LABELS.landlordName.isNumeric).toBe(false);
  });
});
