/**
 * MCP-specific type definitions for the Fluid Canvas MCP server.
 * Updated for the campaign hierarchy (Campaign > Asset > Frame > Iteration).
 */

// --- Variation status ---

export type VariationStatus = 'winner' | 'rejected' | 'final' | 'unmarked';

// --- Campaign-aware MCP input types ---

/**
 * V2: Push an HTML asset into the campaign hierarchy.
 * Creates an Iteration record in SQLite and writes HTML to disk.
 */
export interface PushAssetInput {
  /** Campaign ID (cmp_xxx) */
  campaignId: string;
  /** Asset ID (within the campaign) */
  assetId: string;
  /** Frame ID (within the asset) */
  frameId: string;
  /** Full HTML content of the asset */
  html: string;
  /** Optional iteration index (auto-increments if omitted) */
  iterationIndex?: number;
  /** Slot schema JSON for the content editor */
  slotSchema?: object;
  /** How the iteration was created */
  source?: 'ai' | 'template';
  /** Template ID if source='template' */
  templateId?: string;
  /** Optional platform hint (e.g. 'instagram-square') */
  platform?: string;
}

/**
 * Legacy V1 input (sessionId + variationId).
 * Deprecated — use PushAssetInput instead.
 */
export interface PushAssetInputLegacy {
  sessionId: string;
  variationId: string;
  html: string;
  platform?: string;
}

/** Read annotations for a specific iteration */
export interface ReadAnnotationsInput {
  /** Iteration ID (itr_xxx) */
  iterationId: string;
}

/** Read statuses for all iterations in a frame */
export interface ReadStatusesInput {
  /** Frame ID (frm_xxx) */
  frameId: string;
}

/** Read full iteration chain for a frame */
export interface ReadHistoryInput {
  /** Frame ID (frm_xxx) */
  frameId: string;
}

/** Request another iteration from a chosen winner */
export interface IterateRequestInput {
  /** Frame ID to iterate on */
  frameId: string;
  /** Human feedback for the next iteration */
  feedback: string;
  /** ID of the winning iteration to base the next round on */
  winnerId: string;
}

// --- Response types ---

export interface PushAssetResult {
  iterationId: string;
  htmlPath: string;
  message: string;
}

// --- Legacy annotation types (kept for read_history backward compat) ---

export interface AnnotationReply {
  id: string;
  author: string;
  authorType: 'human' | 'agent';
  text: string;
  createdAt: string;
}

export interface Annotation {
  id: string;
  type: 'sidebar' | 'pin';
  author: string;
  authorType: 'human' | 'agent';
  variationPath: string;
  text: string;
  createdAt: string;
  x?: number;
  y?: number;
  pinNumber?: number;
  replies?: AnnotationReply[];
}

export interface AnnotationFile {
  sessionId: string;
  annotations: Annotation[];
  statuses: Record<string, VariationStatus>;
}

// --- Lineage types (legacy flat-file format) ---

export interface Variation {
  id: string;
  path: string;
  status: VariationStatus;
  specCheck: 'pass' | 'fail' | 'draft';
}

export interface Round {
  roundNumber: number;
  prompt: string;
  variations: Variation[];
  winnerId: string | null;
  timestamp: string;
}

/** Phase 4 lineage format with rounds */
export interface Lineage {
  sessionId: string;
  created: string;
  platform: string;
  product: string | null;
  template: string | null;
  rounds: Round[];
}

/** Phase 2 legacy lineage format with flat entries */
export interface LegacyLineageEntry {
  step: string;
  file: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface LegacyLineage {
  sessionId: string;
  created: string;
  platform: string;
  product?: string | null;
  template?: string | null;
  entries: LegacyLineageEntry[];
}

/** Legacy iterate request (file-based) */
export interface IterateRequest {
  sessionId: string;
  feedback: string;
  winnerPath: string;
  context: {
    annotations: Annotation[];
    statuses: Record<string, VariationStatus>;
    rejectedVariations: string[];
  };
  createdAt: string;
}

// --- Revision history (combined view) ---

export interface RevisionHistory {
  sessionId: string;
  created: string;
  platform: string;
  rounds: Round[];
  annotations: Annotation[];
  statuses: Record<string, VariationStatus>;
}
