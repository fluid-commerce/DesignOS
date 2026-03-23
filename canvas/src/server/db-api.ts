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
import { resolveSlotSchemaForIteration } from '../lib/template-configs';

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

/** Safe JSON parse for optional DB columns (handles invalid or legacy data). */
function safeJsonParse(value: unknown): object | null {
  if (value == null || value === '') return null;
  try {
    const parsed = JSON.parse(value as string);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/** Deserialize an Iteration row from SQLite (JSON fields parsed). Tolerates missing generation_status (legacy DB). */
function rowToIteration(row: Record<string, unknown>): Iteration {
  const storedSlotSchema = row.slot_schema ? JSON.parse(row.slot_schema as string) : null;
  return {
    id: row.id as string,
    slideId: row.slide_id as string,
    iterationIndex: Number(row.iteration_index) ?? 0,
    htmlPath: row.html_path as string,
    slotSchema: resolveSlotSchemaForIteration(
      storedSlotSchema,
      (row.template_id as string | null) ?? null,
      row.html_path as string
    ),
    aiBaseline: safeJsonParse(row.ai_baseline),
    userState: safeJsonParse(row.user_state),
    status: (row.status as Iteration['status']) ?? 'unmarked',
    source: (row.source as Iteration['source']) ?? 'ai',
    templateId: (row.template_id as string | null) ?? null,
    generationStatus: (row.generation_status as Iteration['generationStatus']) ?? 'complete',
    createdAt: Number(row.created_at) ?? 0,
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
    'SELECT * FROM creations WHERE campaign_id = ? ORDER BY created_at DESC'
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

export function getSlideById(slideId: string): Slide | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM slides WHERE id = ?').get(slideId) as Record<string, unknown> | undefined;
  return row ? rowToSlide(row) : undefined;
}

// ─── Iteration ────────────────────────────────────────────────────────────────

export function createIteration(input: {
  id?: string;
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
  const id = input.id ?? nanoid();
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

// ─── Brand assets (catalog of shared assets served via /fluid-assets/) ──────

export interface BrandAsset {
  id: string;
  name: string;
  category: string;
  url: string;       // /api/brand-assets/serve/{name} (DB-backed serving)
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  source: string;        // 'local' | 'dam'
  damDeleted: boolean;   // true if soft-deleted from DAM
  description: string | null;
}

function rowToBrandAsset(row: Record<string, unknown>): BrandAsset {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    url: `/api/brand-assets/serve/${encodeURIComponent(row.name as string)}`,
    mimeType: row.mime_type as string,
    sizeBytes: row.size_bytes as number,
    tags: JSON.parse(row.tags as string),
    source: (row.source as string) ?? 'local',
    damDeleted: (row.dam_deleted as number) === 1,
    description: (row.description as string | null) ?? null,
  };
}

export function getBrandAssets(category?: string): BrandAsset[] {
  const db = getDb();
  if (category) {
    return (db.prepare('SELECT * FROM brand_assets WHERE category = ? AND (dam_deleted = 0 OR dam_deleted IS NULL) ORDER BY name ASC').all(category) as Record<string, unknown>[]).map(rowToBrandAsset);
  }
  return (db.prepare('SELECT * FROM brand_assets WHERE (dam_deleted = 0 OR dam_deleted IS NULL) ORDER BY category ASC, name ASC').all() as Record<string, unknown>[]).map(rowToBrandAsset);
}

/** Look up a single brand asset by name (first match). Returns raw row with file_path and mime_type. */
export function getBrandAssetByName(name: string): { file_path: string; mime_type: string } | undefined {
  const db = getDb();
  return db.prepare(
    'SELECT file_path, mime_type FROM brand_assets WHERE name = ? AND (dam_deleted = 0 OR dam_deleted IS NULL) LIMIT 1'
  ).get(name) as { file_path: string; mime_type: string } | undefined;
}

/** Look up a single brand asset by file_path. Returns raw row with file_path and mime_type. */
export function getBrandAssetByFilePath(filePath: string): { file_path: string; mime_type: string; name: string } | undefined {
  const db = getDb();
  return db.prepare(
    'SELECT file_path, mime_type, name FROM brand_assets WHERE file_path = ? AND (dam_deleted = 0 OR dam_deleted IS NULL) LIMIT 1'
  ).get(filePath) as { file_path: string; mime_type: string; name: string } | undefined;
}

/** Returns ALL brand assets including soft-deleted DAM assets. Used by the UI to show "Removed from DAM" state. */
export function getAllBrandAssets(category?: string): BrandAsset[] {
  const db = getDb();
  if (category) {
    return (db.prepare('SELECT * FROM brand_assets WHERE category = ? ORDER BY name ASC').all(category) as Record<string, unknown>[]).map(rowToBrandAsset);
  }
  return (db.prepare('SELECT * FROM brand_assets ORDER BY category ASC, name ASC').all() as Record<string, unknown>[]).map(rowToBrandAsset);
}

/** Update mutable metadata fields (category, description) on a brand asset. */
export function updateBrandAsset(id: string, updates: { category?: string; description?: string }): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (updates.category !== undefined) { sets.push('category = ?'); vals.push(updates.category); }
  if (updates.description !== undefined) { sets.push('description = ?'); vals.push(updates.description); }
  if (sets.length === 0) return;
  vals.push(id);
  db.prepare(`UPDATE brand_assets SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

// ─── DAM asset sync ──────────────────────────────────────────────────────────

export interface DamAssetRow {
  damId: string;
  name: string;
  category: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  damUrl: string;
  damModifiedAt: string;
}

/**
 * Insert a new DAM asset or update an existing one if it has been modified.
 *
 * - If no existing row: INSERT with source='dam'
 * - If existing row with same dam_modified_at: skip (no change)
 * - If existing row with older dam_modified_at: UPDATE fields + clear dam_deleted
 */
export function upsertDamAsset(row: DamAssetRow): void {
  const db = getDb();
  const existing = db.prepare(
    'SELECT id, dam_modified_at, last_synced_at FROM brand_assets WHERE dam_asset_id = ?'
  ).get(row.damId) as { id: string; dam_modified_at: string; last_synced_at: number } | undefined;

  if (existing) {
    // Skip if not newer (ISO datetime string comparison works lexicographically)
    if (existing.dam_modified_at >= row.damModifiedAt) return;
    db.prepare(`
      UPDATE brand_assets SET
        name = ?, file_path = ?, mime_type = ?, size_bytes = ?,
        dam_asset_url = ?, dam_modified_at = ?, last_synced_at = ?, dam_deleted = 0
      WHERE dam_asset_id = ?
    `).run(
      row.name, row.filePath, row.mimeType, row.sizeBytes,
      row.damUrl, row.damModifiedAt, Date.now(), row.damId
    );
  } else {
    db.prepare(`
      INSERT INTO brand_assets
        (id, name, category, file_path, mime_type, size_bytes, tags,
         source, dam_asset_id, dam_asset_url, dam_modified_at, last_synced_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'dam', ?, ?, ?, ?, ?)
    `).run(
      nanoid(), row.name, row.category, row.filePath, row.mimeType, row.sizeBytes,
      '[]', row.damId, row.damUrl, row.damModifiedAt, Date.now(), Date.now()
    );
  }
}

/**
 * Mark DAM assets that are no longer in the DAM folder as soft-deleted.
 *
 * Selects all non-deleted DAM assets from the DB and marks any whose dam_asset_id
 * is NOT in currentDamIds with dam_deleted=1. Returns the count of soft-deleted rows.
 */
export function softDeleteRemovedDamAssets(currentDamIds: Set<string>): number {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, dam_asset_id FROM brand_assets WHERE source = 'dam' AND dam_deleted = 0"
  ).all() as Array<{ id: string; dam_asset_id: string }>;

  let count = 0;
  for (const row of rows) {
    if (!currentDamIds.has(row.dam_asset_id)) {
      db.prepare('UPDATE brand_assets SET dam_deleted = 1 WHERE id = ?').run(row.id);
      count++;
    }
  }
  return count;
}

// ─── Saved assets (user library: add/save assets from DAM or upload) ─────────

export interface SavedAsset {
  id: string;
  url: string;
  name: string | null;
  mimeType: string | null;
  source: 'dam' | 'upload';
  createdAt: number;
}

function rowToSavedAsset(row: Record<string, unknown>): SavedAsset {
  return {
    id: row.id as string,
    url: row.url as string,
    name: (row.name as string | null) ?? null,
    mimeType: (row.mime_type as string | null) ?? null,
    source: (row.source as 'dam' | 'upload') || 'dam',
    createdAt: row.created_at as number,
  };
}

export function getSavedAssets(): SavedAsset[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM saved_assets ORDER BY created_at DESC'
  ).all() as Record<string, unknown>[];
  return rows.map(rowToSavedAsset);
}

export function createSavedAsset(input: {
  url: string;
  name?: string | null;
  mimeType?: string | null;
  source?: 'dam' | 'upload';
}): SavedAsset {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  const source = input.source ?? 'dam';
  db.prepare(
    'INSERT INTO saved_assets (id, url, name, mime_type, source, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    input.url,
    input.name ?? null,
    input.mimeType ?? null,
    source,
    now
  );
  return {
    id,
    url: input.url,
    name: input.name ?? null,
    mimeType: input.mimeType ?? null,
    source,
    createdAt: now,
  };
}

export function deleteSavedAsset(id: string): void {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM saved_assets WHERE id = ?');
  stmt.run(id);
}

// ─── Voice Guide ─────────────────────────────────────────────────────────────

export interface VoiceGuideDoc {
  id: string;
  slug: string;
  label: string;
  content: string;
  sortOrder: number;
  updatedAt: number;
}

function rowToVoiceGuideDoc(row: Record<string, unknown>): VoiceGuideDoc {
  return {
    id: row.id as string,
    slug: row.slug as string,
    label: row.label as string,
    content: row.content as string,
    sortOrder: row.sort_order as number,
    updatedAt: row.updated_at as number,
  };
}

export function getVoiceGuideDocs(): VoiceGuideDoc[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM voice_guide_docs ORDER BY sort_order').all() as Record<string, unknown>[];
  return rows.map(rowToVoiceGuideDoc);
}

export function getVoiceGuideDoc(slug: string): VoiceGuideDoc | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM voice_guide_docs WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
  return row ? rowToVoiceGuideDoc(row) : undefined;
}

export function updateVoiceGuideDoc(slug: string, content: string): void {
  const db = getDb();
  db.prepare('UPDATE voice_guide_docs SET content = ?, updated_at = ? WHERE slug = ?').run(content, Date.now(), slug);
}

// ─── Brand Patterns ──────────────────────────────────────────────────────────

export interface BrandPattern {
  id: string;
  slug: string;
  label: string;
  category: string;
  content: string;
  sortOrder: number;
  updatedAt: number;
}

function rowToBrandPattern(row: Record<string, unknown>): BrandPattern {
  return {
    id: row.id as string,
    slug: row.slug as string,
    label: row.label as string,
    category: row.category as string,
    content: row.content as string,
    sortOrder: row.sort_order as number,
    updatedAt: row.updated_at as number,
  };
}

export function getBrandPatterns(category?: string): BrandPattern[] {
  const db = getDb();
  const rows = (category
    ? db.prepare('SELECT * FROM brand_patterns WHERE category = ? ORDER BY sort_order').all(category)
    : db.prepare('SELECT * FROM brand_patterns ORDER BY sort_order').all()) as Record<string, unknown>[];
  return rows.map(rowToBrandPattern);
}

export function getBrandPatternBySlug(slug: string): BrandPattern | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM brand_patterns WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
  return row ? rowToBrandPattern(row) : undefined;
}

export function updateBrandPattern(slug: string, content: string): void {
  const db = getDb();
  db.prepare(
    'UPDATE brand_patterns SET content = ?, updated_at = ? WHERE slug = ?'
  ).run(content, Date.now(), slug);
}

// ─── Design Rules (template_design_rules) ────────────────────────────────────

export interface DesignRule {
  id: string;
  scope: string;
  platform: string | null;
  archetypeSlug: string | null;
  label: string;
  content: string;
  sortOrder: number;
  updatedAt: number;
}

function rowToDesignRule(row: Record<string, unknown>): DesignRule {
  return {
    id: row.id as string,
    scope: row.scope as string,
    platform: (row.platform as string | null) ?? null,
    archetypeSlug: (row.archetype_slug as string | null) ?? null,
    label: row.label as string,
    content: row.content as string,
    sortOrder: row.sort_order as number,
    updatedAt: row.updated_at as number,
  };
}

export function getDesignRules(scope?: string, platform?: string): DesignRule[] {
  const db = getDb();
  if (scope && platform) {
    return (db.prepare(
      'SELECT * FROM template_design_rules WHERE scope = ? AND platform = ? ORDER BY sort_order'
    ).all(scope, platform) as Record<string, unknown>[]).map(rowToDesignRule);
  }
  if (scope) {
    return (db.prepare(
      'SELECT * FROM template_design_rules WHERE scope = ? ORDER BY sort_order'
    ).all(scope) as Record<string, unknown>[]).map(rowToDesignRule);
  }
  if (platform) {
    return (db.prepare(
      'SELECT * FROM template_design_rules WHERE platform = ? ORDER BY sort_order'
    ).all(platform) as Record<string, unknown>[]).map(rowToDesignRule);
  }
  return (db.prepare(
    'SELECT * FROM template_design_rules ORDER BY sort_order'
  ).all() as Record<string, unknown>[]).map(rowToDesignRule);
}

export function getDesignRule(id: string): DesignRule | undefined {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM template_design_rules WHERE id = ?'
  ).get(id) as Record<string, unknown> | undefined;
  return row ? rowToDesignRule(row) : undefined;
}

export function getDesignRulesByArchetype(archetypeSlug: string, platform?: string): DesignRule[] {
  const db = getDb();
  if (platform) {
    return (db.prepare(
      'SELECT * FROM template_design_rules WHERE archetype_slug = ? AND platform = ? ORDER BY sort_order'
    ).all(archetypeSlug, platform) as Record<string, unknown>[]).map(rowToDesignRule);
  }
  return (db.prepare(
    'SELECT * FROM template_design_rules WHERE archetype_slug = ? ORDER BY sort_order'
  ).all(archetypeSlug) as Record<string, unknown>[]).map(rowToDesignRule);
}

export function updateDesignRule(id: string, content: string): void {
  const db = getDb();
  db.prepare(
    'UPDATE template_design_rules SET content = ?, updated_at = ? WHERE id = ?'
  ).run(content, Date.now(), id);
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  type: string;
  num: string;
  name: string;
  file: string;
  layout: string;
  dims: string | null;
  description: string;
  contentSlots: Array<{ slot: string; spec: string; color: string | null }>;
  extraTables: Array<{ label: string; headers: string[] | null; rows: string[][] }> | null;
  previewPath: string;
  sortOrder: number;
  updatedAt: number;
}

function rowToTemplate(row: Record<string, unknown>): Template {
  return {
    id: row.id as string,
    type: row.type as string,
    num: row.num as string,
    name: row.name as string,
    file: row.file as string,
    layout: row.layout as string,
    dims: (row.dims as string | null) ?? null,
    description: row.description as string,
    contentSlots: JSON.parse(row.content_slots as string),
    extraTables: row.extra_tables ? JSON.parse(row.extra_tables as string) : null,
    previewPath: row.preview_path as string,
    sortOrder: row.sort_order as number,
    updatedAt: row.updated_at as number,
  };
}

export function getTemplates(type?: string): Template[] {
  const db = getDb();
  if (type) {
    return (db.prepare('SELECT * FROM templates WHERE type = ? ORDER BY sort_order').all(type) as Record<string, unknown>[]).map(rowToTemplate);
  }
  return (db.prepare('SELECT * FROM templates ORDER BY sort_order').all() as Record<string, unknown>[]).map(rowToTemplate);
}

export function getTemplate(id: string): Template | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToTemplate(row) : undefined;
}

export function updateTemplate(
  id: string,
  fields: Partial<Pick<Template, 'description' | 'contentSlots' | 'extraTables'>>
): void {
  const db = getDb();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.description !== undefined) { sets.push('description = ?'); vals.push(fields.description); }
  if (fields.contentSlots !== undefined) { sets.push('content_slots = ?'); vals.push(JSON.stringify(fields.contentSlots)); }
  if (fields.extraTables !== undefined) { sets.push('extra_tables = ?'); vals.push(fields.extraTables ? JSON.stringify(fields.extraTables) : null); }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  vals.push(Date.now());
  vals.push(id);
  db.prepare(`UPDATE templates SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

/**
 * Load all Design DNA relevant to a pipeline generation context.
 * Returns: global visual style, social general rules, platform-specific rules,
 * and matched archetype rules — ready to inject into agent system prompts.
 */
export function getDesignDnaForPipeline(
  creationType: string,
  archetypeSlug?: string
): { globalStyle: string; socialGeneral: string; platformRules: string; archetypeNotes: string } {
  // Map creationType to platform
  const platform = creationType === 'linkedin' ? 'linkedin' : 'instagram';

  // Global visual style from brand_patterns
  const visualStyle = getBrandPatternBySlug('visual-compositor-contract');
  const globalStyle = visualStyle ? visualStyle.content : '';

  // Social general rules
  const generalRules = getDesignRules('global-social');
  const socialGeneral = generalRules.map(r => r.content).join('\n\n');

  // Platform-specific rules
  const platformRules = getDesignRules('platform', platform);
  const platformText = platformRules.map(r => `## ${r.label}\n${r.content}`).join('\n\n');

  // Archetype-specific notes
  let archetypeNotes = '';
  if (archetypeSlug) {
    const archetypeRules = getDesignRulesByArchetype(archetypeSlug);
    archetypeNotes = archetypeRules.map(r => `## ${r.label}\n${r.content}`).join('\n\n');
  }

  return { globalStyle, socialGeneral, platformRules: platformText, archetypeNotes };
}

// ─── Context Map ──────────────────────────────────────────────────────────────

export interface ContextMapEntry {
  id: string;
  creationType: string;
  stage: string;
  page: string;
  sections: string[];
  priority: number;
  maxTokens: number | null;
  sortOrder: number;
  updatedAt: number;
}

function rowToContextMapEntry(row: Record<string, unknown>): ContextMapEntry {
  return {
    id: row.id as string,
    creationType: row.creation_type as string,
    stage: row.stage as string,
    page: (row.page as string) ?? 'patterns',
    sections: JSON.parse(row.sections as string) as string[],
    priority: row.priority as number,
    maxTokens: (row.max_tokens as number | null) ?? null,
    sortOrder: row.sort_order as number,
    updatedAt: row.updated_at as number,
  };
}

export function getContextMap(): ContextMapEntry[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM context_map ORDER BY sort_order, creation_type, stage'
  ).all() as Record<string, unknown>[];
  return rows.map(rowToContextMapEntry);
}

export function upsertContextMapEntry(input: {
  id?: string;
  creationType: string;
  stage: string;
  page?: string;
  sections: string[];
  priority?: number;
  maxTokens?: number | null;
}): ContextMapEntry {
  const db = getDb();
  const now = Date.now();

  if (input.id) {
    // UPDATE existing row
    db.prepare(
      'UPDATE context_map SET sections = ?, priority = ?, max_tokens = ?, page = ?, updated_at = ? WHERE id = ?'
    ).run(
      JSON.stringify(input.sections),
      input.priority ?? 50,
      input.maxTokens ?? null,
      input.page ?? 'patterns',
      now,
      input.id
    );
    const row = db.prepare('SELECT * FROM context_map WHERE id = ?').get(input.id) as Record<string, unknown>;
    return rowToContextMapEntry(row);
  } else {
    // INSERT new row
    const id = nanoid();
    db.prepare(
      'INSERT INTO context_map (id, creation_type, stage, page, sections, priority, max_tokens, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      input.creationType,
      input.stage,
      input.page ?? 'patterns',
      JSON.stringify(input.sections),
      input.priority ?? 50,
      input.maxTokens ?? null,
      0,
      now
    );
    const row = db.prepare('SELECT * FROM context_map WHERE id = ?').get(id) as Record<string, unknown>;
    return rowToContextMapEntry(row);
  }
}

export function deleteContextMapEntry(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM context_map WHERE id = ?').run(id);
  return (result.changes ?? 0) > 0;
}

// ─── Context Log ──────────────────────────────────────────────────────────────

export interface ContextLogEntry {
  id: string;
  generationId: string;
  creationType: string;
  stage: string;
  injectedSections: string[];
  tokenEstimate: number;
  gapToolCalls: Array<{ tool: string; input: Record<string, unknown>; timestamp: number }>;
  createdAt: number;
}

function rowToContextLogEntry(row: Record<string, unknown>): ContextLogEntry {
  return {
    id: row.id as string,
    generationId: row.generation_id as string,
    creationType: row.creation_type as string,
    stage: row.stage as string,
    injectedSections: JSON.parse(row.injected_sections as string) as string[],
    tokenEstimate: row.token_estimate as number,
    gapToolCalls: JSON.parse(row.gap_tool_calls as string),
    createdAt: row.created_at as number,
  };
}

export function insertContextLog(input: {
  generationId: string;
  creationType: string;
  stage: string;
  injectedSections: string[];
  tokenEstimate: number;
  gapToolCalls?: Array<{ tool: string; input: Record<string, unknown>; timestamp: number }>;
}): ContextLogEntry {
  const db = getDb();
  const id = nanoid();
  const now = Date.now();
  db.prepare(
    'INSERT INTO context_log (id, generation_id, creation_type, stage, injected_sections, token_estimate, gap_tool_calls, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    input.generationId,
    input.creationType,
    input.stage,
    JSON.stringify(input.injectedSections),
    input.tokenEstimate,
    JSON.stringify(input.gapToolCalls ?? []),
    now
  );
  const row = db.prepare('SELECT * FROM context_log WHERE id = ?').get(id) as Record<string, unknown>;
  return rowToContextLogEntry(row);
}

/**
 * Load the full context map from DB, keyed by "creationType:stage".
 * Called once at pipeline start, cached for entire run.
 */
export function loadContextMap(): Map<string, Array<{ page: string; sections: string[]; priority: number; maxTokens: number | null }>> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT creation_type, stage, page, sections, priority, max_tokens FROM context_map ORDER BY priority DESC'
  ).all() as Array<{ creation_type: string; stage: string; page: string; sections: string; priority: number; max_tokens: number | null }>;

  const map = new Map<string, Array<{ page: string; sections: string[]; priority: number; maxTokens: number | null }>>();
  for (const row of rows) {
    const key = `${row.creation_type}:${row.stage}`;
    const entry = {
      page: row.page ?? 'patterns',
      sections: JSON.parse(row.sections),
      priority: row.priority,
      maxTokens: row.max_tokens,
    };
    const existing = map.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(key, [entry]);
    }
  }
  return map;
}

export function getContextLogs(filters?: {
  creationType?: string;
  stage?: string;
  limit?: number;
}): ContextLogEntry[] {
  const db = getDb();
  const limit = filters?.limit ?? 50;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.creationType) {
    conditions.push('creation_type = ?');
    params.push(filters.creationType);
  }
  if (filters?.stage) {
    conditions.push('stage = ?');
    params.push(filters.stage);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  const rows = db.prepare(
    `SELECT * FROM context_log ${where} ORDER BY created_at DESC LIMIT ?`
  ).all(...params) as Record<string, unknown>[];

  return rows.map(rowToContextLogEntry);
}
