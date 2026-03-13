import { describe, it, expect } from 'vitest';
import { buildIterationContext } from '../lib/context-bundler';
import type { Annotation, VariationStatus, VariationFile, IterationContext } from '../lib/types';

function makeVariation(id: string, html: string): VariationFile {
  return { path: `/working/session/${id}.html`, html, name: `${id}.html` };
}

function makeAnnotation(versionPath: string, text: string): Annotation {
  return {
    id: `ann-${Math.random().toString(36).slice(2, 8)}`,
    type: 'sidebar',
    author: 'tester',
    authorType: 'human',
    versionPath,
    text,
    createdAt: new Date().toISOString(),
  };
}

describe('buildIterationContext', () => {
  it('returns IterationContext with winnerHtml when a winner is marked', () => {
    const variations: VariationFile[] = [
      makeVariation('v1', '<div>Winner</div>'),
      makeVariation('v2', '<div>Loser</div>'),
    ];
    const annotations: Annotation[] = [
      makeAnnotation(variations[0].path, 'Great design'),
    ];
    const statuses: Record<string, VariationStatus> = {
      [variations[0].path]: 'winner',
      [variations[1].path]: 'rejected',
    };

    const result = buildIterationContext({
      variations,
      annotations,
      statuses,
      currentRound: 1,
      originalPrompt: 'Make a social post',
    });

    expect(result.winnerHtml).toBe('<div>Winner</div>');
    expect(result.annotations).toEqual(annotations);
    expect(result.statuses).toEqual(statuses);
    expect(result.currentRound).toBe(1);
    expect(result.originalPrompt).toBe('Make a social post');
  });

  it('auto-infers winner when there is a single variation', () => {
    const variations: VariationFile[] = [
      makeVariation('v1', '<div>Only one</div>'),
    ];
    const annotations: Annotation[] = [];
    const statuses: Record<string, VariationStatus> = {};

    const result = buildIterationContext({
      variations,
      annotations,
      statuses,
      currentRound: 2,
      originalPrompt: 'Iterate on this',
    });

    expect(result.winnerHtml).toBe('<div>Only one</div>');
    expect(result.currentRound).toBe(2);
  });

  it('throws when no winner and multiple variations', () => {
    const variations: VariationFile[] = [
      makeVariation('v1', '<div>A</div>'),
      makeVariation('v2', '<div>B</div>'),
    ];
    const statuses: Record<string, VariationStatus> = {
      [variations[0].path]: 'unmarked',
      [variations[1].path]: 'unmarked',
    };

    expect(() =>
      buildIterationContext({
        variations,
        annotations: [],
        statuses,
        currentRound: 1,
        originalPrompt: 'test',
      })
    ).toThrow(/winner/i);
  });

  it('includes all annotations as-is without filtering', () => {
    const variations: VariationFile[] = [
      makeVariation('v1', '<div>Winner</div>'),
      makeVariation('v2', '<div>Other</div>'),
    ];
    const annotations: Annotation[] = [
      makeAnnotation(variations[0].path, 'Note on winner'),
      makeAnnotation(variations[1].path, 'Note on other'),
      makeAnnotation(variations[0].path, 'Another note'),
    ];
    const statuses: Record<string, VariationStatus> = {
      [variations[0].path]: 'winner',
      [variations[1].path]: 'unmarked',
    };

    const result = buildIterationContext({
      variations,
      annotations,
      statuses,
      currentRound: 3,
      originalPrompt: 'test',
    });

    expect(result.annotations).toHaveLength(3);
    expect(result.annotations).toEqual(annotations);
  });

  it('IterationContext has all required fields', () => {
    const variations: VariationFile[] = [
      makeVariation('v1', '<p>HTML</p>'),
    ];

    const result: IterationContext = buildIterationContext({
      variations,
      annotations: [],
      statuses: {},
      currentRound: 1,
      originalPrompt: 'prompt',
    });

    // Type-level check: these must exist
    const _winnerHtml: string = result.winnerHtml;
    const _annotations: Annotation[] = result.annotations;
    const _statuses: Record<string, VariationStatus> = result.statuses;
    const _currentRound: number = result.currentRound;
    const _originalPrompt: string = result.originalPrompt;

    expect(result).toHaveProperty('winnerHtml');
    expect(result).toHaveProperty('annotations');
    expect(result).toHaveProperty('statuses');
    expect(result).toHaveProperty('currentRound');
    expect(result).toHaveProperty('originalPrompt');
  });
});
