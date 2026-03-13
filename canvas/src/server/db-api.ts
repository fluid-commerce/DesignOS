/**
 * Database API layer for the Campaign > Creation > Slide > Iteration hierarchy.
 * All functions are synchronous (better-sqlite3 sync API).
 * Server-only module — never import from React components.
 *
 * Channels and JSON fields (slotSchema, aiBaseline, userState) are serialized
 * to/from JSON when reading/writing to SQLite.
 */

import { nanoid } from 'nanoid';
import { getDb } from '../lib/db';
import type { Campaign, Creation, Slide, Iteration, CampaignAnnotation } from '../lib/campaign-types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Deserialize a Campaign row from SQLite (channels is JSON string). */
function rowToCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    title: row.title as string,
    channels: JSON.parse(row.channels as string) as string[],
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

/** Deserialize a Creation row from SQLite. */
function rowToCreation(row: Record<string, unknown>): Creation {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    title: row.title as string,
    creationType: row.creation_type as string,
    slideCount: row.slide_count as number,
    createdAt: row.created_at as number,
  };
}

/** Deserialize a Slide row from SQLite. */
function rowToSlide(row: Record<string, unknown>): Slide {
  return {
    id: row.id as string,
    creationId: row.creation_id as string,
    slideIndex: row.slide_index as number,
    createdAt: row.created_at as number,
  };
}

/** Deserialize an Iteration row from SQLite (JSON fields parsed). */
function rowToIteration(row: Record<string, unknown>): Iteration {
  return {
    id: row.id as string,
    slideId: row.slide_id as string,
    iterationIndex: row.iteration_index as number,
    htmlPath: row.html_path as string,
    slotSchema: row.slot_schema ? JSON.parse(row.slot_schema as string) : null,
    aiBaseline: row.ai_baseline ? JSON.parse(row.ai_baseline as string) : null,
    userState: row.user_state ? JSON.parse(row.user_state as string) : null,
    status: row.status as Iteration['status'],
    source: row.source as Iteration['source'],
    templateId: (row.template_id as string | null) ?? null,
    generationStatus: (row.generation_status as Iteration['generationStatus']) ?? 'complete',
    createdAt: row.created_at as number,
  };
}

/** Deserialize a CampaignAnnotation row from SQLite. */
function rowToAnnotation(row: Record<string, unknown>): CampaignAnnotation {
  return {
    id: row.id as string,
    iterationId: row.iteration_id as string,
    type: row.type as CampaignAnnotation['type'],
    author: row.author as string,
    text: row.text as string,
    x: row.x != null ? (row.x as number) : undefined,
    y: row.y != null ? (row.y as number) : undefined,
    createdAt: row.created_at as number,
  };
}

// ─── Campaign ────────────────────────────────────────────────────────────────

export function createCampaign(input: { title: string; channels: string[] }): Campaign {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    'INSERT INTO campaigns (id, title, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.title, JSON.stringify(input.channels), now, now);
  return { id, title: input.title, channels: input.channels, createdAt: now, updatedAt: now };
}

export function getCampaigns(): Campaign[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM campaigns ORDER BY created_at DESC'
  ).all() as Record<string, unknown>[];
  return rows.map(rowToCampaign);
}

export function getCampaign(id: string): Campaign | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToCampaign(row) : undefined;
}

// ─── Creation ───────────────────────────────────────────────────────────────

export function createCreation(input: {
  campaignId: string;
  title: string;
  creationType: string;
  slideCount: number;
}): Creation {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    'INSERT INTO creations (id, campaign_id, title, creation_type, slide_count, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.campaignId, input.title, input.creationType, input.slideCount, now);
  return {
    id,
    campaignId: input.campaignId,
    title: input.title,
    creationType: input.creationType,
    slideCount: input.slideCount,
    createdAt: now,
  };
}

export function getCreations(campaignId: string): Creation[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM creations WHERE campaign_id = ? ORDER BY created_at ASC'
  ).all(campaignId) as Record<string, unknown>[];
  return rows.map(rowToCreation);
}

// ─── Slide ──────────────────────────────────────────────────────────────────

export function createSlide(input: { creationId: string; slideIndex: number }): Slide {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    'INSERT INTO slides (id, creation_id, slide_index, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, input.creationId, input.slideIndex, now);
  return { id, creationId: input.creationId, slideIndex: input.slideIndex, createdAt: now };
}

export function getSlides(creationId: string): Slide[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM slides WHERE creation_id = ? ORDER BY slide_index ASC'
  ).all(creationId) as Record<string, unknown>[];
  return rows.map(rowToSlide);
}

// ─── Iteration ────────────────────────────────────────────────────────────────

export function createIteration(input: {
  slideId: string;
  iterationIndex: number;
  htmlPath: string;
  slotSchema?: object | null;
  aiBaseline?: object | null;
  source: 'ai' | 'template';
  templateId?: string | null;
  generationStatus?: 'pending' | 'generating' | 'complete';
}): Iteration {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  const generationStatus = input.generationStatus ?? 'complete';
  db.prepare(
    `INSERT INTO iterations
      (id, slide_id, iteration_index, html_path, slot_schema, ai_baseline, user_state, status, source, template_id, generation_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.slideId,
    input.iterationIndex,
    input.htmlPath,
    input.slotSchema ? JSON.stringify(input.slotSchema) : null,
    input.aiBaseline ? JSON.stringify(input.aiBaseline) : null,
    null,                    // userState starts as null
    'unmarked',              // default status
    input.source,
    input.templateId ?? null,
    generationStatus,
    now
  );
  return {
    id,
    slideId: input.slideId,
    iterationIndex: input.iterationIndex,
    htmlPath: input.htmlPath,
    slotSchema: input.slotSchema ?? null,
    aiBaseline: input.aiBaseline ?? null,
    userState: null,
    status: 'unmarked',
    source: input.source,
    templateId: input.templateId ?? null,
    generationStatus,
    createdAt: now,
  };
}

export function getIterations(slideId: string): Iteration[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM iterations WHERE slide_id = ? ORDER BY iteration_index ASC'
  ).all(slideId) as Record<string, unknown>[];
  return rows.map(rowToIteration);
}

export function updateIterationStatus(id: string, status: Iteration['status']): void {
  const db = getDb();
  db.prepare('UPDATE iterations SET status = ? WHERE id = ?').run(status, id);
}

export function updateIterationUserState(id: string, userState: object): void {
  const db = getDb();
  db.prepare('UPDATE iterations SET user_state = ? WHERE id = ?').run(JSON.stringify(userState), id);
}

export function updateIterationGenerationStatus(
  id: string,
  status: 'pending' | 'generating' | 'complete'
): void {
  const db = getDb();
  db.prepare('UPDATE iterations SET generation_status = ? WHERE id = ?').run(status, id);
}

export function getLatestIterationBySlide(slideId: string): Iteration | undefined {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM iterations WHERE slide_id = ? ORDER BY iteration_index DESC LIMIT 1'
  ).get(slideId) as Record<string, unknown> | undefined;
  return row ? rowToIteration(row) : undefined;
}

// ─── Creation (additional helpers) ──────────────────────────────────────────

export function updateCreation(id: string, input: { title?: string }): void {
  const db = getDb();
  if (input.title !== undefined) {
    db.prepare('UPDATE creations SET title = ? WHERE id = ?').run(input.title, id);
  }
}

// ─── Annotation ──────────────────────────────────────────────────────────────

export function createAnnotation(input: {
  iterationId: string;
  type: 'pin' | 'sidebar';
  author: string;
  text: string;
  x?: number;
  y?: number;
}): CampaignAnnotation {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    'INSERT INTO annotations (id, iteration_id, type, author, text, x, y, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, input.iterationId, input.type, input.author, input.text, input.x ?? null, input.y ?? null, now);
  return {
    id,
    iterationId: input.iterationId,
    type: input.type,
    author: input.author,
    text: input.text,
    x: input.x,
    y: input.y,
    createdAt: now,
  };
}

export function getAnnotations(iterationId: string): CampaignAnnotation[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM annotations WHERE iteration_id = ? ORDER BY created_at ASC'
  ).all(iterationId) as Record<string, unknown>[];
  return rows.map(rowToAnnotation);
}

// ─── Transactions ────────────────────────────────────────────────────────────

/**
 * Atomically creates a campaign and its initial creations.
 * Rolls back everything if any insert fails (FK violation, null constraint, etc.).
 */
export function createCampaignWithCreations(
  campaignInput: { title: string; channels: string[] },
  creationsInput: Array<{ title: string; creationType: string; slideCount: number }>
): { campaign: Campaign; creations: Creation[] } {
  const db = getDb();

  const campaignId = nanoid();
  const now = Date.now();

  const insertCampaign = db.prepare(
    'INSERT INTO campaigns (id, title, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  );
  const insertCreation = db.prepare(
    'INSERT INTO creations (id, campaign_id, title, creation_type, slide_count, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const campaign: Campaign = {
    id: campaignId,
    title: campaignInput.title,
    channels: campaignInput.channels,
    createdAt: now,
    updatedAt: now,
  };

  const creations: Creation[] = creationsInput.map((a) => ({
    id: nanoid(),
    campaignId,
    title: a.title,
    creationType: a.creationType,
    slideCount: a.slideCount,
    createdAt: now,
  }));

  const transaction = db.transaction(() => {
    insertCampaign.run(
      campaignId,
      campaignInput.title,
      JSON.stringify(campaignInput.channels),
      now,
      now
    );
    for (const creation of creations) {
      insertCreation.run(creation.id, campaignId, creation.title, creation.creationType, creation.slideCount, now);
    }
  });

  transaction();
  return { campaign, creations };
}

// Backward-compat aliases
/** @deprecated Use createCreation */
export const createAsset = (input: { campaignId: string; title: string; assetType: string; frameCount: number }) =>
  createCreation({ campaignId: input.campaignId, title: input.title, creationType: input.assetType, slideCount: input.frameCount });
/** @deprecated Use getCreations */
export const getAssets = getCreations;
/** @deprecated Use createSlide */
export const createFrame = (input: { assetId: string; frameIndex: number }) =>
  createSlide({ creationId: input.assetId, slideIndex: input.frameIndex });
/** @deprecated Use getSlides */
export const getFrames = getSlides;
/** @deprecated Use updateCreation */
export const updateAsset = updateCreation;
/** @deprecated Use createCampaignWithCreations */
export const createCampaignWithAssets = (
  campaignInput: { title: string; channels: string[] },
  assetsInput: Array<{ title: string; assetType: string; frameCount: number }>
) => {
  const result = createCampaignWithCreations(
    campaignInput,
    assetsInput.map(a => ({ title: a.title, creationType: a.assetType, slideCount: a.frameCount }))
  );
  return { campaign: result.campaign, assets: result.creations };
};

// ─── Preview ─────────────────────────────────────────────────────────────────

/**
 * Returns up to 4 preview entries for a campaign — one per creation (latest iteration).
 * Joins creations -> slides -> iterations using a subquery to get max iteration_index per slide.
 */
export function getCampaignPreviewUrls(
  campaignId: string
): Array<{ iterationId: string; htmlPath: string; creationType: string }> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      i.id              AS iteration_id,
      i.html_path       AS html_path,
      c.creation_type   AS creation_type
    FROM creations c
    JOIN slides s ON s.creation_id = c.id
    JOIN iterations i ON i.slide_id = s.id
    INNER JOIN (
      SELECT slide_id, MAX(iteration_index) AS max_idx
      FROM iterations
      GROUP BY slide_id
    ) latest ON latest.slide_id = i.slide_id AND i.iteration_index = latest.max_idx
    WHERE c.campaign_id = ?
    GROUP BY c.id
    ORDER BY c.created_at ASC
    LIMIT 4
  `).all(campaignId) as Array<{ iteration_id: string; html_path: string; creation_type: string }>;

  return rows.map((row) => ({
    iterationId: row.iteration_id,
    htmlPath: row.html_path,
    creationType: row.creation_type,
  }));
}
