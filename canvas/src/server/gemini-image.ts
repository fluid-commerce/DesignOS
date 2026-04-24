/**
 * gemini-image.ts — Gemini 2.5 Flash Image integration.
 *
 * Model: gemini-2.5-flash-image (GA). Shutdown date: Oct 2, 2026.
 * Successor: gemini-3.1-flash-image-preview (migration deferred).
 *
 * Single-scope AI Studio API key via GEMINI_API_KEY env var.
 * Output: base64 PNG at ~1024px, ~$0.039/image, all outputs carry SynthID
 * invisible watermark.
 *
 * Safety model: SDK does NOT throw on blocks — we must check
 * `response.candidates[0].finishReason` and surface SAFETY / IMAGE_SAFETY / OTHER
 * as typed failures.
 */

import { GoogleGenAI } from '@google/genai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { insertGeneratedAsset } from './db-api';

// PROJECT_ROOT resolves to the canvas/ directory (two levels up from src/server/)
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

export type GeminiAspectRatio = '1:1' | '4:5' | '9:16' | '2:3' | '16:9' | '21:9';

export interface GeminiGenInput {
  prompt: string;
  aspectRatio: GeminiAspectRatio;
  /** Resolved to file paths and inlined as Parts. IDs or names of brand_assets. */
  referenceImages?: string[];
  idempotencyKey?: string;
  reason: 'no_dam_match' | 'user_explicit_request' | 'style_override';
  sessionId?: string | null;
  iterationId?: string | null;
  searchedQueries?: string[];
}

export type GeminiGenResult =
  | {
      ok: true;
      id: string;
      name: string;
      filePath: string;
      sizeBytes: number;
      mimeType: 'image/png';
      promptUsed: string;
      watermark: 'synthid';
      costUsd: number;
      metadata: Record<string, unknown>;
    }
  | {
      blocked: true;
      reason: 'safety' | 'image_safety' | 'other' | 'no_inline_data';
      finishReason: string | null;
    };

/**
 * Compute a deterministic idempotency key for a given prompt + aspectRatio +
 * optional sorted reference images. Uses the first 24 hex chars of SHA-256.
 */
export function computeIdempotencyKey(
  input: Pick<GeminiGenInput, 'prompt' | 'aspectRatio' | 'referenceImages'>,
): string {
  const refs = (input.referenceImages ?? []).slice().sort().join(',');
  const raw = `${input.prompt}|${input.aspectRatio}|${refs}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

/**
 * Sleep for `ms` milliseconds. Used for retry backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate an image via Gemini 2.5 Flash Image.
 *
 * - GEMINI_API_KEY is read at call-time (not module load), so tests can set it
 *   before each call via process.env.
 * - On 429, retries with exponential backoff (2s / 4s / 8s, max 3 retries).
 * - Other API errors bubble up as exceptions.
 * - Safety blocks return a typed `{ blocked: true }` result rather than throwing.
 */
export async function generateGeminiImage(input: GeminiGenInput): Promise<GeminiGenResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Add it to your .env file. ' +
        'Get an AI Studio key at https://ai.google.dev/',
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  // Build contents array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [{ text: input.prompt }];

  // Inline reference images if provided
  if (input.referenceImages && input.referenceImages.length > 0) {
    const { getDb } = await import('../lib/db');
    const db = getDb();
    for (const ref of input.referenceImages) {
      // Try to resolve by id first, then by name
      const row = (db
        .prepare(
          'SELECT file_path, mime_type FROM brand_assets WHERE id = ? OR name = ? LIMIT 1',
        )
        .get(ref, ref) as { file_path: string; mime_type: string } | undefined);
      if (row) {
        const filePath = path.isAbsolute(row.file_path)
          ? row.file_path
          : path.join(PROJECT_ROOT, row.file_path);
        try {
          const bytes = await fs.readFile(filePath);
          parts.push({
            inlineData: {
              data: bytes.toString('base64'),
              mimeType: row.mime_type,
            },
          });
        } catch {
          // Skip unreadable reference images — don't fail the whole generation
        }
      }
    }
  }

  const contents = [{ role: 'user' as const, parts }];

  // Retry loop: up to 3 attempts on 429
  const MAX_RETRIES = 3;
  const BACKOFF_MS = [2000, 4000, 8000];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          imageConfig: { aspectRatio: input.aspectRatio } as any,
        },
      });

      const candidate = response.candidates?.[0];
      const finishReason = (candidate?.finishReason as string | undefined) ?? null;

      // Check safety finish reasons
      if (finishReason === 'SAFETY') {
        return { blocked: true, reason: 'safety', finishReason };
      }
      if (finishReason === 'IMAGE_SAFETY') {
        return { blocked: true, reason: 'image_safety', finishReason };
      }
      if (finishReason === 'OTHER') {
        return { blocked: true, reason: 'other', finishReason };
      }

      // Find image part
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);
      if (!imagePart) {
        return { blocked: true, reason: 'no_inline_data', finishReason };
      }

      // Decode and write file
      const uuid = randomUUID();
      const outDir = path.join(PROJECT_ROOT, 'canvas', 'assets', 'generated');
      await fs.mkdir(outDir, { recursive: true });
      const outPath = path.join(outDir, `${uuid}.png`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageData = (imagePart as any).inlineData?.data as string;
      const buffer = Buffer.from(imageData, 'base64');
      await fs.writeFile(outPath, buffer);

      const relPath = `assets/generated/${uuid}.png`;
      const idempotencyKey =
        input.idempotencyKey ?? computeIdempotencyKey(input);

      const metadata: Record<string, unknown> = {
        prompt: input.prompt,
        model: 'gemini-2.5-flash-image',
        aspect_ratio: input.aspectRatio,
        reason: input.reason,
        idempotency_key: idempotencyKey,
        searched_queries: input.searchedQueries ?? [],
        session_id: input.sessionId ?? null,
        iteration_id: input.iterationId ?? null,
        watermark: 'synthid',
        cost_usd: 0.039,
      };

      // Insert brand_asset row
      insertGeneratedAsset({
        id: uuid,
        name: `${uuid}.png`,
        filePath: relPath,
        mimeType: 'image/png',
        sizeBytes: buffer.length,
        metadata,
      });

      return {
        ok: true,
        id: uuid,
        name: `${uuid}.png`,
        filePath: relPath,
        sizeBytes: buffer.length,
        mimeType: 'image/png',
        promptUsed: input.prompt,
        watermark: 'synthid',
        costUsd: 0.039,
        metadata,
      };
    } catch (err: unknown) {
      // Check for 429 rate limit
      const status =
        (err as { status?: number })?.status ??
        (err as { response?: { status?: number } })?.response?.status;

      if (status === 429 && attempt < MAX_RETRIES) {
        await sleep(BACKOFF_MS[attempt - 1]);
        continue;
      }

      // Non-retriable or max retries exceeded — bubble up
      throw err;
    }
  }

  // Should never reach here, but TS needs a return
  throw new Error('generateGeminiImage: max retries exceeded');
}
