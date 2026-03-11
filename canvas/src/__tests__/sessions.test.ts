import { describe, it, expect } from 'vitest';
import { parseLineage, countVariations } from '../lib/sessions';
import type { Lineage } from '../lib/types';

describe('sessions', () => {
  it('parses Phase 4 lineage with rounds and returns correct variation count', () => {
    const lineage: Lineage = {
      sessionId: '20260310-120000',
      created: '2026-03-10T12:00:00Z',
      platform: 'instagram',
      product: 'FLFont',
      template: 'pain-agitate-solve',
      rounds: [
        {
          roundNumber: 1,
          prompt: 'Create instagram post',
          variations: [
            { id: 'v1', path: 'v1/styled.html', status: 'winner', specCheck: 'pass' },
            { id: 'v2', path: 'v2/styled.html', status: 'rejected', specCheck: 'pass' },
            { id: 'v3', path: 'v3/styled.html', status: 'rejected', specCheck: 'fail' },
          ],
          winnerId: 'v1',
          timestamp: '2026-03-10T12:00:00Z',
        },
      ],
    };

    const count = countVariations(lineage);
    expect(count).toBe(3);
  });

  it('parses Phase 2 lineage with entries and returns correct variation count', () => {
    const lineage: Lineage = {
      sessionId: '20260309-090000',
      created: '2026-03-09T09:00:00Z',
      platform: 'linkedin-landscape',
      product: null,
      template: null,
      entries: [
        { prompt: 'Create post', archetype: 'trust', accentColor: '#4169E1', output: 'styled.html' },
        { prompt: 'Create post v2', archetype: 'pain', accentColor: '#FF6B35', output: 'v2-styled.html' },
      ],
    };

    const count = countVariations(lineage);
    expect(count).toBe(2);
  });

  it('returns 0 variations for lineage with neither rounds nor entries', () => {
    const lineage: Lineage = {
      sessionId: '20260308-080000',
      created: '2026-03-08T08:00:00Z',
      platform: 'instagram',
      product: null,
      template: null,
    };

    const count = countVariations(lineage);
    expect(count).toBe(0);
  });
});

describe('parseLineage', () => {
  it('returns null for invalid JSON', () => {
    const result = parseLineage('not json');
    expect(result).toBeNull();
  });

  it('parses valid lineage JSON', () => {
    const json = JSON.stringify({
      sessionId: '20260310-120000',
      created: '2026-03-10T12:00:00Z',
      platform: 'instagram',
      product: null,
      template: null,
    });
    const result = parseLineage(json);
    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe('20260310-120000');
  });
});
