/**
 * MCP-specific type definitions for the Fluid Canvas MCP server.
 * Duplicated from the main app types to avoid cross-project TypeScript complexity.
 */

// --- Annotation types ---

export type VariationStatus = 'winner' | 'rejected' | 'final' | 'unmarked';

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
  // Pin-specific (only when type === 'pin')
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

// --- Lineage types ---

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

// --- MCP tool types ---

export interface PushAssetInput {
  sessionId: string;
  variationId: string;
  html: string;
  platform?: string;
}

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
