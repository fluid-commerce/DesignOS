'use strict';
/**
 * gold-standard.cjs — Zod schema for validating a parsed Liquid {% schema %} block.
 *
 * The "Gold Standard" count requirements (font_size_count: 13, etc.) are semantic
 * business rules that remain as hand-written logic in schema-validation.cjs.
 * This file only validates the STRUCTURAL shape of a parsed schema JSON object.
 */

const { z } = require('zod');

/** A single setting within a Liquid schema block */
const LiquidSettingSchema = z.object({
  type: z.string(),
  id: z.string().optional(),
  label: z.string().optional(),
  options: z
    .array(
      z.object({
        value: z.string(),
        label: z.string().optional(),
      })
    )
    .optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
}).passthrough();

/** A block within a Liquid schema (e.g. carousel slide) */
const LiquidBlockSchema = z.object({
  type: z.string(),
  settings: z.array(LiquidSettingSchema).optional(),
}).passthrough();

/** The full parsed {% schema %} block of a .liquid file */
const LiquidSchemaSchema = z.object({
  name: z.string().optional(),
  settings: z.array(LiquidSettingSchema).optional(),
  blocks: z.array(LiquidBlockSchema).optional(),
}).passthrough();

module.exports = { LiquidSchemaSchema, LiquidBlockSchema, LiquidSettingSchema };
