import type { Annotation, VariationFile, VariationStatus, IterationContext } from './types';

export type { IterationContext };

export interface BuildIterationContextInput {
  variations: VariationFile[];
  annotations: Annotation[];
  statuses: Record<string, VariationStatus>;
  currentRound: number;
  originalPrompt: string;
}

/**
 * Build an iteration context payload from the current session state.
 *
 * Winner selection logic:
 * - If a variation is marked 'winner' in statuses, use its HTML
 * - If only one variation exists, auto-infer it as winner
 * - If multiple variations and no winner marked, throw
 *
 * Returns a pure data payload (no file writes, no fetch calls).
 */
export function buildIterationContext(input: BuildIterationContextInput): IterationContext {
  const { variations, annotations, statuses, currentRound, originalPrompt } = input;

  // Find explicit winner from statuses
  const winnerEntry = Object.entries(statuses).find(
    ([, status]) => status === 'winner'
  );

  let winnerVariation: VariationFile | undefined;

  if (winnerEntry) {
    const [winnerPath] = winnerEntry;
    winnerVariation = variations.find((v) => v.path === winnerPath);
  } else if (variations.length === 1) {
    // Auto-infer single variation as winner
    winnerVariation = variations[0];
  }

  if (!winnerVariation) {
    throw new Error(
      'No winner selected. Mark a variation as winner before iterating.'
    );
  }

  return {
    winnerHtml: winnerVariation.html,
    annotations,
    statuses,
    currentRound,
    originalPrompt,
  };
}
