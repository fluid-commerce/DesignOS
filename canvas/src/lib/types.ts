// Session types
export interface SessionSummary {
  id: string;
  created: string;
  platform: string;
  versionCount: number;
  hasAnnotations: boolean;
  latestRound: number;
  title?: string;
}

// Full session data returned by loadSession
export interface SessionData {
  id: string;
  lineage: Lineage;
  variations: VersionFile[];
  annotations: AnnotationFile | null;
}

export interface VersionFile {
  path: string;
  html: string;
  name: string;
  iterationId?: string;
}

// Annotation types
export interface AnnotationFile {
  sessionId: string;
  annotations: Annotation[];
  statuses: Record<string, VersionStatus>;
}

export interface Annotation {
  id: string;
  type: 'sidebar' | 'pin';
  author: string;
  authorType: 'human' | 'agent';
  versionPath: string;
  text: string;
  createdAt: string;
  x?: number;        // percentage 0-100 (pin only)
  y?: number;        // percentage 0-100 (pin only)
  pinNumber?: number;
  replies?: AnnotationReply[];
}

export interface AnnotationReply {
  id: string;
  author: string;
  authorType: 'human' | 'agent';
  text: string;
  createdAt: string;
}

export type VersionStatus = 'winner' | 'rejected' | 'final' | 'unmarked';

// Keep backward-compat aliases for VariationStatus / VariationFile during transition
/** @deprecated Use VersionStatus */
export type VariationStatus = VersionStatus;
/** @deprecated Use VersionFile */
export type VariationFile = VersionFile;

// Lineage types (support both Phase 2 flat and Phase 4 round formats)
export interface Lineage {
  sessionId: string;
  created: string;
  platform: string;
  product: string | null;
  template: string | null;
  title?: string;
  // Phase 4 format
  rounds?: Round[];
  // Phase 2 format (backward compat)
  entries?: LegacyEntry[];
}

export interface Round {
  roundNumber: number;
  prompt: string;
  variations: VersionInfo[];
  winnerId: string | null;
  timestamp: string;
}

export interface VersionInfo {
  id: string;
  path: string;
  status: VersionStatus;
  specCheck: 'pass' | 'fail' | 'draft';
}

export interface LegacyEntry {
  prompt: string;
  archetype: string;
  accentColor: string;
  output: string;
}

// Iteration context for buildIterationContext payload
export interface IterationContext {
  winnerHtml: string;
  annotations: Annotation[];
  statuses: Record<string, VersionStatus>;
  currentRound: number;
  originalPrompt: string;
}

// Request body for POST /api/generate
export interface GenerateRequestBody {
  prompt: string;
  template?: string;
  customization?: object;
  skillType?: string;
  sessionId?: string;
  iterationContext?: IterationContext;
}

// Dimension presets for known creation types
export const CREATION_DIMENSIONS: Record<string, { width: number; height: number }> = {
  'instagram': { width: 1080, height: 1080 },
  'linkedin-landscape': { width: 1200, height: 627 },
  'linkedin-wide': { width: 1340, height: 630 },
  'one-pager': { width: 816, height: 1056 },  // letter at 96dpi
};

/** @deprecated Use CREATION_DIMENSIONS */
export const ASSET_DIMENSIONS = CREATION_DIMENSIONS;
