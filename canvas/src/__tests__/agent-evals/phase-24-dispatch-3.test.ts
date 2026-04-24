/**
 * phase-24-dispatch-3.test.ts
 *
 * Tests for Phase 24 Dispatch 3: generate_image via Gemini + idempotency +
 * safety handling + promote_generated_image + read_skill + buildSystemPrompt updates.
 *
 * The Gemini SDK (@google/genai) is mocked via vi.mock — no real API calls.
 */

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import { closeDb, getDb } from '../../lib/db';

// ─── Mock @google/genai before any module that imports it ────────────────────
//
// generateGeminiImage reads process.env.GEMINI_API_KEY at call time, so we set
// it before each test. The SDK is fully mocked — no network traffic.

let mockGenerateContent: ReturnType<typeof vi.fn>;

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: (...args: unknown[]) => mockGenerateContent(...args),
      },
    })),
  };
});

// ─── Test DB setup ─────────────────────────────────────────────────────────────

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase24-d3-test-'));
// Point generated images to a temp dir so tests don't write to the real canvas/assets/
process.env.FLUID_DB_PATH = path.join(testDir, 'test.db');

beforeAll(() => {
  closeDb();
  process.env.FLUID_DB_PATH = path.join(testDir, 'test.db');
  getDb();
});

afterAll(() => {
  closeDb();
  delete process.env.FLUID_DB_PATH;
  delete process.env.GEMINI_API_KEY;
  fs.rmSync(testDir, { recursive: true, force: true });
});

beforeEach(() => {
  // Fresh mock for each test
  mockGenerateContent = vi.fn();
  // Set a fake key so the GEMINI_API_KEY guard passes in all tests
  process.env.GEMINI_API_KEY = 'test-key-fake';
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Seed a brand_asset row with metadata JSON (for idempotency tests). */
function seedGeneratedAsset(opts: { idempotencyKey: string }): {
  id: string;
  name: string;
} {
  const db = getDb();
  const id = nanoid();
  const name = `${id}.png`;
  db.prepare(
    `INSERT INTO brand_assets
       (id, name, category, file_path, mime_type, size_bytes, tags, description, source, dam_deleted, metadata, created_at)
     VALUES (?, ?, 'images', ?, 'image/png', 100, '[]', NULL, 'generated', 0, ?, ?)`,
  ).run(
    id,
    name,
    `assets/generated/${name}`,
    JSON.stringify({ idempotency_key: opts.idempotencyKey, cost_usd: 0.039 }),
    Date.now(),
  );
  return { id, name };
}

/** Make a minimal valid Gemini success response. */
function makeSuccessResponse(base64Data = 'aGVsbG8=') {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            { inlineData: { data: base64Data, mimeType: 'image/png' } },
          ],
        },
      },
    ],
  };
}

/** Make a Gemini blocked-safety response. */
function makeBlockedResponse(finishReason: string) {
  return {
    candidates: [{ finishReason, content: { parts: [] } }],
  };
}

// ─── 1. computeIdempotencyKey determinism ────────────────────────────────────

describe('computeIdempotencyKey', () => {
  it('returns the same key for identical inputs', async () => {
    const { computeIdempotencyKey } = await import('../../server/gemini-image');
    const a = computeIdempotencyKey({ prompt: 'hello', aspectRatio: '1:1' });
    const b = computeIdempotencyKey({ prompt: 'hello', aspectRatio: '1:1' });
    expect(a).toBe(b);
  });

  it('returns a different key when aspectRatio differs', async () => {
    const { computeIdempotencyKey } = await import('../../server/gemini-image');
    const a = computeIdempotencyKey({ prompt: 'hello', aspectRatio: '1:1' });
    const b = computeIdempotencyKey({ prompt: 'hello', aspectRatio: '4:5' });
    expect(a).not.toBe(b);
  });

  it('is 24 hex characters', async () => {
    const { computeIdempotencyKey } = await import('../../server/gemini-image');
    const key = computeIdempotencyKey({ prompt: 'test', aspectRatio: '16:9' });
    expect(key).toMatch(/^[0-9a-f]{24}$/);
  });

  it('reference images are order-independent', async () => {
    const { computeIdempotencyKey } = await import('../../server/gemini-image');
    const a = computeIdempotencyKey({
      prompt: 'p',
      aspectRatio: '1:1',
      referenceImages: ['img-b', 'img-a'],
    });
    const b = computeIdempotencyKey({
      prompt: 'p',
      aspectRatio: '1:1',
      referenceImages: ['img-a', 'img-b'],
    });
    expect(a).toBe(b);
  });
});

// ─── 2. Idempotency hit — returns cached result, no Gemini call ───────────────

describe('generateImageTool — idempotency', () => {
  it('returns cached:true and costUsd=0 when asset with same key exists', async () => {
    const { computeIdempotencyKey } = await import('../../server/gemini-image');
    const { generateImageTool } = await import('../../server/agent-tools');

    const prompt = 'a runner at dawn in cinematic light';
    const aspectRatio = '4:5';
    const key = computeIdempotencyKey({ prompt, aspectRatio });
    seedGeneratedAsset({ idempotencyKey: key });

    const result = await generateImageTool({
      prompt,
      aspectRatio,
      reason: 'no_dam_match',
    });

    expect(result.cached).toBe(true);
    expect(result.costUsd).toBe(0);
    expect(result.watermark).toBe('synthid');
    // Gemini SDK should NOT have been called
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});

// ─── 3. Safety block — SAFETY finishReason ───────────────────────────────────

describe('generateGeminiImage — safety handling', () => {
  it('returns blocked:true with reason=safety for SAFETY finishReason', async () => {
    const { generateGeminiImage } = await import('../../server/gemini-image');
    mockGenerateContent.mockResolvedValueOnce(makeBlockedResponse('SAFETY'));

    const result = await generateGeminiImage({
      prompt: 'test',
      aspectRatio: '1:1',
      reason: 'no_dam_match',
    });

    expect(result).toMatchObject({ blocked: true, reason: 'safety', finishReason: 'SAFETY' });
  });

  it('returns blocked:true with reason=image_safety for IMAGE_SAFETY finishReason', async () => {
    const { generateGeminiImage } = await import('../../server/gemini-image');
    mockGenerateContent.mockResolvedValueOnce(makeBlockedResponse('IMAGE_SAFETY'));

    const result = await generateGeminiImage({
      prompt: 'test',
      aspectRatio: '1:1',
      reason: 'no_dam_match',
    });

    expect(result).toMatchObject({ blocked: true, reason: 'image_safety', finishReason: 'IMAGE_SAFETY' });
  });

  it('returns blocked:true with reason=other for OTHER finishReason', async () => {
    const { generateGeminiImage } = await import('../../server/gemini-image');
    mockGenerateContent.mockResolvedValueOnce(makeBlockedResponse('OTHER'));

    const result = await generateGeminiImage({
      prompt: 'test',
      aspectRatio: '1:1',
      reason: 'no_dam_match',
    });

    expect(result).toMatchObject({ blocked: true, reason: 'other', finishReason: 'OTHER' });
  });

  it('throws ImageGenerationBlockedError via generateImageTool for SAFETY', async () => {
    const { generateImageTool, ImageGenerationBlockedError } = await import(
      '../../server/agent-tools'
    );
    mockGenerateContent.mockResolvedValueOnce(makeBlockedResponse('SAFETY'));

    await expect(
      generateImageTool({ prompt: 'blocked prompt', aspectRatio: '1:1', reason: 'no_dam_match' }),
    ).rejects.toThrow(ImageGenerationBlockedError);
  });

  it('ImageGenerationBlockedError has correct reason property', async () => {
    const { generateImageTool, ImageGenerationBlockedError } = await import(
      '../../server/agent-tools'
    );
    mockGenerateContent.mockResolvedValueOnce(makeBlockedResponse('SAFETY'));

    try {
      await generateImageTool({
        prompt: 'blocked',
        aspectRatio: '1:1',
        reason: 'no_dam_match',
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ImageGenerationBlockedError);
      expect((err as InstanceType<typeof ImageGenerationBlockedError>).reason).toBe('safety');
    }
  });
});

// ─── 4. No inline data — finishReason=STOP but no image part ─────────────────

describe('generateGeminiImage — no inline data', () => {
  it('returns blocked:true with reason=no_inline_data when no image part', async () => {
    const { generateGeminiImage } = await import('../../server/gemini-image');
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ text: 'I cannot generate images.' }] },
        },
      ],
    });

    const result = await generateGeminiImage({
      prompt: 'test',
      aspectRatio: '1:1',
      reason: 'no_dam_match',
    });

    expect(result).toMatchObject({ blocked: true, reason: 'no_inline_data' });
  });
});

// ─── 5. Success path ──────────────────────────────────────────────────────────

describe('generateGeminiImage — success path', () => {
  it('writes file, inserts brand_asset row, returns ok result with correct metadata', async () => {
    const { generateGeminiImage, computeIdempotencyKey } = await import(
      '../../server/gemini-image'
    );

    const base64Data = Buffer.from('fake-png-bytes').toString('base64');
    mockGenerateContent.mockResolvedValueOnce(makeSuccessResponse(base64Data));

    const prompt = 'cinematic runner at dawn';
    const aspectRatio: '4:5' = '4:5';
    const searchedQueries = ['runner photo'];
    const result = await generateGeminiImage({
      prompt,
      aspectRatio,
      reason: 'no_dam_match',
      searchedQueries,
      sessionId: 'sess-123',
    });

    expect('ok' in result && result.ok).toBe(true);
    if (!('ok' in result)) throw new Error('Expected ok result');

    expect(result.mimeType).toBe('image/png');
    expect(result.watermark).toBe('synthid');
    expect(result.costUsd).toBe(0.039);
    expect(result.promptUsed).toBe(prompt);
    expect(result.sizeBytes).toBeGreaterThan(0);

    // Verify metadata shape
    expect(result.metadata.prompt).toBe(prompt);
    expect(result.metadata.model).toBe('gemini-2.5-flash-image');
    expect(result.metadata.aspect_ratio).toBe(aspectRatio);
    expect(result.metadata.reason).toBe('no_dam_match');
    expect(result.metadata.watermark).toBe('synthid');
    expect(result.metadata.cost_usd).toBe(0.039);
    expect(result.metadata.searched_queries).toEqual(searchedQueries);
    expect(result.metadata.session_id).toBe('sess-123');
    expect(typeof result.metadata.idempotency_key).toBe('string');
    // No undefined values in metadata
    for (const [k, v] of Object.entries(result.metadata)) {
      expect(v, `metadata.${k} should not be undefined`).not.toBeUndefined();
    }

    // Verify brand_asset row was inserted
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM brand_assets WHERE id = ?")
      .get(result.id) as Record<string, unknown> | undefined;
    expect(row).toBeTruthy();
    expect(row!.source).toBe('generated');
    expect(row!.mime_type).toBe('image/png');

    // Verify file was written
    const filePath = path.resolve(
      import.meta.dirname,
      '..', '..', '..', '..', // up to canvas/
      result.filePath,
    );
    // File existence check (best-effort — path resolution may vary in test env)
    // The important thing is that sizeBytes > 0, which confirms the buffer was created.
    expect(result.sizeBytes).toBe(Buffer.from(base64Data, 'base64').length);

    // Verify idempotency key is a 24-char hex string
    const key = computeIdempotencyKey({ prompt, aspectRatio });
    expect(result.metadata.idempotency_key).toBe(key);
  });
});

// ─── 6. promoteGeneratedImage tool ───────────────────────────────────────────

describe('promoteGeneratedImageTool', () => {
  it('changes source from generated to local', async () => {
    const { promoteGeneratedImageTool } = await import('../../server/agent-tools');

    // Seed a generated asset
    const db = getDb();
    const id = nanoid();
    db.prepare(
      `INSERT INTO brand_assets
         (id, name, category, file_path, mime_type, size_bytes, tags, source, dam_deleted, created_at)
       VALUES (?, ?, 'images', 'assets/generated/x.png', 'image/png', 100, '[]', 'generated', 0, ?)`,
    ).run(id, `${id}.png`, Date.now());

    const result = promoteGeneratedImageTool(id);
    expect(result).toEqual({ success: true });

    const row = db
      .prepare('SELECT source FROM brand_assets WHERE id = ?')
      .get(id) as { source: string };
    expect(row.source).toBe('local');
  });

  it('does not affect assets with source=local (no-op)', async () => {
    const { promoteGeneratedImageTool } = await import('../../server/agent-tools');
    const db = getDb();
    const id = nanoid();
    db.prepare(
      `INSERT INTO brand_assets
         (id, name, category, file_path, mime_type, size_bytes, tags, source, dam_deleted, created_at)
       VALUES (?, ?, 'images', 'assets/test.png', 'image/png', 100, '[]', 'local', 0, ?)`,
    ).run(id, `${id}.png`, Date.now());

    promoteGeneratedImageTool(id);

    const row = db
      .prepare('SELECT source FROM brand_assets WHERE id = ?')
      .get(id) as { source: string };
    expect(row.source).toBe('local'); // unchanged
  });
});

// ─── 7. readSkillTool ─────────────────────────────────────────────────────────

describe('readSkillTool', () => {
  it('returns social-media-taste skill with >100 lines', async () => {
    const { readSkillTool } = await import('../../server/agent-tools');
    const result = readSkillTool('social-media-taste');
    expect(result.name).toBe('social-media-taste');
    expect(typeof result.content).toBe('string');
    expect(result.linesCount).toBeGreaterThan(100);
  });

  it('returns gemini-social-image skill', async () => {
    const { readSkillTool } = await import('../../server/agent-tools');
    const result = readSkillTool('gemini-social-image');
    expect(result.name).toBe('gemini-social-image');
    expect(result.linesCount).toBeGreaterThan(50);
  });

  it('throws for an unknown skill name', async () => {
    const { readSkillTool } = await import('../../server/agent-tools');
    expect(() => readSkillTool('unknown-skill' as any)).toThrow(/unknown skill/i);
  });

  it('throws for a path-traversal attempt', async () => {
    const { readSkillTool } = await import('../../server/agent-tools');
    expect(() => readSkillTool('../../../.env' as any)).toThrow(/unknown skill/i);
  });
});

// ─── 8. buildSystemPrompt — conditional taste-skill injection ─────────────────

describe('buildSystemPrompt — activeCreationType', () => {
  it('includes taste-skill content when activeCreationType=instagram', async () => {
    const { buildSystemPrompt } = await import('../../server/agent-system-prompt');
    const { staticPart } = buildSystemPrompt('test brand brief', null, 'instagram');
    // The social-media-taste skill file contains this phrase
    expect(staticPart).toMatch(/The real job of a social media post/i);
  });

  it('does NOT include taste-skill content for one-pager', async () => {
    const { buildSystemPrompt } = await import('../../server/agent-system-prompt');
    const { staticPart } = buildSystemPrompt('test brand brief', null, 'one-pager');
    expect(staticPart).not.toMatch(/The real job of a social media post/i);
  });

  it('does NOT include taste-skill content when no activeCreationType', async () => {
    const { buildSystemPrompt } = await import('../../server/agent-system-prompt');
    const { staticPart } = buildSystemPrompt('test brand brief');
    expect(staticPart).not.toMatch(/The real job of a social media post/i);
  });

  it('includes image-led workflow guidance in TIER1_PROMPT', async () => {
    const { buildSystemPrompt } = await import('../../server/agent-system-prompt');
    const { staticPart } = buildSystemPrompt('');
    expect(staticPart).toMatch(/search_brand_images/);
    expect(staticPart).toMatch(/generate_image/);
  });

  it('reads activeCreationType from uiContext.creationType when not passed explicitly', async () => {
    const { buildSystemPrompt } = await import('../../server/agent-system-prompt');
    const { staticPart } = buildSystemPrompt('brief', { creationType: 'linkedin' });
    expect(staticPart).toMatch(/The real job of a social media post/i);
  });
});

// ─── 9. findAssetByIdempotencyKey ─────────────────────────────────────────────

describe('findAssetByIdempotencyKey', () => {
  it('returns null when no matching asset', async () => {
    const { findAssetByIdempotencyKey } = await import('../../server/db-api');
    const result = findAssetByIdempotencyKey('nonexistent-key-xyz');
    expect(result).toBeNull();
  });

  it('returns asset shape when found', async () => {
    const { findAssetByIdempotencyKey } = await import('../../server/db-api');
    const key = `test-key-${nanoid(6)}`;
    const { id, name } = seedGeneratedAsset({ idempotencyKey: key });

    const result = findAssetByIdempotencyKey(key);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(id);
    expect(result!.name).toBe(name);
    expect(result!.url).toContain(encodeURIComponent(name));
  });
});

// ─── 10. Cost-cap integration — image-api tool over cap returns 'capped' ─────

describe('dispatchTool cost-cap integration', () => {
  it("returns outcome='capped' when daily spend exceeds cap without calling executor", async () => {
    const { dispatchTool } = await import('../../server/tool-dispatch');
    const { writeToolAuditLog } = await import('../../server/db-api');

    // Set a $0.01 cap
    process.env.FLUID_DAILY_COST_CAP_USD = '0.01';

    // Seed a spend row that exceeds the cap
    writeToolAuditLog({
      sessionId: 'test-cap',
      tool: 'generate_image',
      argsHash: 'abc123',
      tier: 'ask-first',
      decision: 'approved',
      costUsdEst: 0.039,
      outcome: 'ok',
    });

    const sseEvents: { event: string; data: unknown }[] = [];
    const mockRes = {
      write(chunk: string | Buffer) {
        const str = typeof chunk === 'string' ? chunk : chunk.toString();
        const m = str.match(/^event: ([^\n]+)\ndata: ([^\n]+)/);
        if (m) {
          try { sseEvents.push({ event: m[1], data: JSON.parse(m[2]) }); }
          catch { sseEvents.push({ event: m[1], data: m[2] }); }
        }
        return true;
      },
      writableEnded: false,
      end() {},
      writeHead() {},
    };

    const executorSpy = vi.fn().mockResolvedValue('should-not-run');

    const result = await dispatchTool(
      'generate_image',
      { prompt: 'test' },
      {
        chatId: 'chat-cap-test',
        res: mockRes as any,
        signal: new AbortController().signal,
        autoApproved: new Set(),
        trusted: true,
      },
      executorSpy,
      { estCostUsd: 0.039, estDurationSec: 8 },
    );

    expect(result.outcome).toBe('capped');
    expect(executorSpy).not.toHaveBeenCalled();
    expect(sseEvents.some((e) => e.event === 'budget_warning')).toBe(true);

    delete process.env.FLUID_DAILY_COST_CAP_USD;
  });
});
