// Session types
export interface SessionSummary {
  id: string;
  created: string;
  platform: string;
  variationCount: number;
  hasAnnotations: boolean;
  latestRound: number;
  title?: string;
}

// Full session data returned by loadSession
export interface SessionData {
  id: string;
  lineage: Lineage;
  variations: VariationFile[];
  annotations: AnnotationFile | null;
}

export interface VariationFile {
  path: string;
  html: string;
  name: string;
}

// Annotation types
export interface AnnotationFile {
  sessionId: string;
  annotations: Annotation[];
  statuses: Record<string, VariationStatus>;
}

export interface Annotation {
  id: string;
  type: 'sidebar' | 'pin';
  author: string;
  authorType: 'human' | 'agent';
  variationPath: string;
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

export type VariationStatus = 'winner' | 'rejected' | 'final' | 'unmarked';

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
  variations: VariationInfo[];
  winnerId: string | null;
  timestamp: string;
}

export interface VariationInfo {
  id: string;
  path: string;
  status: VariationStatus;
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
  statuses: Record<string, VariationStatus>;
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

// Dimension presets for known asset types
export const ASSET_DIMENSIONS: Record<string, { width: number; height: number }> = {
  'instagram': { width: 1080, height: 1080 },
  'linkedin-landscape': { width: 1200, height: 627 },
  'linkedin-wide': { width: 1340, height: 630 },
  'one-pager': { width: 816, height: 1056 },  // letter at 96dpi
};
