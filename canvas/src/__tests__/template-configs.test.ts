/**
 * template-configs.test.ts — Zod round-trip tests for TEMPLATE_SCHEMAS and isUsableStoredSlotSchema.
 *
 * Verifies:
 *   1. All 8 TEMPLATE_SCHEMAS round-trip through SlotSchemaZ.safeParse() successfully
 *   2. resolveSlotSchemaForIteration correctly applies isUsableStoredSlotSchema guard
 */

import { describe, it, expect } from 'vitest';
import { SlotSchemaZ } from '../lib/slot-schema';
import {
  TEMPLATE_SCHEMAS,
  resolveSlotSchemaForIteration,
  getTemplateSchema,
} from '../lib/template-configs';

// ─── Round-trip all 8 TEMPLATE_SCHEMAS ────────────────────────────────────────

describe('TEMPLATE_SCHEMAS — zod round-trip', () => {
  const templateIds = Object.keys(TEMPLATE_SCHEMAS);

  it('has exactly 8 templates', () => {
    expect(templateIds).toHaveLength(8);
  });

  for (const templateId of templateIds) {
    it(`${templateId} parses successfully through SlotSchemaZ`, () => {
      const schema = TEMPLATE_SCHEMAS[templateId];
      const result = SlotSchemaZ.safeParse(schema);
      expect(result.success).toBe(true);
      if (!result.success) {
        // Provide helpful failure output
        const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
        throw new Error(`SlotSchemaZ.safeParse failed for ${templateId}:\n${issues.join('\n')}`);
      }
    });
  }

  it('each parsed schema preserves fields array', () => {
    for (const [templateId, schema] of Object.entries(TEMPLATE_SCHEMAS)) {
      const result = SlotSchemaZ.safeParse(schema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fields.length).toBeGreaterThan(0);
        expect(result.data.fields.length).toBe(schema.fields.length);
        expect(result.data.templateId).toBe(templateId);
      }
    }
  });
});

// ─── SlotSchema field types parse correctly ────────────────────────────────────

describe('SlotSchema field types', () => {
  it('parses a text field', () => {
    const schema = {
      width: 1080, height: 1080,
      fields: [{ type: 'text', sel: '.headline', label: 'Headline', mode: 'text', rows: 2 }],
    };
    const result = SlotSchemaZ.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it('parses an image field', () => {
    const schema = {
      width: 1080, height: 1080,
      fields: [{ type: 'image', sel: '.photo img', label: 'Photo', dims: '100 × 100px' }],
    };
    const result = SlotSchemaZ.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it('parses a divider field', () => {
    const schema = {
      width: 1080, height: 1080,
      fields: [{ type: 'divider', label: 'Section' }],
    };
    const result = SlotSchemaZ.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it('parses a group field', () => {
    const schema = {
      width: 1080, height: 1080,
      fields: [
        {
          type: 'group',
          id: 'stat-1',
          label: 'Stat Card',
          sel: '.stat-card',
          fields: [
            { type: 'text', sel: '.stat-num', label: 'Number', mode: 'text' },
            { type: 'image', sel: '.stat-img img', label: 'Image' },
          ],
        },
      ],
    };
    const result = SlotSchemaZ.safeParse(schema);
    expect(result.success).toBe(true);
  });

  it('rejects a field with unknown type', () => {
    const schema = {
      width: 1080, height: 1080,
      fields: [{ type: 'video', sel: '.player', label: 'Video' }],
    };
    const result = SlotSchemaZ.safeParse(schema);
    expect(result.success).toBe(false);
  });

  it('rejects a text field with invalid mode', () => {
    const schema = {
      width: 1080, height: 1080,
      fields: [{ type: 'text', sel: '.x', label: 'X', mode: 'html' }],
    };
    const result = SlotSchemaZ.safeParse(schema);
    expect(result.success).toBe(false);
  });
});

// ─── isUsableStoredSlotSchema (via resolveSlotSchemaForIteration) ─────────────

describe('isUsableStoredSlotSchema (via resolveSlotSchemaForIteration)', () => {
  const validSchema = {
    width: 1080,
    height: 1080,
    fields: [{ type: 'text', sel: '.headline', label: 'Headline', mode: 'text' }],
  };

  it('resolves a valid stored schema', () => {
    const result = resolveSlotSchemaForIteration(validSchema, null, null);
    expect(result).not.toBeNull();
    expect(result?.fields).toHaveLength(1);
  });

  it('returns null for null input', () => {
    const result = resolveSlotSchemaForIteration(null, null, null);
    expect(result).toBeNull();
  });

  it('returns null for object missing fields', () => {
    const result = resolveSlotSchemaForIteration({ width: 1080, height: 1080 }, null, null);
    expect(result).toBeNull();
  });

  it('returns null for empty fields array', () => {
    const result = resolveSlotSchemaForIteration(
      { width: 1080, height: 1080, fields: [] },
      null,
      null
    );
    expect(result).toBeNull();
  });

  it('returns null for fields array with invalid field type', () => {
    const result = resolveSlotSchemaForIteration(
      { width: 1080, height: 1080, fields: [{ type: 'video', sel: '.x', label: 'X' }] },
      null,
      null
    );
    expect(result).toBeNull();
  });

  it('falls back to canonical schema when stored is invalid', () => {
    const result = resolveSlotSchemaForIteration(null, 't1-quote', null);
    const canonical = getTemplateSchema('t1-quote');
    expect(result).toEqual(canonical);
  });

  it('uses stored schema (with canonical chrome) when valid', () => {
    const storedWithKnownId = {
      ...validSchema,
      templateId: 't1-quote',
    };
    const result = resolveSlotSchemaForIteration(storedWithKnownId, 't1-quote', null);
    expect(result).not.toBeNull();
    // brush comes from canonical
    const canonical = getTemplateSchema('t1-quote');
    expect(result?.brush).toBe(canonical?.brush);
  });
});
