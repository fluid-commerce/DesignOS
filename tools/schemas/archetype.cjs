'use strict';
/**
 * archetype.cjs — Zod schema for validating an archetype schema.json file.
 *
 * Validates the structural shape of an archetype schema. Semantic checks
 * (platform dimension matching, selector parity, @page rules) remain
 * as hand-written logic in validate-archetypes.cjs.
 */

const { z } = require('zod');

const TextFieldSchema = z.object({
  type: z.literal('text'),
  sel: z.string().min(1),
  label: z.string().min(1),
  mode: z.enum(['text', 'pre', 'br']),
  rows: z.number().optional(),
}).passthrough();

const ImageFieldSchema = z.object({
  type: z.literal('image'),
  sel: z.string().min(1),
  label: z.string().min(1),
  dims: z.string().optional(),
  frameSel: z.string().optional(),
}).passthrough();

const DividerFieldSchema = z.object({
  type: z.literal('divider'),
  label: z.string().min(1),
}).passthrough();

const FieldSchema = z.discriminatedUnion('type', [
  TextFieldSchema,
  ImageFieldSchema,
  DividerFieldSchema,
]);

// ── meta sub-schema (forward-only: required on instagram-portrait archetypes) ──
const MetaSchema = z.object({
  category: z.string().min(1),
  mood: z.array(z.string()).optional(),
  contentDensity: z.enum(['sparse', 'moderate', 'dense']).optional(),
  imageRole: z.enum(['none', 'accent', 'background', 'hero', 'grid']),
  imageHints: z
    .object({
      suggestedAspect: z.string().optional(),
      suggestedSubject: z.string().optional(),
      treatment: z.string().optional(),
      damPreference: z.array(z.string()).optional(),
    })
    .optional(),
  useCases: z.array(z.string()).min(1),
  avoidCases: z.array(z.string()).optional(),
  slotCount: z.number().int().min(1),
}).passthrough();

const ArchetypeSchema = z
  .object({
    archetypeId: z.string().regex(/^[a-z0-9-]+$/).optional(),
    platform: z
      .enum(['instagram-square', 'linkedin-landscape', 'one-pager', 'instagram-portrait'])
      .optional(),
    width: z.number(),
    height: z.number(),
    fields: z.array(FieldSchema),
    brush: z.null().optional(),
    brushAdditional: z.array(z.any()).max(0).optional(),
    meta: MetaSchema.optional(),
  })
  .passthrough()
  .refine((s) => !Object.prototype.hasOwnProperty.call(s, 'templateId'), {
    message: "must not have a 'templateId' field — use 'archetypeId' instead",
  });

module.exports = {
  ArchetypeSchema,
  TextFieldSchema,
  ImageFieldSchema,
  DividerFieldSchema,
  FieldSchema,
  MetaSchema,
};
