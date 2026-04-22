import { describe, it, expect } from 'vitest';
import {
  collectTransformTargets,
  slotFieldSelFromLayoutPick,
  type SlotSchema,
  type GroupField,
} from '../lib/slot-schema';
import { filterFieldsForSlide } from '../lib/slot-schema-filter';

const groupSchema: SlotSchema = {
  archetypeId: 'stat-hero-single',
  width: 1080,
  height: 1080,
  fields: [
    {
      type: 'group',
      id: 'stat-card-1',
      label: 'Stat Card',
      sel: '.stat-card',
      fields: [
        { type: 'text', sel: '.stat-number', label: 'Stat Value', mode: 'text', rows: 1 },
        { type: 'text', sel: '.stat-label', label: 'Stat Label', mode: 'text', rows: 1 },
      ],
    },
    { type: 'text', sel: '.headline', label: 'Headline', mode: 'text', rows: 2 },
    { type: 'text', sel: '.body-copy', label: 'Body Copy', mode: 'pre', rows: 4 },
  ],
  brush: null,
};

describe('collectTransformTargets with groups', () => {
  it('includes group container as a transform target', () => {
    const targets = collectTransformTargets(groupSchema);
    const groupTarget = targets.find((t) => t.sel === '.stat-card');
    expect(groupTarget).toBeDefined();
    expect(groupTarget!.kind).toBe('group');
    expect(groupTarget!.label).toBe('Stat Card');
  });

  it('includes group children as transform targets', () => {
    const targets = collectTransformTargets(groupSchema);
    expect(targets.find((t) => t.sel === '.stat-number')).toBeDefined();
    expect(targets.find((t) => t.sel === '.stat-label')).toBeDefined();
  });

  it('includes non-grouped fields', () => {
    const targets = collectTransformTargets(groupSchema);
    expect(targets.find((t) => t.sel === '.headline')).toBeDefined();
    expect(targets.find((t) => t.sel === '.body-copy')).toBeDefined();
  });

  it('returns correct count (group + 2 children + 2 top-level)', () => {
    const targets = collectTransformTargets(groupSchema);
    expect(targets).toHaveLength(5);
  });
});

describe('slotFieldSelFromLayoutPick with groups', () => {
  it('finds text field inside a group', () => {
    const result = slotFieldSelFromLayoutPick(groupSchema, {
      sel: '.stat-number',
      kind: 'text',
    });
    expect(result).toBe('.stat-number');
  });

  it('finds top-level text field', () => {
    const result = slotFieldSelFromLayoutPick(groupSchema, {
      sel: '.headline',
      kind: 'text',
    });
    expect(result).toBe('.headline');
  });

  it('returns null for unknown selector', () => {
    const result = slotFieldSelFromLayoutPick(groupSchema, {
      sel: '.nonexistent',
      kind: 'text',
    });
    expect(result).toBeNull();
  });
});

describe('filterFieldsForSlide with groups', () => {
  it('includes groups in non-carousel mode', () => {
    const result = filterFieldsForSlide(groupSchema.fields, 1, false);
    const hasGroup = result.some((f) => f.type === 'group');
    expect(hasGroup).toBe(true);
  });

  it('still works with flat schemas (backward compat)', () => {
    const flatSchema: SlotSchema = {
      width: 1080,
      height: 1080,
      fields: [
        { type: 'text', sel: '.headline', label: 'Headline', mode: 'text' },
        { type: 'text', sel: '.body', label: 'Body', mode: 'text' },
      ],
      brush: null,
    };
    const result = filterFieldsForSlide(flatSchema.fields, 1, false);
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.type === 'text')).toBe(true);
  });
});
