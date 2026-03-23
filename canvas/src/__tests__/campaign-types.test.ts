/**
 * TDD RED: Tests for campaign-types.ts and slot-schema.ts
 * These tests verify that:
 * 1. campaign-types.ts exports Campaign, Creation, Slide, Iteration, CampaignAnnotation interfaces
 * 2. slot-schema.ts exports SlotSchema, SlotField, TextField, ImageField, DividerField, FieldMode
 * 3. The TypeScript shape of each interface matches the required schema
 */

import { describe, it, expect } from 'vitest';

// These imports will FAIL until the files are created (TDD RED phase)
import type {
  Campaign,
  Creation,
  Slide,
  Iteration,
  CampaignAnnotation,
} from '../lib/campaign-types';

import type {
  FieldMode,
  TextField,
  ImageField,
  DividerField,
  SlotField,
  SlotSchema,
} from '../lib/slot-schema';
import { imageLayoutSel, collectTransformTargets } from '../lib/slot-schema';

describe('campaign-types', () => {
  it('Campaign interface has required fields', () => {
    const campaign: Campaign = {
      id: 'cmp_abc123',
      title: 'Test Campaign',
      channels: ['instagram', 'linkedin'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(campaign.id).toBe('cmp_abc123');
    expect(campaign.title).toBe('Test Campaign');
    expect(campaign.channels).toEqual(['instagram', 'linkedin']);
    expect(typeof campaign.createdAt).toBe('number');
    expect(typeof campaign.updatedAt).toBe('number');
  });

  it('Creation interface has required fields', () => {
    const creation: Creation = {
      id: 'crt_xyz789',
      campaignId: 'cmp_abc123',
      title: 'Instagram Post',
      creationType: 'instagram',
      slideCount: 1,
      createdAt: Date.now(),
    };
    expect(creation.id).toBe('crt_xyz789');
    expect(creation.campaignId).toBe('cmp_abc123');
    expect(creation.slideCount).toBe(1);
    expect(creation.creationType).toBe('instagram');
  });

  it('Slide interface has required fields', () => {
    const slide: Slide = {
      id: 'sld_001',
      creationId: 'crt_xyz789',
      slideIndex: 0,
      createdAt: Date.now(),
    };
    expect(slide.id).toBe('sld_001');
    expect(slide.creationId).toBe('crt_xyz789');
    expect(slide.slideIndex).toBe(0);
  });

  it('Iteration interface has required fields', () => {
    const iteration: Iteration = {
      id: 'itr_001',
      slideId: 'sld_001',
      iterationIndex: 0,
      htmlPath: '/path/to/file.html',
      slotSchema: null,
      aiBaseline: null,
      userState: null,
      status: 'unmarked',
      source: 'ai',
      templateId: null,
      createdAt: Date.now(),
    };
    expect(iteration.id).toBe('itr_001');
    expect(iteration.slideId).toBe('sld_001');
    expect(iteration.source).toBe('ai');
    expect(iteration.status).toBe('unmarked');
  });

  it('Iteration status is a VersionStatus type', () => {
    const statuses: Iteration['status'][] = ['winner', 'rejected', 'final', 'unmarked'];
    statuses.forEach(s => expect(['winner', 'rejected', 'final', 'unmarked']).toContain(s));
  });

  it('Iteration source can be ai or template', () => {
    const aiIter: Iteration = {
      id: 'itr_001', slideId: 'sld_001', iterationIndex: 0,
      htmlPath: '/test.html', slotSchema: null, aiBaseline: null,
      userState: null, status: 'unmarked', source: 'ai', templateId: null, createdAt: Date.now(),
    };
    const tplIter: Iteration = {
      id: 'itr_002', slideId: 'sld_001', iterationIndex: 1,
      htmlPath: '/test2.html', slotSchema: null, aiBaseline: null,
      userState: null, status: 'unmarked', source: 'template', templateId: 'tpl_001', createdAt: Date.now(),
    };
    expect(aiIter.source).toBe('ai');
    expect(tplIter.source).toBe('template');
  });

  it('CampaignAnnotation interface has required fields', () => {
    const annotation: CampaignAnnotation = {
      id: 'ann_001',
      iterationId: 'itr_001',
      type: 'pin',
      author: 'human',
      text: 'Fix the headline',
      x: 50.5,
      y: 25.3,
      createdAt: Date.now(),
    };
    expect(annotation.id).toBe('ann_001');
    expect(annotation.iterationId).toBe('itr_001');
    expect(annotation.type).toBe('pin');
    expect(annotation.x).toBe(50.5);
  });

  it('CampaignAnnotation type can be pin or sidebar', () => {
    const pin: CampaignAnnotation = {
      id: 'ann_pin', iterationId: 'itr_001', type: 'pin',
      author: 'human', text: 'pin note', x: 10, y: 20, createdAt: Date.now(),
    };
    const sidebar: CampaignAnnotation = {
      id: 'ann_side', iterationId: 'itr_001', type: 'sidebar',
      author: 'human', text: 'sidebar note', createdAt: Date.now(),
    };
    expect(pin.type).toBe('pin');
    expect(sidebar.type).toBe('sidebar');
  });
});

describe('slot-schema', () => {
  it('TextField has required fields', () => {
    const field: TextField = {
      type: 'text',
      sel: '.headline',
      label: 'Headline',
      mode: 'text',
    };
    expect(field.type).toBe('text');
    expect(field.sel).toBe('.headline');
    expect(field.mode).toBe('text');
  });

  it('TextField supports optional rows', () => {
    const field: TextField = {
      type: 'text',
      sel: '.body',
      label: 'Body',
      mode: 'br',
      rows: 3,
    };
    expect(field.rows).toBe(3);
  });

  it('FieldMode is text | pre | br', () => {
    const modes: FieldMode[] = ['text', 'pre', 'br'];
    modes.forEach(m => expect(['text', 'pre', 'br']).toContain(m));
  });

  it('ImageField has required fields', () => {
    const field: ImageField = {
      type: 'image',
      sel: '.hero-image',
      label: 'Hero Image',
      dims: '353 x 439px',
    };
    expect(field.type).toBe('image');
    expect(field.sel).toBe('.hero-image');
    expect(field.dims).toBe('353 x 439px');
  });

  it('DividerField has required fields', () => {
    const field: DividerField = {
      type: 'divider',
      label: 'Slide 01 - Cover',
    };
    expect(field.type).toBe('divider');
    expect(field.label).toBe('Slide 01 - Cover');
  });

  it('SlotField union accepts all field types', () => {
    const fields: SlotField[] = [
      { type: 'text', sel: '.h1', label: 'Title', mode: 'text' },
      { type: 'image', sel: '.img', label: 'Photo' },
      { type: 'divider', label: 'Section' },
    ];
    expect(fields).toHaveLength(3);
    expect(fields[0].type).toBe('text');
    expect(fields[1].type).toBe('image');
    expect(fields[2].type).toBe('divider');
  });

  it('SlotSchema has required fields', () => {
    const schema: SlotSchema = {
      width: 1080,
      height: 1080,
      fields: [
        { type: 'text', sel: '.headline', label: 'Headline', mode: 'text' },
      ],
      brush: '.movable-element',
      brushLabel: 'Logo',
      carouselCount: undefined,
    };
    expect(schema.width).toBe(1080);
    expect(schema.height).toBe(1080);
    expect(schema.fields).toHaveLength(1);
    expect(schema.brush).toBe('.movable-element');
  });

  it('SlotSchema has optional templateId, brush, brushLabel, carouselCount', () => {
    const minimal: SlotSchema = {
      width: 1200,
      height: 627,
      fields: [],
    };
    expect(minimal.templateId).toBeUndefined();
    expect(minimal.brush).toBeUndefined();
    expect(minimal.carouselCount).toBeUndefined();
  });

  it('imageLayoutSel uses frameSel when set', () => {
    expect(
      imageLayoutSel({
        type: 'image',
        sel: '.photo img',
        label: 'P',
        frameSel: '.portrait-frame',
      })
    ).toBe('.portrait-frame');
  });

  it('imageLayoutSel derives wrapper from "... img" selector', () => {
    expect(imageLayoutSel({ type: 'image', sel: '.photo img', label: 'P' })).toBe('.photo');
  });

  it('imageLayoutSel leaves non-img selectors unchanged', () => {
    expect(imageLayoutSel({ type: 'image', sel: '.hero-image', label: 'H' })).toBe('.hero-image');
  });

  it('collectTransformTargets uses layout wrapper for image fields', () => {
    const targets = collectTransformTargets({
      width: 1080,
      height: 1080,
      fields: [{ type: 'image', sel: '.photo img', label: 'Portrait' }],
    });
    expect(targets).toEqual([{ sel: '.photo', label: 'Portrait', kind: 'image' }]);
  });

  it('collectTransformTargets includes brushAdditional selectors', () => {
    const targets = collectTransformTargets({
      width: 1080,
      height: 1080,
      fields: [
        { type: 'text', sel: '[data-slide="1"] .slide-counter', label: 'Counter', mode: 'text' },
      ],
      brush: '[data-slide="2"] .s2-arrow',
      brushLabel: 'arrow',
      brushAdditional: [{ sel: '.extra-brush', label: 'extra' }],
    });
    expect(targets.map((t) => t.sel)).toEqual([
      '[data-slide="1"] .slide-counter',
      '[data-slide="2"] .s2-arrow',
      '.extra-brush',
    ]);
  });
});
