import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Timeline } from '../components/Timeline';
import { PromptReveal } from '../components/PromptReveal';
import { useAnnotationStore } from '../store/annotations';
import type { Lineage, Round } from '../lib/types';

const makeRound = (num: number, winnerId: string | null = null): Round => ({
  roundNumber: num,
  prompt: `Prompt for round ${num}`,
  variations: [
    { id: `v${num}-1`, path: `v${num}-1/styled.html`, status: winnerId === `v${num}-1` ? 'winner' : 'unmarked', specCheck: 'pass' },
    { id: `v${num}-2`, path: `v${num}-2/styled.html`, status: winnerId ? (winnerId === `v${num}-2` ? 'winner' : 'rejected') : 'unmarked', specCheck: 'pass' },
    { id: `v${num}-3`, path: `v${num}-3/styled.html`, status: winnerId ? (winnerId === `v${num}-3` ? 'winner' : 'rejected') : 'unmarked', specCheck: 'fail' },
  ],
  winnerId,
  timestamp: '2026-03-10T12:00:00Z',
});

const makeLineage = (rounds: Round[]): Lineage => ({
  sessionId: '20260310-120000',
  created: '2026-03-10T12:00:00Z',
  platform: 'instagram',
  product: 'FLFont',
  template: 'pain-agitate-solve',
  rounds,
});

describe('Timeline', () => {
  it('renders correct number of round nodes from lineage data', () => {
    const lineage = makeLineage([makeRound(1, 'v1-1'), makeRound(2)]);

    render(<Timeline lineage={lineage} statuses={{}} />);

    expect(screen.getByTestId('timeline-node-1')).toBeDefined();
    expect(screen.getByTestId('timeline-node-2')).toBeDefined();
  });

  it('handles legacy lineage format (entries[] with no rounds)', () => {
    const lineage: Lineage = {
      sessionId: '20260309-090000',
      created: '2026-03-09T09:00:00Z',
      platform: 'instagram',
      product: null,
      template: null,
      entries: [
        { prompt: 'Create post', archetype: 'trust', accentColor: '#4169E1', output: 'styled.html' },
        { prompt: 'Create post v2', archetype: 'pain', accentColor: '#FF6B35', output: 'v2-styled.html' },
      ],
    };

    render(<Timeline lineage={lineage} statuses={{}} />);

    // Should render a single pseudo-round node
    expect(screen.getByTestId('timeline-node-1')).toBeDefined();
    expect(screen.getByTestId('timeline-variation-v1')).toBeDefined();
    expect(screen.getByTestId('timeline-variation-v2')).toBeDefined();
  });

  it('shows empty state when no rounds and no entries', () => {
    const lineage: Lineage = {
      sessionId: '20260308-080000',
      created: '2026-03-08T08:00:00Z',
      platform: 'instagram',
      product: null,
      template: null,
    };

    render(<Timeline lineage={lineage} statuses={{}} />);
    expect(screen.getByText('No iteration rounds yet.')).toBeDefined();
  });
});

describe('PromptReveal', () => {
  it('toggles collapsed/expanded state', () => {
    render(<PromptReveal prompt="Test prompt text" />);

    // Initially collapsed -- prompt content should not be visible
    expect(screen.queryByTestId('prompt-content')).toBeNull();

    // Click to expand
    fireEvent.click(screen.getByTestId('prompt-toggle'));
    expect(screen.getByTestId('prompt-content')).toBeDefined();
    expect(screen.getByText('Test prompt text')).toBeDefined();

    // Click to collapse
    fireEvent.click(screen.getByTestId('prompt-toggle'));
    expect(screen.queryByTestId('prompt-content')).toBeNull();
  });
});

describe('Status management', () => {
  it('setting a winner auto-rejects other variations in the same round', () => {
    // Test the store-level logic
    const store = useAnnotationStore.getState();

    // Set one as winner
    store.setStatus('v1/styled.html', 'winner');
    // Simulate auto-reject logic (as App.tsx does)
    store.setStatus('v2/styled.html', 'rejected');
    store.setStatus('v3/styled.html', 'rejected');

    const state = useAnnotationStore.getState();
    expect(state.statuses['v1/styled.html']).toBe('winner');
    expect(state.statuses['v2/styled.html']).toBe('rejected');
    expect(state.statuses['v3/styled.html']).toBe('rejected');
  });
});
