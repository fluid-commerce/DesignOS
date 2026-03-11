import { useCallback } from 'react';
import { useGenerationStore } from '../store/generation';
import { parseStreamEvent } from '../lib/stream-parser';
import type { Annotation, VariationStatus } from '../lib/types';

interface GenerateOptions {
  template?: string;
  customization?: object;
  skillType?: string;
  /** Session ID for iteration mode -- server echoes back the same ID */
  sessionId?: string;
  /** Iteration context including winner HTML, annotations, and statuses */
  iterationContext?: {
    winnerHtml: string;
    annotations: Annotation[];
    statuses: Record<string, VariationStatus>;
    currentRound: number;
    originalPrompt: string;
  };
}

/**
 * Hook that connects to the /api/generate SSE endpoint,
 * parses stream frames, and dispatches events to the generation store.
 */
export function useGenerationStream() {
  const {
    addEvent,
    startGeneration,
    setSessionId,
    completeGeneration,
    errorGeneration,
    status,
    events,
    errorMessage,
  } = useGenerationStore();

  const generate = useCallback(
    async (prompt: string, opts?: GenerateOptions) => {
      startGeneration();

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, ...opts }),
        });

        if (!response.ok) {
          errorGeneration(await response.text());
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Parse SSE frames (separated by \n\n)
          while (buffer.includes('\n\n')) {
            const idx = buffer.indexOf('\n\n');
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);

            // Extract event type and data from SSE frame
            const eventMatch = frame.match(/^event: (\w+)\n/);
            const dataMatch = frame.match(/^data: (.+)$/m);
            if (!dataMatch) continue;

            const eventType = eventMatch?.[1];

            let parsed: any;
            try {
              parsed = JSON.parse(dataMatch[1]);
            } catch {
              continue; // skip malformed JSON
            }

            // Handle done event
            if (eventType === 'done') {
              completeGeneration();
              continue;
            }

            // Capture session ID from the first server event
            if (parsed.type === 'session' && parsed.sessionId) {
              setSessionId(parsed.sessionId);
              continue;
            }

            const msg = parseStreamEvent(parsed, eventType);
            if (msg) addEvent(msg);
          }
        }

        // If stream ended without a done event, mark complete
        if (useGenerationStore.getState().status === 'generating') {
          completeGeneration();
        }
      } catch (err) {
        errorGeneration(String(err));
      }
    },
    [addEvent, startGeneration, setSessionId, completeGeneration, errorGeneration],
  );

  const cancelGeneration = useCallback(async () => {
    try {
      await fetch('/api/generate/cancel', { method: 'POST' });
    } catch { /* ignore */ }
    errorGeneration('Generation cancelled by user');
  }, [errorGeneration]);

  return { generate, cancelGeneration, status, events, errorMessage };
}
